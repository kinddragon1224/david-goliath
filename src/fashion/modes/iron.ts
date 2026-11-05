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
  inside,
  pathOf,
  place,
  toWorld,
  type Garment,
  type Pt,
} from "../garments";

/** 03 다리미 챌린지
 * 세탁소 손님이 맡긴 구겨진 옷을 손 다리미로 쓱쓱 문질러 펴면 지나간 자리만 산뜻해진다.
 * 옷 위를 돌아다니는 구김이를 다리미로 누르면 펑! 터지며 주변 주름이 한 번에 펴진다.
 * 다 펴면 손님이 고마워하고 다음 손님 옷. 감점은 없다.
 * 쉬지 않고 다리면 스팀 게이지가 차고, 가득 차면 4초 동안 '스팀 부스트'(다리미가 커지고 점수 1.5배). */

const ORDER: Garment[] = [LAYOVER, TAILORED, SEOLBAEK, RESTITCH, SILUA, ECO];
const COLS = 28;
const ROWS = 22;
/** 이만큼 펴면 완성. */
const DONE_AT = 0.9;
const GARMENT_POINTS = 1000;
const GARMENT_BONUS = 500;
const BOOST_SECONDS = 4;
/** 주름이 펴지는 빠르기. */
const PRESS = 1.15;
/** 옷마다 맡긴 손님. */
const CUSTOMERS = ["할머니", "꼬마", "신랑", "학생", "사장님", "이웃집"];
const CRITTERS_MAX = 3;
const CRITTER_EVERY = 2;
const CRITTER_POINTS = 300;

