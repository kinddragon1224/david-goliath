import {
  drawGarmentPhoto,
  drawHandGlow,
  drawPalace,
  drawSmoke,
  fabricTexture,
  propImage,
  rng,
  TONE,
  type DemoHand,
  type Fx,
  type Hand,
  type Item,
  type Level,
  type Meter,
  type Mode,
  type Phase,
  type QueueItem,
  type Stat,
} from "../core";
import {
  ECO,
  LAYOVER,
  RESTITCH,
  SEOLBAEK,
  SILUA,
  TAILORED,
  fullName,
  inside,
  pathOf,
  place,
  toWorld,
  type Garment,
  type Pt,
} from "../garments";

/** 03 다리미 챌린지
 * 손이 다리미. 다림판 위 옷을 쓱쓱 문질러 주름을 편다. 다 펴면 옷이 개켜져 옷걸이로 가고 다음 옷.
 * 쉬지 않고 다리면 스팀 게이지가 차고, 가득 차면 4초 동안 '스팀 부스트'(다리미가 커지고 점수 1.5배). */

const ORDER: Garment[] = [LAYOVER, TAILORED, SEOLBAEK, RESTITCH, SILUA, ECO];
const COLS = 28;
const ROWS = 22;
/** 이만큼 펴면 완성. */
const DONE_AT = 0.9;
const GARMENT_POINTS = 1000;
const GARMENT_BONUS = 500;
const BOOST_SECONDS = 4;
/** 노멀·하드: 옷 위에 다리미를 이만큼(초) 가만히 대고 있으면 눌음 자국. 이지는 안 눌는다. */
const SCORCH_AFTER = [0, 1.4, 1.0];
const SCORCH_PENALTY = [0, 200, 400];
/** 주름이 펴지는 빠르기(하드는 주름이 깊다). */
const PRESS = [1, 0.85, 0.62];

/** 옷을 가로 2 × 세로 3 구역으로 나눈다. 구역 주름이 이만큼만 남으면 '띵' 하고 싹 펴진다. */
const ZONE_COLS = 2;
const ZONE_ROWS = 3;
const ZONE_SNAP = 0.15;
const ZONE_BONUS = 100;

/** w: 남은 주름, w0: 처음 주름, dw: 주름 그림에 마지막으로 반영한 w, z: 구역. */
type Cell = {
  x: number;
  y: number;
  w: number;
  w0: number;
  dw: number;
  a: number;
  len: number;
  z: number;
};
type Zone = { w0: number; done: boolean; flash: number; x: number; y: number; w: number; h: number };
type Trail = { x: number; y: number; t: number; r: number };

