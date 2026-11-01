import {
  drawHandGlow,
  fabricTexture,
  rng,
  type Fx,
  type Hand,
  type Mode,
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

/** 03 다리미 챌린지: 손이 다리미. 옷 위를 쓱쓱 문질러 주름을 펴면 다음 옷. */

const ORDER: Garment[] = [SHIRT, SKIRT, DRESS, PANTS, JACKET];
const COLS = 30;
const ROWS = 22;
/** 이만큼 펴면 완성. */
const DONE_AT = 0.9;
const GARMENT_BONUS = 500;

type Cell = { x: number; y: number; w: number; a: number; len: number };

export class IronMode implements Mode {
  seconds = 30;
  hint = "손을 옷 위로 쓱쓱! 다리미로 주름을 펴요";
  grades: [number, number, number] = [5200, 3600, 2000];
  private W = 1920;
  private H = 1080;
  private gi = 0;
  private pts: Pt[] = [];
  private path = new Path2D();
  private cells: Cell[] = [];
  private total = 0;
  private finished = 0;
  private flyT = -1;
  private flyPath: Path2D | null = null;
  private flyColor = "";
  private smoothed = 0;
  private steam: { x: number; y: number; t: number; vx: number }[] = [];
  private rand = rng(7);
  private ironR = 90;
  private earned = 0;

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.gi = 0;
    this.finished = 0;
    this.smoothed = 0;
    this.flyT = -1;
    this.steam = [];
    this.rand = rng(7);
    this.ironR = Math.min(W, H) * 0.085;
    this.load();
  }

  private load(): void {
    const g = ORDER[this.gi % ORDER.length];
    const p = place(g, this.W / 2, this.H * 0.54, this.W * 0.56, this.H * 0.74);
    this.pts = toWorld(g, p);
    this.path = pathOf(this.pts);
    this.cells = [];
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const x = p.x + ((i + 0.5) / COLS) * p.w;
        const y = p.y + ((j + 0.5) / ROWS) * p.h;
        if (!inside(this.pts, x, y)) continue;
        // 결이 흐르듯 이웃 주름끼리 비슷한 방향
        const flow = Math.sin(x * 0.006 + this.gi) * 1.1 + Math.cos(y * 0.008) * 0.8;
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
  }

  private garment(): Garment {
    return ORDER[this.gi % ORDER.length];
  }

  private remaining(): number {
    return this.cells.reduce((s, c) => s + c.w, 0);
  }

  update(dt: number, _t: number, hands: Hand[], fx: Fx): void {
    for (const s of this.steam) {
      s.t += dt;
      s.y -= 160 * dt;
      s.x += s.vx * dt;
    }
    this.steam = this.steam.filter((s) => s.t < 1);
    if (this.flyT >= 0) {
      this.flyT += dt;
      if (this.flyT > 0.9) {
        this.flyT = -1;
        this.flyPath = null;
      }
    }

    const R = this.ironR;
    for (const h of hands) {
      if (!h.on) continue;
      // 움직여야 펴진다. 가만히 대고 있으면 아주 조금만.
      const move = Math.min(1, h.speed / (this.W * 0.5));
      const rate = (0.35 + 4.2 * move) * dt;
      let removed = 0;
      for (const c of this.cells) {
        if (c.w <= 0) continue;
        const d = Math.hypot(c.x - h.x, c.y - h.y);
        if (d > R) continue;
        const k = rate * (1 - (d / R) * 0.5);
        const take = Math.min(c.w, k);
        c.w -= take;
        removed += take;
      }
      if (removed > 0) {
        const pts = (removed / this.total) * 1000;
        this.earned += pts;
        this.smoothed += removed;
        fx.score(pts, h.x, h.y);
        if (move > 0.15 && this.rand() < dt * 18) {
          this.steam.push({
            x: h.x + (this.rand() - 0.5) * R,
            y: h.y - R * 0.3,
            t: 0,
            vx: (this.rand() - 0.5) * 60,
          });
          fx.sound.play("steam");
        }
      }
    }

    const left = this.remaining() / Math.max(1e-6, this.total);
    if (left <= 1 - DONE_AT) {
      // 남은 주름도 마저 점수로
      fx.score(
        Math.max(0, 1000 - this.earned) + GARMENT_BONUS,
        this.W / 2,
        this.H * 0.45,
        `${this.garment().name} 완성! +${GARMENT_BONUS}`,
        "pink",
      );
      fx.burst(this.W / 2, this.H * 0.5, 40, "pink");
      fx.sound.play("complete");
      this.finished++;
      this.flyPath = this.path;
      this.flyColor = this.garment().color;
      this.flyT = 0;
      this.gi++;
      this.load();
    }
    const pct = Math.round((1 - left) * 100);
    this.hint = `${this.garment().name} 주름 펴기 ${Math.min(100, Math.round((pct / (DONE_AT * 100)) * 100))}% · 쓱쓱 문질러요!`;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[]): void {
    const g = this.garment();
    // 다림판
    ctx.save();
    const bx = this.W / 2;
    const by = this.H * 0.54;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.ellipse(bx, by, this.W * 0.34, this.H * 0.43, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 옷
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = g.color;
    ctx.fill(this.path);
    ctx.restore();
    ctx.save();
    ctx.clip(this.path);
    const xs = this.pts.map((p) => p[0]);
    const ys = this.pts.map((p) => p[1]);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    fabricTexture(ctx, x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0, g.shade);
    // 주름: 천의 결을 따라 흐르는 부드러운 골(어두운 선)과 등성이(밝은 선)
    const cw = (Math.max(...xs) - x0) / COLS;
    ctx.lineCap = "round";
    for (const c of this.cells) {
      if (c.w < 0.05) continue;
      const L = cw * 1.25 * c.len;
      const dx = Math.cos(c.a) * L;
      const dy = Math.sin(c.a) * L;
      const a = Math.min(1, c.w);
      ctx.strokeStyle = g.shade;
      ctx.globalAlpha = a * 0.5;
      ctx.lineWidth = cw * 0.24;
      ctx.beginPath();
      ctx.moveTo(c.x - dx, c.y - dy);
      ctx.lineTo(c.x + dx, c.y + dy);
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = a * 0.55;
      ctx.lineWidth = cw * 0.12;
      ctx.beginPath();
      ctx.moveTo(c.x - dx - dy * 0.12, c.y - dy + dx * 0.12);
      ctx.lineTo(c.x + dx - dy * 0.12, c.y + dy + dx * 0.12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 펴진 곳 반짝임
    const shine = ctx.createLinearGradient(x0, y0, x0 + 400, y0 + 400);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, `rgba(255,255,255,${0.12 + Math.sin(t * 2) * 0.05})`);
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fill(this.path);
    ctx.restore();
    ctx.strokeStyle = g.shade;
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.stroke(this.path);
    ctx.setLineDash([]);

    // 완성된 옷이 날아간다
    if (this.flyPath && this.flyT >= 0) {
      const k = this.flyT / 0.9;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(this.W * 0.42 * k * k, -this.H * 0.5 * k);
      ctx.translate(this.W / 2, this.H / 2);
      ctx.scale(1 - k * 0.5, 1 - k * 0.5);
      ctx.translate(-this.W / 2, -this.H / 2);
      ctx.fillStyle = this.flyColor;
      ctx.fill(this.flyPath);
      ctx.restore();
    }

    // 김
    for (const s of this.steam) {
      ctx.globalAlpha = (1 - s.t) * 0.5;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, 18 + s.t * 40, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const h of hands) drawIron(ctx, h, this.ironR, t);
  }

  stats(): Stat[] {
    const pct = this.total > 0 ? Math.round((1 - this.remaining() / this.total) * 100) : 0;
    return [
      { label: "완성한 옷", value: `${this.finished}벌` },
      { label: "마지막 옷", value: `${Math.min(100, Math.round((pct / (DONE_AT * 100)) * 100))}%` },
    ];
  }
}

/** 다리미 그림. 손 위치가 다리미 바닥 가운데. */
function drawIron(ctx: CanvasRenderingContext2D, h: Hand, R: number, t: number): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, R * 1.25, "pink");
  ctx.save();
  ctx.translate(h.x, h.y);
  const tilt = Math.max(-0.25, Math.min(0.25, h.vx / 4000));
  ctx.rotate(tilt);
  const s = R / 90;
  ctx.scale(s, s);
  // 바닥판
  ctx.fillStyle = "#e9edf5";
  ctx.strokeStyle = "#5b5670";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-80, 30);
  ctx.quadraticCurveTo(-70, -20, 0, -40);
  ctx.quadraticCurveTo(70, -45, 90, 30);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 몸통
  const body = ctx.createLinearGradient(-60, -60, 60, 20);
  body.addColorStop(0, "#ffd6ea");
  body.addColorStop(1, "#c8b8ff");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-70, 18);
  ctx.quadraticCurveTo(-60, -30, 0, -46);
  ctx.quadraticCurveTo(60, -50, 78, 18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 손잡이
  ctx.lineWidth = 12;
  ctx.strokeStyle = "#5b5670";
  ctx.beginPath();
  ctx.moveTo(-40, -40);
  ctx.quadraticCurveTo(-30, -92, 20, -90);
  ctx.lineTo(45, -48);
  ctx.stroke();
  // 불빛
  ctx.fillStyle = Math.sin(t * 6) > 0 ? "#ff6fa8" : "#ffb8dc";
  ctx.beginPath();
  ctx.arc(-10, -12, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