/** 옷을 가로 2 × 세로 3 구역으로 나눈다. 구역 주름이 이만큼만 남으면 '띵' 하고 싹 펴진다. */
const ZONE_COLS = 2;
const ZONE_ROWS = 3;
const ZONE_SNAP = 0.15;
const ZONE_BONUS = 100;
/** 구역을 끝낼 때마다 올라가는 '띵' 음(반음). */
const ZONE_LADDER = [0, 2, 4, 7, 9, 12];
/** 안 다린 옷을 덮는 칙칙함. 다린 자리만 걷혀서 진짜 옷색이 드러난다. */
const DULL = "rgba(22,24,34,0.52)";
/** 이만큼 빠르게(초당 무대 폭 비율) 오가야 '쓱!'으로 친다. 웹캠 손 떨림은 안 센다. */
const STROKE_SPEED = 0.22;

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
  seconds = 35;
  hint = "옷 위를 쓱쓱 문질러 주름을 펴요";
  tip = "손이 다리미! 옷 위를 크게 쓱쓱, 구김이는 눌러 잡아요";
  grades: [number, number, number] = [15000, 7500, 2500];
  music = "lofi" as const;
  private critters: { x: number; y: number; vx: number; vy: number; t: number }[] = [];
  private caught = 0;
  private spawnT = 1;
  private thanks: { text: string; t: number } | null = null;
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
  /** 손마다 지금 미는 방향과 마지막 '쓱!' 시각. */
  private dir = [0, 0];
  private strokeAt = [0, 0];
  private strokes = 0;

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
    this.caught = 0;
    this.thanks = null;
    this.dir = [0, 0];
    this.strokeAt = [0, 0];
    this.strokes = 0;
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
    this.critters = [];
    this.spawnT = 1;
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
    x.fillStyle = DULL;
    x.fillRect(b.x, b.y, b.w, b.h);
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
    // 가는 선을 빼고 넓게만: 또렷한 선은 막대기처럼 보인다
    for (const c of some) fold(c, 0, "#0c0e16", [[1.8, 0.07], [1.1, 0.09]]);
    for (const c of some) fold(c, -cw * 0.38, "#ffffff", [[0.9, 0.06], [0.5, 0.06]]);
  }

  /** 펴진 만큼 주름 그림을 지운다(다리미 지나간 자리만 매끈해진다). */
  private eraseWrinkles(): void {
    const x = this.wrinkle?.getContext("2d");
    if (!x) return;
    const b = this.box;
    // 칸 사이에 칙칙함이 점점이 남지 않게 이웃 칸까지 넉넉히
    const r = Math.max(b.w / COLS, b.h / ROWS) * 2;
    x.save();
    x.setTransform(1, 0, 0, 1, -b.x, -b.y);
    x.globalCompositeOperation = "destination-out";
    for (const c of this.cells) {
      if (c.dw - c.w < 0.02 && !(c.w <= 0 && c.dw > 0)) continue;
      // 남은 비율 dw/w0 → w/w0 으로 줄이려면 그만큼의 불투명도로 지운다.
      // 제곱이라 절반만 다려도 3/4이 걷힌다: 지나간 자리가 바로 산뜻해 보이게
      const a = c.dw > 0 ? 1 - (c.w / c.dw) ** 2 : 1;
      c.dw = c.w;
      const gr = x.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(0.7, `rgba(0,0,0,${a})`);
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
      // 크게 오가다 방향을 틀 때마다 '쓱!' 하고 김이 뿜어진다
      const v = Math.abs(h.vx) > Math.abs(h.vy) ? h.vx : h.vy;
      if (h.on && this.onCloth(h) && Math.abs(v) > this.W * STROKE_SPEED) {
        const d = Math.sign(v);
        if (d !== this.dir[hi]) {
          if (this.dir[hi] && t - this.strokeAt[hi] > 0.2) {
            this.strokes++;
            this.strokeAt[hi] = t;
            fx.score(0, h.x, h.y - this.ironR * 1.2, "쓱!", "white");
            for (let k = 0; k < 4; k++)
              this.steamPuffs.push({
                x: h.x + (this.rand() - 0.5) * this.ironR,
                y: h.y,
                t: 0,
                vx: (this.rand() - 0.5) * 180 - d * 90,
              });
            fx.sfx("steam");
          }
          this.dir[hi] = d;
        }
      }
    });
    for (const h of hands) {
      if (!h.on) continue;
      // 움직여야 펴진다. 가만히 대고 있으면 아주 조금만.
      const move = Math.min(1, h.speed / (this.W * 0.45));
      const rate = (0.3 + 4.4 * move) * dt * PRESS;
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
    this.stepCritters(dt, hands, R, fx);
    if (this.thanks) {
      this.thanks.t -= dt;
      if (this.thanks.t <= 0) this.thanks = null;
    }

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
      fx.burst(zx, zy, 40, "mint");
      fx.shake(0.12);
      fx.sfx("good", ZONE_LADDER[this.zones.filter((q) => q.done).length - 1]);
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
        // 다림판 아래에서 김이 확 올라온다
        const b = this.box;
        for (let k = 0; k < 18; k++)
          this.steamPuffs.push({
            x: b.x + this.rand() * b.w,
            y: b.y + b.h,
            t: this.rand() * 0.2,
            vx: (this.rand() - 0.5) * 120,
          });
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
      fx.celebrate(`${this.customer()} 손님 옷 완성!`, "pink");
      this.thanks = { text: `${this.customer()} 손님: 고마워요!`, t: 1.8 };
      fx.sfx("complete");
      fx.hitstop(0.16);
      fx.shake(0.6);
      // 옷 윤곽을 따라 반짝
      this.pts.forEach(([x, y], i) => {
        if (i % 3 === 0) fx.burst(x, y, 3, "white");
      });
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
          : this.critters.length
            ? `구김이다! 다리미로 눌러 잡아요 · ${p}%`
            : p >= 75
              ? `반짝이는 곳에 주름이 남았어요 · ${p}%`
              : `옷 위를 쓱쓱 문질러요 · ${p}%`;
  }

  private customer(): string {
    return CUSTOMERS[this.gi % CUSTOMERS.length];
  }

  /** 구김이: 남은 주름 위에 나타나 옷 위를 돌아다닌다. 다리미에 닿으면 주변 주름과 함께 펑! */
  private stepCritters(dt: number, hands: Hand[], R: number, fx: Fx): void {
    const b = this.box;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.critters.length < CRITTERS_MAX) {
      this.spawnT = CRITTER_EVERY;
      const left = this.cells.filter((c) => c.w > 0.2);
      const c = left[Math.floor(this.rand() * left.length)];
      if (c) {
        const a = this.rand() * Math.PI * 2;
        const v = this.W * 0.07;
        this.critters.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0 });
      }
    }
    this.critters = this.critters.filter((k) => {
      k.t += dt;
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (k.x < b.x + b.w * 0.12 || k.x > b.x + b.w * 0.88) k.vx *= -1;
      if (k.y < b.y + b.h * 0.1 || k.y > b.y + b.h * 0.9) k.vy *= -1;
      if (!hands.some((h) => h.on && Math.hypot(h.x - k.x, h.y - k.y) < R + this.ironR * 0.45))
        return true;
      const area = this.ironR * 1.2;
      for (const c of this.cells) if (Math.hypot(c.x - k.x, c.y - k.y) < area) c.w = 0;
      this.caught++;
      fx.score(CRITTER_POINTS, k.x, k.y - this.ironR, `구김이 잡았다! +${CRITTER_POINTS}`, "gold");
      fx.burst(k.x, k.y, 26, "gold");
      fx.shake(0.2);
      fx.sfx("perfect");
      for (let i = 0; i < 6; i++)
        this.steamPuffs.push({
          x: k.x + (this.rand() - 0.5) * area,
          y: k.y,
          t: 0,
          vx: (this.rand() - 0.5) * 140,
        });
      return false;
    });
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
      ctx.strokeStyle = `rgba(255,255,255,${0.12 * k})`;
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

    for (const k of this.critters) drawCritter(ctx, k.x, k.y, this.ironR * 0.62, t + k.t);
    drawProgress(ctx, this.W * 0.87, this.H * 0.5, this.H * 0.095, this.pct());
    drawOrder(
      ctx,
      this.W / 2,
      this.H * 0.055,
      this.H * 0.034,
      this.thanks?.text ?? `${this.customer()} 손님 옷의 주름을 펴 주세요`,
      !!this.thanks,
    );

    // 완성된 옷: 개켜지며 위로 날아간다
    if (this.fly) {
      const k = Math.min(1, this.fly.t);
      ctx.save();
      ctx.globalAlpha = 1 - k * 0.9;
      ctx.translate(this.fly.cx, this.fly.cy - this.H * 0.6 * k * k);
      ctx.scale(1 - k * 0.7, (1 - k * 0.7) * (1 - Math.sin(k * Math.PI) * 0.4));
      ctx.translate(-this.fly.cx, -this.fly.cy);
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 50;
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
    for (const h of hands) drawIron(ctx, h, R, t, this.boost > 0 || this.pair);
  }

  stats(): Stat[] {
    return [
      { label: "완성한 옷", value: `${this.finished.length}벌` },
      { label: "마지막 옷", value: `${this.pct()}%` },
      { label: "쓱쓱", value: `${this.strokes}번` },
      { label: "잡은 구김이", value: `${this.caught}마리` },
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
    return this.critters[0] ?? this.hot;
  }
}