export class IronMode implements Mode {
  seconds = 30;
  hint = "두 손으로 옷 위를 쓱쓱! 양손이면 점수 2배";
  tip = "두 손 모두 다리미! 옷 위를 크게 쓱쓱 문질러요";
  // 봇 기준. 이지: 양손 깔끔 27~40k, 한 손 9~11k, 양손 대충 7~17k, 한 손 대충 1~5k
  // 노멀: 양손 36~38k, 한 손(반짝이 따라) 11k, 1.6초씩 멈칫(눌음 16개) 9.5k / 하드: 양손 33k, 한 손 9.5k, 멈칫(눌음 18개) 5k
  grades: [number, number, number][] = [
    [14000, 7000, 2500],
    [13000, 6500, 2200],
    [11000, 5500, 2000],
  ];
  level: Level = 1;
  music = "lofi" as const;
  private heat = [0, 0];
  private scorches: { x: number; y: number; a: number }[] = [];
  private scorchCount = 0;
  private W = 1400;
  private H = 860;
  private gi = 0;
  private pts: Pt[] = [];
  private path = new Path2D();
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private cells: Cell[] = [];
  private total = 0;
  private finished: Garment[] = [];
  private fly: {
    path: Path2D;
    g: Garment;
    box: { x: number; y: number; w: number; h: number };
    color: string;
    t: number;
    cx: number;
    cy: number;
  } | null = null;
  private trail: Trail[] = [];
  private wrinkle: HTMLCanvasElement | null = null;
  private zones: Zone[] = [];
  private steamPuffs: { x: number; y: number; t: number; vx: number }[] = [];
  private rand = rng(7);
  private ironR = 80;
  private earned = 0;
  private steam = 0;
  private boost = 0;
  private hot: DemoHand | null = null;
  private hotT = 0;
  private time = 0;
  private pair = false;
  private pairT = 0;

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.gi = 0;
    this.finished = [];
    this.fly = null;
    this.trail = [];
    this.steamPuffs = [];
    this.steam = 0;
    this.boost = 0;
    this.pair = false;
    this.pairT = 0;
    this.rand = rng(7);
    this.heat = [0, 0];
    this.scorchCount = 0;
    this.ironR = Math.min(W, H) * 0.095;
    this.load();
  }

  private garment(): Garment {
    return ORDER[this.gi % ORDER.length];
  }

  private load(): void {
    const g = this.garment();
    const p = place(g, this.W * 0.5, this.H * 0.52, this.W * 0.5, this.H * 0.82);
    this.box = p;
    this.pts = toWorld(g, p);
    this.path = pathOf(this.pts);
    this.cells = [];
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const x = p.x + ((i + 0.5) / COLS) * p.w;
        const y = p.y + ((j + 0.5) / ROWS) * p.h;
        if (!inside(this.pts, x, y)) continue;
        // 결이 흐르듯 이웃 주름끼리 비슷한 방향
        const flow = Math.sin(x * 0.008 + this.gi) * 1.1 + Math.cos(y * 0.011) * 0.8;
        const w = 0.75 + this.rand() * 0.25;
        this.cells.push({
          x,
          y,
          w,
          w0: w,
          dw: w,
          a: flow + (this.rand() - 0.5) * 0.5,
          len: 0.5 + this.rand() * 0.7,
          z: Math.floor((j / ROWS) * ZONE_ROWS) * ZONE_COLS + Math.floor((i / COLS) * ZONE_COLS),
        });
      }
    }
    this.total = this.cells.reduce((s, c) => s + c.w, 0);
    this.zones = [];
    for (let k = 0; k < ZONE_COLS * ZONE_ROWS; k++) {
      const zw = p.w / ZONE_COLS;
      const zh = p.h / ZONE_ROWS;
      this.zones.push({
        w0: this.cells.reduce((s, c) => (c.z === k ? s + c.w : s), 0),
        done: false,
        flash: 0,
        x: p.x + (k % ZONE_COLS) * zw,
        y: p.y + Math.floor(k / ZONE_COLS) * zh,
        w: zw,
        h: zh,
      });
    }
    this.bakeWrinkles(g);
    this.scorches = [];
    this.earned = 0;
    this.hot = null;
    this.hotT = 0;
  }

  /** 옷 한 벌의 주름을 한 번만 그려 둔다. 칸마다 부드러운 골(그림자)과 등성이(빛). */
  private bakeWrinkles(g: Garment): void {
    if (typeof document === "undefined") return;
    const b = this.box;
    const cv = this.wrinkle ?? document.createElement("canvas");
    this.wrinkle = cv;
    cv.width = Math.max(1, Math.ceil(b.w));
    cv.height = Math.max(1, Math.ceil(b.h));
    const x = cv.getContext("2d");
    if (!x) return;
    x.translate(-b.x, -b.y);
    x.clip(this.path);
    x.lineCap = "round";
    const cw = b.w / COLS;
    const fold = (c: Cell, off: number, color: string, passes: [number, number][]) => {
      const L = cw * 2.6 * c.len;
      const dx = Math.cos(c.a) * L;
      const dy = Math.sin(c.a) * L;
      // 결에 수직으로 조금 휜다
      const nx = -Math.sin(c.a);
      const ny = Math.cos(c.a);
      const bend = (c.len - 0.85) * cw * 0.9;
      x.strokeStyle = color;
      for (const [w, a] of passes) {
        x.globalAlpha = a;
        x.lineWidth = w * cw;
        x.beginPath();
        x.moveTo(c.x - dx + nx * off, c.y - dy + ny * off);
        x.quadraticCurveTo(c.x + nx * (off + bend), c.y + ny * (off + bend), c.x + dx + nx * off, c.y + dy + ny * off);
        x.stroke();
      }
    };
    // 그림자 먼저 전부, 빛은 그 위에(겹친 주름이 지저분해지지 않게)
    // 칸 셋 중 하나만: 촘촘하면 얼룩말 무늬가 된다
    const some = this.cells.filter((_, i) => (i * 7) % 3 === 0);
    for (const c of some) fold(c, 0, g.shade, [[1.6, 0.05], [0.9, 0.07], [0.4, 0.11]]);
    for (const c of some) fold(c, -cw * 0.38, "#ffffff", [[0.7, 0.06], [0.25, 0.14]]);
  }

  /** 펴진 만큼 주름 그림을 지운다(다리미 지나간 자리만 매끈해진다). */
  private eraseWrinkles(): void {
    const x = this.wrinkle?.getContext("2d");
    if (!x) return;
    const b = this.box;
    const r = (b.w / COLS) * 1.4;
    x.save();
    x.setTransform(1, 0, 0, 1, -b.x, -b.y);
    x.globalCompositeOperation = "destination-out";
    for (const c of this.cells) {
      if (c.dw - c.w < 0.02 && !(c.w <= 0 && c.dw > 0)) continue;
      // 남은 비율 dw/w0 → w/w0 으로 줄이려면 그만큼의 불투명도로 지운다
      const a = c.dw > 0 ? 1 - c.w / c.dw : 1;
      c.dw = c.w;
      const gr = x.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.8})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = gr;
      x.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    }
    x.restore();
  }

  private left(): number {
    return this.cells.reduce((s, c) => s + c.w, 0) / Math.max(1e-6, this.total);
  }

  /** 펴진 정도(완성 기준 100%). */
  private pct(): number {
    return Math.min(100, Math.round(((1 - this.left()) / DONE_AT) * 100));
  }

  /** 주름이 가장 많이 남은 곳. */
  private findHot(): DemoHand | null {
    const R = this.ironR * 1.4;
    let best = 0;
    let at: DemoHand | null = null;
    for (const c of this.cells) {
      if (c.w < 0.2) continue;
      let sum = 0;
      for (const d of this.cells)
        if (Math.abs(d.x - c.x) < R && Math.abs(d.y - c.y) < R) sum += d.w;
      if (sum > best) {
        best = sum;
        at = { x: c.x, y: c.y };
      }
    }
    return at;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.time = t;
    for (const s of this.steamPuffs) {
      s.t += dt;
      s.y -= 150 * dt;
      s.x += s.vx * dt;
    }
    this.steamPuffs = this.steamPuffs.filter((s) => s.t < 1);
    this.trail = this.trail.filter((p) => t - p.t < 1.4);
    if (this.fly) {
      this.fly.t += dt;
      if (this.fly.t > 1) this.fly = null;
    }
    this.boost = Math.max(0, this.boost - dt);

    const R = this.ironR * (this.boost > 0 ? 1.5 : 1);
    // 두 손이 다 옷 위에서 움직이면 '양손 다림질': 점수 2배, 스팀 3배
    // 방향을 바꾸느라 잠깐 멈춰도 0.6초는 이어지게
    const both =
      hands.filter((h) => h.on && h.speed > this.W * 0.04 && this.onCloth(h)).length >= 2;
    this.pairT = both ? 0.6 : Math.max(0, this.pairT - dt);
    const pair = this.pairT > 0 && hands.filter((h) => h.on).length >= 2;
    if (pair && !this.pair) {
      fx.score(0, this.W / 2, this.H * 0.18, "양손 다림질! 점수 2배", "gold");
      fx.sfx("perfect");
      fx.say("iron-pair", true);
    }
    this.pair = pair;
    let ironing = false;
    hands.forEach((h, hi) => {
      // 노멀·하드: 옷 위에서 멈춰 있으면 열이 쌓여 눌는다
      // 웹캠 손 떨림(초당 수십 px)은 '멈춤'으로 친다
      const still = h.on && this.onCloth(h) && h.speed < this.W * 0.08;
      this.heat[hi] = still ? this.heat[hi] + dt : Math.max(0, this.heat[hi] - dt * 3);
      const lim = SCORCH_AFTER[this.level];
      if (lim && this.heat[hi] >= lim) {
        // 한 번 눌면 그 자리에서 곧바로 또 눌지 않게 한 번 더 기다려 준다
        this.heat[hi] = -lim;
        this.scorchCount++;
        this.scorches.push({ x: h.x, y: h.y, a: this.rand() * Math.PI });
        const pen = SCORCH_PENALTY[this.level];
        fx.score(-pen, h.x, h.y - this.ironR, `-${pen}`, "pink");
        fx.stamp("앗, 눌었어요!", h.x, h.y - this.ironR * 1.8, "pink");
        fx.shake(0.4);
        fx.sfx("miss");
      }
    });
    for (const h of hands) {
      if (!h.on) continue;
      // 움직여야 펴진다. 가만히 대고 있으면 아주 조금만.
      const move = Math.min(1, h.speed / (this.W * 0.45));
      const rate = (0.3 + 4.4 * move) * dt * PRESS[this.level];
      let removed = 0;
      for (const c of this.cells) {
        if (c.w <= 0) continue;
        const d = Math.hypot(c.x - h.x, c.y - h.y);
        if (d > R) continue;
        const take = Math.min(c.w, rate * (1 - (d / R) * 0.5));
        c.w -= take;
        removed += take;
      }
      if (removed > 0) {
        ironing = move > 0.08;
        let pts = (removed / this.total) * GARMENT_POINTS;
        if (this.boost > 0) pts *= 1.5;
        if (pair) pts *= 2;
        this.earned += pts;
        fx.score(pts, h.x, h.y);
        if (move > 0.1) {
          this.trail.push({ x: h.x, y: h.y, t, r: R });
          if (this.rand() < dt * 16) {
            this.steamPuffs.push({
              x: h.x + (this.rand() - 0.5) * R,
              y: h.y - R * 0.4,
              t: 0,
              vx: (this.rand() - 0.5) * 60,
            });
            fx.sfx("steam");
          }
        }
      }
    }
    if (this.trail.length > 160) this.trail.splice(0, this.trail.length - 160);

    // 구역 완료: 거의 다 편 구역은 '띵' 하고 남은 주름까지 싹 펴진다
    this.zones.forEach((z, k) => {
      z.flash = Math.max(0, z.flash - dt);
      if (z.done || z.w0 <= 0) return;
      let left = 0;
      for (const c of this.cells) if (c.z === k) left += c.w;
      if (left > z.w0 * ZONE_SNAP) return;
      z.done = true;
      z.flash = 0.6;
      for (const c of this.cells) if (c.z === k) c.w = 0;
      const pts = (left / this.total) * GARMENT_POINTS + ZONE_BONUS;
      this.earned += pts;
      const zx = z.x + z.w / 2;
      const zy = z.y + z.h / 2;
      fx.score(pts, zx, zy, `구역 완료 +${ZONE_BONUS}`, "mint");
      fx.burst(zx, zy, 26, "mint");
      fx.sfx("good");
    });

    // 스팀 게이지
    if (this.boost <= 0) {
      this.steam = ironing
        ? Math.min(1, this.steam + dt * (pair ? 0.9 : 0.3))
        : Math.max(0, this.steam - dt * 0.2);
      if (this.steam >= 1) {
        this.steam = 0;
        this.boost = BOOST_SECONDS;
        fx.sfx("perfect");
        fx.say("steam", true);
        fx.stamp("스팀 부스트!", this.W / 2, this.H * 0.2, "mint");
        fx.shake(0.3);
      }
    }

    // 남은 주름 위치(0.5초마다)
    this.hotT -= dt;
    if (this.hotT <= 0) {
      this.hot = this.findHot();
      this.hotT = 0.5;
    }

    if (this.left() <= 1 - DONE_AT) {
      const g = this.garment();
      fx.score(
        Math.max(0, GARMENT_POINTS - this.earned) + GARMENT_BONUS,
        this.W / 2,
        this.H * 0.4,
        `보너스 +${GARMENT_BONUS}`,
        "pink",
      );
      fx.celebrate(`${fullName(g)} 완성!`, "pink");
      fx.sfx("complete");
      fx.hitstop(0.09);
      fx.shake(0.45);
      this.finished.push(g);
      this.fly = {
        path: this.path,
        g,
        box: { ...this.box },
        color: g.color,
        t: 0,
        cx: this.box.x + this.box.w / 2,
        cy: this.box.y + this.box.h / 2,
      };
      this.trail = [];
      this.gi++;
      this.load();
    }
    const p = this.pct();
    this.hint =
      this.boost > 0
        ? `스팀 부스트! 다리미가 커졌어요 · ${p}%`
        : pair
          ? `양손 다림질! 점수 2배 · ${p}%`
          : p >= 75
            ? `${this.garment().name} ${p}% · 반짝이는 남은 주름을 찾아요!`
            : `${this.garment().name} 주름 펴기 ${p}% · 두 손으로 다리면 2배!`;
  }

  private onCloth(h: Hand): boolean {
    const b = this.box;
    const m = this.ironR * 0.5;
    return h.x > b.x - m && h.x < b.x + b.w + m && h.y > b.y - m && h.y < b.y + b.h + m;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], phase: Phase): void {
    const g = this.garment();
    drawBoutique(ctx, this.W, this.H, t, this.finished);

    // 옷
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = g.color;
    ctx.fill(this.path);
    ctx.restore();
    ctx.save();
    ctx.clip(this.path);
    const b = this.box;
    // 진짜 옷 사진 위에 주름을 얹는다(사진을 못 불렀으면 색 천)
    if (!drawGarmentPhoto(ctx, g, b.x, b.y, b.w, b.h))
      fabricTexture(ctx, b.x, b.y, b.w, b.h, g.shade);
    // 다린 자리: 매끈한 광택 자국
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 1; i < this.trail.length; i++) {
      const p0 = this.trail[i - 1];
      const p1 = this.trail[i];
      if (p1.t - p0.t > 0.2) continue;
      const k = 1 - (t - p1.t) / 1.4;
      ctx.strokeStyle = `rgba(255,255,255,${0.28 * k})`;
      ctx.lineWidth = p1.r * 1.4;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    // 주름: 미리 그려 둔 부드러운 주름 그림. 다린 자리는 지워져 있다.
    this.eraseWrinkles();
    if (this.wrinkle) ctx.drawImage(this.wrinkle, b.x, b.y);
    // 방금 끝낸 구역: 하얀 광택이 번쩍
    for (const z of this.zones) {
      if (z.flash <= 0) continue;
      ctx.fillStyle = `rgba(255,255,255,${(z.flash / 0.6) * 0.45})`;
      ctx.fillRect(z.x, z.y, z.w, z.h);
    }
    // 흐르는 광택
    const sx = b.x + ((t * 220) % (b.w + 600)) - 300;
    const shine = ctx.createLinearGradient(sx - 160, b.y, sx + 160, b.y + b.h);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.14)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fill(this.path);
    // 눌음 자국: 다리미 바닥 모양으로 갈색으로 탄 자리
    for (const s of this.scorches) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.a * 0.2);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, this.ironR * 0.9);
      sg.addColorStop(0, "rgba(70,34,12,0.85)");
      sg.addColorStop(0.6, "rgba(120,62,20,0.55)");
      sg.addColorStop(1, "rgba(160,90,30,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(-this.ironR * 0.85, this.ironR * 0.3);
      ctx.quadraticCurveTo(-this.ironR * 0.75, -this.ironR * 0.25, 0, -this.ironR * 0.45);
      ctx.quadraticCurveTo(this.ironR * 0.75, -this.ironR * 0.5, this.ironR, this.ironR * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // 남은 주름이 적어지면 어디 남았는지 반짝
    if (this.hot && phase === "play" && this.pct() >= 70) {
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      ctx.save();
      ctx.strokeStyle = TONE.gold;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 5;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.arc(this.hot.x, this.hot.y, this.ironR * 1.1 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 완성된 옷: 개켜지며 위로 날아간다
    if (this.fly) {
      const k = Math.min(1, this.fly.t);
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.9;
      ctx.translate(this.fly.cx, this.fly.cy - this.H * 0.6 * k * k);
      ctx.scale(1 - k * 0.7, (1 - k * 0.7) * (1 - Math.sin(k * Math.PI) * 0.4));
      ctx.translate(-this.fly.cx, -this.fly.cy);
      const fb = this.fly.box;
      if (!drawGarmentPhoto(ctx, this.fly.g, fb.x, fb.y, fb.w, fb.h)) {
        ctx.fillStyle = this.fly.color;
        ctx.fill(this.fly.path);
      }
      ctx.restore();
    }

    // 김
    for (const s of this.steamPuffs)
      drawSmoke(ctx, s.x, s.y, 34 + s.t * 80, (1 - s.t) * 0.95, s.vx * 0.02 + s.t * 1.5);

    const R = this.ironR * (this.boost > 0 ? 1.5 : 1);
    // 양손 다림질: 두 다리미를 잇는 금빛 김 줄기
    const on = hands.filter((h) => h.on);
    if (this.pair && on.length >= 2) {
      ctx.save();
      ctx.strokeStyle = TONE.gold;
      ctx.shadowColor = TONE.gold;
      ctx.shadowBlur = 24;
      ctx.lineWidth = 6 + Math.sin(t * 12) * 2;
      ctx.setLineDash([18, 12]);
      ctx.lineDashOffset = -t * 160;
      ctx.beginPath();
      ctx.moveTo(on[0].x, on[0].y);
      ctx.lineTo(on[1].x, on[1].y);
      ctx.stroke();
      ctx.restore();
    }
    hands.forEach((h, hi) => {
      // 눌기 직전: 다리미 밑이 빨갛게 달아오른다
      const lim = SCORCH_AFTER[this.level];
      const warm = lim && h.on ? Math.max(0, this.heat[hi] / lim - 0.35) / 0.65 : 0;
      if (warm > 0) {
        const wg = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, R * 1.3);
        wg.addColorStop(0, `rgba(255,90,60,${0.55 * warm})`);
        wg.addColorStop(1, "rgba(255,90,60,0)");
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(h.x, h.y, R * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
      drawIron(ctx, h, R, t, this.boost > 0 || this.pair);
    });
  }

  stats(): Stat[] {
    return [
      { label: "완성한 옷", value: `${this.finished.length}벌` },
      { label: "마지막 옷", value: `${this.pct()}%` },
      ...(SCORCH_AFTER[this.level] ? [{ label: "눌음 자국", value: `${this.scorchCount}개` }] : []),
    ];
  }

  queue(): QueueItem[] {
    const n = Math.max(ORDER.length, this.gi + 1);
    const out: QueueItem[] = [];
    for (let i = 0; i < n; i++) {
      const g = ORDER[i % ORDER.length];
      out.push({
        label: g.name,
        state: i < this.gi ? "done" : i === this.gi ? "now" : "next",
        pct: i === this.gi ? this.pct() : undefined,
        shape: g.pts,
        aspect: g.aspect,
        color: g.color,
      });
    }
    return out.slice(Math.max(0, this.gi - 2), Math.max(0, this.gi - 2) + 5);
  }

  meter(): Meter {
    return this.boost > 0
      ? { label: "스팀 부스트", value: this.boost / BOOST_SECONDS, text: "다리미 크게!", hot: true }
      : { label: "스팀 게이지", value: this.steam, text: "쉬지 않고 다리면 부스트" };
  }

  collection(): Item[] {
    return this.finished.map((g) => ({
      label: g.name,
      note: g.brand,
      shape: g.pts,
      aspect: g.aspect,
      color: g.color,
    }));
  }

  demo(t: number): DemoHand[] {
    const b = this.box;
    const k = (t * 0.22) % 1;
    // 긴 옷(수트·두루마기)도 위아래 끝까지 펴지게 거의 전체 높이를 오간다
    const y = b.y + b.h * (0.06 + 0.88 * (k < 0.5 ? k * 2 : 2 - k * 2));
    // 시범도 두 손으로: 왼쪽 반, 오른쪽 반을 나눠 다린다
    const s = Math.sin(t * 2.6) * 0.16;
    return [
      { x: b.x + b.w * (0.3 + s), y },
      { x: b.x + b.w * (0.7 - s), y: b.y + b.h - (y - b.y) },
    ];
  }

  target(): DemoHand | null {
    return this.hot;
  }
}

/** 다림판: 한쪽이 뾰족한 긴 판 + 덮개 줄무늬. */
function drawBoard(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const x0 = W * 0.06;
  const x1 = W * 0.94;
  // 옷(높이 0.82H, 가운데 0.52H)이 판 안에 다 들어오게
  const cy = H * 0.52;
  const hh = H * 0.43;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0 + hh * 0.2, cy);
  ctx.bezierCurveTo(x0 + W * 0.08, cy - hh, x0 + W * 0.2, cy - hh, x0 + W * 0.3, cy - hh);
  ctx.lineTo(x1 - 40, cy - hh);
  ctx.quadraticCurveTo(x1, cy - hh, x1, cy - hh + 40);
  ctx.lineTo(x1, cy + hh - 40);
  ctx.quadraticCurveTo(x1, cy + hh, x1 - 40, cy + hh);
  ctx.lineTo(x0 + W * 0.3, cy + hh);
  ctx.bezierCurveTo(x0 + W * 0.2, cy + hh, x0 + W * 0.08, cy + hh, x0 + hh * 0.2, cy);
  ctx.closePath();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  const g = ctx.createLinearGradient(0, cy - hh, 0, cy + hh);
  g.addColorStop(0, "#fbf3e2");
  g.addColorStop(1, "#ead8b6");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  ctx.strokeStyle = "rgba(201,154,59,0.07)";
  ctx.lineWidth = 18;
  for (let x = x0 - H; x < x1 + H; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, cy - hh);
    ctx.lineTo(x + hh * 2, cy + hh);
    ctx.stroke();
  }
  ctx.restore();
  // 금 테두리
  ctx.save();
  ctx.lineWidth = 10;
  const chrome = ctx.createLinearGradient(0, cy - hh, 0, cy + hh);
  chrome.addColorStop(0, "#e6f6ff");
  chrome.addColorStop(0.5, "#8ea0b4");
  chrome.addColorStop(1, "#f2d38a");
  ctx.strokeStyle = chrome;
  ctx.beginPath();
  ctx.moveTo(x0 + hh * 0.2, cy);
  ctx.bezierCurveTo(x0 + W * 0.08, cy - hh, x0 + W * 0.2, cy - hh, x0 + W * 0.3, cy - hh);
  ctx.lineTo(x1 - 40, cy - hh);
  ctx.quadraticCurveTo(x1, cy - hh, x1, cy - hh + 40);
  ctx.lineTo(x1, cy + hh - 40);
  ctx.quadraticCurveTo(x1, cy + hh, x1 - 40, cy + hh);
  ctx.lineTo(x0 + W * 0.3, cy + hh);
  ctx.bezierCurveTo(x0 + W * 0.2, cy + hh, x0 + W * 0.08, cy + hh, x0 + hh * 0.2, cy);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** 왕실 의상실: 자줏빛 다마스크 벽지 + 금테 아치 + 샹들리에 빛 + 위쪽 금 행거에 완성한 옷이 걸린다. */
function drawBoutique(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  done: Garment[],
): void {
  drawPalace(ctx, W, H, t, undefined, "iron");
  drawBoard(ctx, W, H);
  // 금 행거와 완성한 옷(다림판 위에 걸린다)
  const ry = H * 0.075;
  ctx.strokeStyle = "#d4af5f";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(W * 0.08, ry);
  ctx.lineTo(W * 0.92, ry);
  ctx.stroke();
  done.slice(-8).forEach((gm, i) => {
    const x = W * 0.12 + i * W * 0.1;
    const sway = Math.sin(t * 2 + i) * 0.06;
    ctx.save();
    ctx.translate(x, ry);
    ctx.rotate(sway);
    ctx.strokeStyle = "#d4af5f";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-28, 26);
    ctx.lineTo(28, 26);
    ctx.lineTo(0, 12);
    ctx.stroke();
    const h = 74;
    const w = h * gm.aspect;
    ctx.beginPath();
    gm.pts.forEach(([u, v], k) =>
      k ? ctx.lineTo(-w / 2 + u * w, 22 + v * h) : ctx.moveTo(-w / 2 + u * w, 22 + v * h),
    );
    ctx.closePath();
    ctx.fillStyle = gm.color;
    ctx.shadowColor = "#9ff3ff";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
    drawGarmentPhoto(ctx, gm, -w / 2, 22, w, h);
    ctx.restore();
  });
}

/** 다리미 그림. 손 위치가 다리미 바닥 가운데. */
function drawIron(
  ctx: CanvasRenderingContext2D,
  h: Hand,
  R: number,
  t: number,
  boost: boolean,
): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, R * 1.25, boost ? "mint" : "pink");
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(Math.max(-0.25, Math.min(0.25, h.vx / 4000)));
  const img = propImage("iron");
  if (img) {
    // 손 위치 = 다리미 바닥 가운데. 왼쪽으로 밀면 코가 왼쪽을 본다.
    const w = R * 2.8;
    const ih = (w * img.naturalHeight) / img.naturalWidth;
    if (h.vx < -60) ctx.scale(-1, 1);
    ctx.globalAlpha = h.ghost ? 0.75 : 1;
    if (boost) {
      ctx.shadowColor = TONE.mint;
      ctx.shadowBlur = 30;
    }
    ctx.drawImage(img, -w / 2, R * 0.35 - ih, w, ih);
    ctx.restore();
    return;
  }
  const s = R / 90;
  ctx.scale(s, s);
  ctx.globalAlpha = h.ghost ? 0.75 : 1;
  ctx.fillStyle = "#e9edf5";
  ctx.strokeStyle = "#4d4866";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-80, 30);
  ctx.quadraticCurveTo(-70, -20, 0, -40);
  ctx.quadraticCurveTo(70, -45, 90, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const body = ctx.createLinearGradient(-60, -60, 60, 20);
  body.addColorStop(0, boost ? "#c4f4ea" : "#ffd6ea");
  body.addColorStop(1, "#c8b8ff");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-70, 18);
  ctx.quadraticCurveTo(-60, -30, 0, -46);
  ctx.quadraticCurveTo(60, -50, 78, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-40, -40);
  ctx.quadraticCurveTo(-30, -92, 20, -90);
  ctx.lineTo(45, -48);
  ctx.stroke();
  ctx.fillStyle = Math.sin(t * 6) > 0 ? "#ff6fa8" : "#ffb8dc";
  ctx.beginPath();
  ctx.arc(-10, -12, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
