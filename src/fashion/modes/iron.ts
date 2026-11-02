import {
  drawHandGlow,
  fabricTexture,
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
  DRESS,
  JACKET,
  PANTS,
  SHIRT,
  SKIRT,
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

const ORDER: Garment[] = [SHIRT, SKIRT, DRESS, PANTS, JACKET];
const COLS = 28;
const ROWS = 22;
/** 이만큼 펴면 완성. */
const DONE_AT = 0.9;
const GARMENT_POINTS = 1000;
const GARMENT_BONUS = 500;
const BOOST_SECONDS = 4;

type Cell = { x: number; y: number; w: number; a: number; len: number };
type Trail = { x: number; y: number; t: number; r: number };

export class IronMode implements Mode {
  seconds = 30;
  hint = "손을 옷 위로 쓱쓱! 다리미로 주름을 펴요";
  tip = "손바닥을 펴고 옷 위를 크게 쓱쓱 문질러요";
  grades: [number, number, number] = [5200, 3600, 2000];
  music = "lofi" as const;
  private W = 1400;
  private H = 860;
  private gi = 0;
  private pts: Pt[] = [];
  private path = new Path2D();
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private cells: Cell[] = [];
  private total = 0;
  private finished: Garment[] = [];
  private fly: { path: Path2D; color: string; t: number; cx: number; cy: number } | null = null;
  private trail: Trail[] = [];
  private steamPuffs: { x: number; y: number; t: number; vx: number }[] = [];
  private rand = rng(7);
  private ironR = 80;
  private earned = 0;
  private steam = 0;
  private boost = 0;
  private hot: DemoHand | null = null;
  private hotT = 0;
  private time = 0;

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
    this.rand = rng(7);
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
        this.cells.push({
          x,
          y,
          w: 0.75 + this.rand() * 0.25,
          a: flow + (this.rand() - 0.5) * 0.5,
          len: 0.5 + this.rand() * 0.7,
        });
      }
    }
    this.total = this.cells.reduce((s, c) => s + c.w, 0);
    this.earned = 0;
    this.hot = null;
    this.hotT = 0;
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
    let ironing = false;
    for (const h of hands) {
      if (!h.on) continue;
      // 움직여야 펴진다. 가만히 대고 있으면 아주 조금만.
      const move = Math.min(1, h.speed / (this.W * 0.45));
      const rate = (0.3 + 4.4 * move) * dt;
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

    // 스팀 게이지
    if (this.boost <= 0) {
      this.steam = ironing
        ? Math.min(1, this.steam + dt * 0.3)
        : Math.max(0, this.steam - dt * 0.2);
      if (this.steam >= 1) {
        this.steam = 0;
        this.boost = BOOST_SECONDS;
        const h = hands.find((x) => x.on);
        fx.score(0, h?.x ?? this.W / 2, (h?.y ?? this.H / 2) - 60, "스팀 부스트!", "mint");
        fx.sfx("perfect");
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
      fx.celebrate(`${g.name} 완성!`, "pink");
      fx.sfx("complete");
      this.finished.push(g);
      this.fly = {
        path: this.path,
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
        : p >= 75
          ? `${this.garment().name} ${p}% · 반짝이는 남은 주름을 찾아요!`
          : `${this.garment().name} 주름 펴기 ${p}% · 쓱쓱 크게 문질러요`;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], phase: Phase): void {
    const g = this.garment();
    drawBoard(ctx, this.W, this.H);

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
    // 주름: 천의 결을 따라 흐르는 골(어두운 선)과 등성이(밝은 선)
    const cw = b.w / COLS;
    for (const c of this.cells) {
      if (c.w < 0.05) continue;
      const L = cw * 1.25 * c.len;
      const dx = Math.cos(c.a) * L;
      const dy = Math.sin(c.a) * L;
      const a = Math.min(1, c.w);
      ctx.strokeStyle = g.shade;
      ctx.globalAlpha = a * 0.55;
      ctx.lineWidth = cw * 0.26;
      ctx.beginPath();
      ctx.moveTo(c.x - dx, c.y - dy);
      ctx.lineTo(c.x + dx, c.y + dy);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = a * 0.6;
      ctx.lineWidth = cw * 0.12;
      ctx.beginPath();
      ctx.moveTo(c.x - dx - dy * 0.14, c.y - dy + dx * 0.14);
      ctx.lineTo(c.x + dx - dy * 0.14, c.y + dy + dx * 0.14);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 흐르는 광택
    const sx = b.x + ((t * 220) % (b.w + 600)) - 300;
    const shine = ctx.createLinearGradient(sx - 160, b.y, sx + 160, b.y + b.h);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.14)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fill(this.path);
    ctx.restore();
    ctx.strokeStyle = g.shade;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 9]);
    ctx.stroke(this.path);
    ctx.setLineDash([]);

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
      ctx.fillStyle = this.fly.color;
      ctx.fill(this.fly.path);
      ctx.restore();
    }

    // 김
    for (const s of this.steamPuffs) {
      ctx.globalAlpha = (1 - s.t) * 0.45;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 16 + s.t * 36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const R = this.ironR * (this.boost > 0 ? 1.5 : 1);
    for (const h of hands) drawIron(ctx, h, R, t, this.boost > 0);
  }

  stats(): Stat[] {
    return [
      { label: "완성한 옷", value: `${this.finished.length}벌` },
      { label: "마지막 옷", value: `${this.pct()}%` },
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
      shape: g.pts,
      aspect: g.aspect,
      color: g.color,
    }));
  }

  demo(t: number): DemoHand[] {
    const b = this.box;
    const k = (t * 0.22) % 1;
    const y = b.y + b.h * (0.15 + 0.7 * (k < 0.5 ? k * 2 : 2 - k * 2));
    return [{ x: b.x + b.w * (0.5 + Math.sin(t * 2.6) * 0.32), y }];
  }

  target(): DemoHand | null {
    return this.hot;
  }
}

/** 다림판: 한쪽이 뾰족한 긴 판 + 덮개 줄무늬. */
function drawBoard(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const x0 = W * 0.06;
  const x1 = W * 0.94;
  const cy = H * 0.53;
  const hh = H * 0.33;
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
  g.addColorStop(0, "#3a3150");
  g.addColorStop(1, "#2a2340");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 18;
  for (let x = x0 - H; x < x1 + H; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, cy - hh);
    ctx.lineTo(x + hh * 2, cy + hh);
    ctx.stroke();
  }
  ctx.restore();
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
