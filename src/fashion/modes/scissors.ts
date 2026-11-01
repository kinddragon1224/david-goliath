import { drawHandGlow, fabricTexture, type Fx, type Hand, type Mode, type Stat } from "../core";
import {
  DRESS,
  JACKET,
  PANTS,
  SHIRT,
  SKIRT,
  pathOf,
  place,
  resample,
  toWorld,
  type Garment,
  type Pt,
} from "../garments";

/** 04 가위질 챌린지: 손이 가위. 옷본 점선을 따라 한 바퀴 오리면 완성. */

const ORDER: Garment[] = [SKIRT, SHIRT, PANTS, DRESS, JACKET];
const PIECE_BONUS = 600;

export class ScissorsMode implements Mode {
  seconds = 40;
  hint = "가위 손을 빛나는 점에 대고 점선을 따라가요";
  grades: [number, number, number] = [3600, 2400, 1300];
  private W = 1920;
  private H = 1080;
  private gi = 0;
  private garment: Garment = SKIRT;
  private pts: Pt[] = [];
  private outline = new Path2D();
  private path: Pt[] = [];
  private cut = 0;
  private tol = 70;
  private step = 14;
  private finished = 0;
  private onLine = 0;
  private offLine = 0;
  private snipT = 0;
  private fall: { path: Path2D; color: string; t: number } | null = null;
  private lastSnip = 0;
  private activeHand = -1;

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.gi = 0;
    this.finished = 0;
    this.onLine = 0;
    this.offLine = 0;
    this.fall = null;
    this.tol = Math.min(W, H) * 0.075;
    this.step = Math.min(W, H) * 0.013;
    this.load();
  }

  private load(): void {
    this.garment = ORDER[this.gi % ORDER.length];
    const p = place(this.garment, this.W / 2, this.H * 0.52, this.W * 0.5, this.H * 0.66);
    this.pts = toWorld(this.garment, p);
    this.outline = pathOf(this.pts);
    this.path = resample(this.pts, this.step);
    this.cut = 0;
    this.activeHand = -1;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.snipT = Math.max(0, this.snipT - dt);
    if (this.fall) {
      this.fall.t += dt;
      if (this.fall.t > 1.2) this.fall = null;
    }
    const n = this.path.length;
    const look = Math.ceil((this.tol * 2.2) / this.step);
    let best = this.cut;
    let bestHand = -1;
    hands.forEach((h, hi) => {
      if (!h.on) return;
      // 지금 자를 곳 근처에 손이 있어야 앞으로 나간다
      const [cx, cy] = this.path[this.cut % n];
      if (Math.hypot(cx - h.x, cy - h.y) > this.tol * 1.6) return;
      for (let k = 1; k <= look && this.cut + k <= n; k++) {
        const [x, y] = this.path[(this.cut + k) % n];
        if (Math.hypot(x - h.x, y - h.y) <= this.tol && this.cut + k > best) {
          best = this.cut + k;
          bestHand = hi;
        }
      }
    });
    if (best > this.cut) {
      const adv = best - this.cut;
      this.cut = best;
      this.activeHand = bestHand;
      this.onLine += dt;
      const h = hands[bestHand];
      fx.score(adv * 4, h.x, h.y);
      this.snipT = 0.18;
      if (t - this.lastSnip > 0.16) {
        fx.sound.play("snip");
        this.lastSnip = t;
      }
    } else if (hands.some((h) => h.on)) {
      this.offLine += dt;
    }

    if (this.cut >= n) {
      fx.score(
        PIECE_BONUS,
        this.W / 2,
        this.H * 0.45,
        `${this.garment.name} 패턴 완성! +${PIECE_BONUS}`,
        "mint",
      );
      fx.burst(this.W / 2, this.H * 0.5, 40, "mint");
      fx.sound.play("complete");
      this.fall = { path: this.outline, color: this.garment.color, t: 0 };
      this.finished++;
      this.gi++;
      this.load();
    }
    const pct = Math.floor((this.cut / n) * 100);
    this.hint = `${this.garment.name} 오리기 ${pct}% · 빛나는 점을 따라 천천히!`;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[]): void {
    // 원단(사각 천)
    const fx0 = this.W * 0.2;
    const fy0 = this.H * 0.1;
    const fw = this.W * 0.6;
    const fh = this.H * 0.86;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#2b2540";
    ctx.fillRect(fx0, fy0, fw, fh);
    ctx.restore();
    fabricTexture(ctx, fx0, fy0, fw, fh, "#ffffff");
    // 옷본 조각
    ctx.fillStyle = this.garment.color;
    ctx.globalAlpha = 0.92;
    ctx.fill(this.outline);
    ctx.globalAlpha = 1;
    fabricTexture(ctx, fx0, fy0, fw, fh, this.garment.shade);

    // 점선(남은 길) + 실선(자른 길)
    const n = this.path.length;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2a2238";
    ctx.lineWidth = 6;
    ctx.setLineDash([16, 14]);
    ctx.beginPath();
    for (let i = this.cut; i <= n; i++) {
      const [x, y] = this.path[i % n];
      if (i === this.cut) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (this.cut > 0) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 9;
      ctx.shadowColor = "#a8f0e0";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      for (let i = 0; i <= this.cut; i++) {
        const [x, y] = this.path[i % n];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    // 다음 갈 곳: 빛나는 점과 화살표
    const [cx, cy] = this.path[this.cut % n];
    const ahead = this.path[(this.cut + Math.ceil(this.tol / this.step)) % n];
    const pulse = 1 + Math.sin(t * 6) * 0.15;
    ctx.fillStyle = "rgba(168,240,224,0.25)";
    ctx.beginPath();
    ctx.arc(cx, cy, this.tol * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#a8f0e0";
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    const a = Math.atan2(ahead[1] - cy, ahead[0] - cx);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * this.tol * 1.2, cy + Math.sin(a) * this.tol * 1.2);
    ctx.rotate(a);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-10, -16);
    ctx.lineTo(-10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 다 오린 조각이 떨어진다
    if (this.fall) {
      const k = this.fall.t / 1.2;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(0, this.H * 0.6 * k * k);
      ctx.translate(this.W / 2, this.H / 2);
      ctx.rotate(k * 0.4);
      ctx.translate(-this.W / 2, -this.H / 2);
      ctx.fillStyle = this.fall.color;
      ctx.fill(this.fall.path);
      ctx.restore();
    }

    hands.forEach((h, i) => drawScissors(ctx, h, this.tol, i === this.activeHand ? this.snipT : 0));
  }

  stats(): Stat[] {
    const total = this.onLine + this.offLine;
    const acc = total > 0 ? Math.round((this.onLine / total) * 100) : 0;
    return [
      { label: "완성한 패턴", value: `${this.finished}개` },
      { label: "선 따라가기", value: `${Math.min(100, acc)}%` },
    ];
  }
}

function drawScissors(ctx: CanvasRenderingContext2D, h: Hand, R: number, snip: number): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, R * 1.1, "mint");
  ctx.save();
  ctx.translate(h.x, h.y);
  const s = R / 70;
  ctx.scale(s, s);
  const open = 0.32 - (snip > 0 ? 0.28 * Math.sin((snip / 0.18) * Math.PI) : 0);
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.rotate(sign * open - Math.PI / 2);
    // 날
    ctx.fillStyle = "#eef2f8";
    ctx.strokeStyle = "#4d4866";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-70, -2);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 손잡이 고리
    ctx.lineWidth = 10;
    ctx.strokeStyle = sign < 0 ? "#ffb8dc" : "#c8b8ff";
    ctx.beginPath();
    ctx.ellipse(34, sign * 12, 20, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = "#4d4866";
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