/** 구김이: 구겨진 천 뭉치 얼굴. */
function drawCritter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  t: number,
): void {
  const bob = Math.sin(t * 9) * r * 0.1;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "#8f97ad";
  ctx.strokeStyle = "#2a2f42";
  ctx.lineWidth = 5;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rr = r * (i % 2 ? 0.86 : 1.08 + Math.sin(t * 6 + i) * 0.05);
    if (i) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.stroke();
  ctx.strokeStyle = "rgba(42,47,66,0.45)";
  ctx.lineWidth = 3;
  for (const dx of [-0.5, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(r * dx, -r * 0.72);
    ctx.lineTo(r * (dx + 0.14), -r * 0.42);
    ctx.stroke();
  }
  for (const dx of [-0.32, 0.32]) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(r * dx, -r * 0.08, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b1526";
    ctx.beginPath();
    ctx.arc(r * dx, -r * 0.05, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "#1b1526";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, r * 0.28, r * 0.24, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

/** 위쪽 손님 주문표. */
function drawOrder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  text: string,
  happy: boolean,
): void {
  ctx.save();
  ctx.font = `700 ${Math.round(size)}px "Gowun Batang", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + size * 2;
  ctx.fillStyle = happy ? "#ffd34d" : "#fff9ec";
  ctx.strokeStyle = "#2a2238";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 0.95, w, size * 1.9, size * 0.9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2a2238";
  ctx.fillText(text, x, y + 2);
  ctx.restore();
}

/** 지금 옷을 얼마나 폈는지 큰 고리. */
function drawProgress(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  pct: number,
): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.2;
  ctx.fillStyle = "rgba(8,10,16,0.75)";
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = TONE.gold;
  ctx.shadowColor = TONE.gold;
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + (pct / 100) * Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(r * 0.72)}px "Gowun Batang", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${pct}%`, x, y + 2);
  ctx.restore();
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
  g.addColorStop(0, "#2a3040");
  g.addColorStop(1, "#12161f");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  ctx.strokeStyle = "rgba(200,235,255,0.05)";
  ctx.lineWidth = 18;
  for (let x = x0 - H; x < x1 + H; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, cy - hh);
    ctx.lineTo(x + hh * 2, cy + hh);
    ctx.stroke();
  }
  ctx.restore();
  // 은 테두리
  ctx.save();
  ctx.lineWidth = 10;
  const chrome = ctx.createLinearGradient(0, cy - hh, 0, cy + hh);
  chrome.addColorStop(0, "#e6f6ff");
  chrome.addColorStop(0.5, "#8ea0b4");
  chrome.addColorStop(1, "#c3cfdc");
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

/** 의상실: 벽 그림 + 검은 다림판 + 위쪽 은 행거에 완성한 옷이 걸린다. */
function drawBoutique(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  done: Garment[],
): void {
  drawPalace(ctx, W, H, t, undefined, "iron");
  drawBoard(ctx, W, H);
  // 은 행거와 완성한 옷(다림판 위에 걸린다)
  const ry = H * 0.075;
  ctx.strokeStyle = "#c3cfdc";
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
    ctx.strokeStyle = "#c3cfdc";
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
