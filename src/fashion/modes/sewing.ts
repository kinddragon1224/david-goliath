import { drawHandGlow, fabricTexture, type Fx, type Hand, type Mode, type Stat } from "../core";
import { DRESS, SHIRT, SKIRT, pathOf, place, toWorld, type Garment } from "../garments";

/** 05 바느질 챌린지: 손이 바늘. 반짝이는 바늘구멍을 차례로 콕콕 찍으면 실이 따라온다.
 * 빨리 이어서 찍을수록 콤보. 한 줄(솔기)을 다 꿰매면 다음 솔기. */

type Seam = {
  name: string;
  garment: Garment;
  line: (k: number, W: number, H: number) => [number, number];
};

const SEAMS: Seam[] = [
  {
    name: "밑단",
    garment: SKIRT,
    line: (k, W, H) => [W * (0.2 + 0.6 * k), H * (0.66 + Math.sin(k * Math.PI * 2) * 0.05)],
  },
  {
    name: "브이넥",
    garment: SHIRT,
    line: (k, W, H) => [W * (0.31 + 0.38 * k), H * (0.26 + (1 - Math.abs(k * 2 - 1)) * 0.4)],
  },
  {
    name: "단추 둘레",
    garment: DRESS,
    line: (k, W, H) => [
      W / 2 + Math.cos(k * Math.PI * 2 - Math.PI / 2) * H * 0.3,
      H * 0.54 + Math.sin(k * Math.PI * 2 - Math.PI / 2) * H * 0.3,
    ],
  },
  {
    name: "옆선",
    garment: SHIRT,
    line: (k, W, H) => [W * (0.5 + Math.sin(k * Math.PI * 3) * 0.16), H * (0.16 + 0.72 * k)],
  },
];
const HOLES = 10;
const SEAM_BONUS = 400;
const COMBO_GAP = 1.6;

type Hole = { x: number; y: number; done: boolean };

export class SewingMode implements Mode {
  seconds = 30;
  hint = "바늘 손으로 반짝이는 구멍을 콕! 차례대로 꿰매요";
  grades: [number, number, number] = [8000, 5500, 3000];
  private W = 1920;
  private H = 1080;
  private si = 0;
  private holes: Hole[] = [];
  private next = 0;
  private tol = 70;
  private combo = 0;
  private maxCombo = 0;
  private lastHit = -10;
  private stitches = 0;
  private seams = 0;
  private flash = 0;
  private time = 0;
  private needleHand = 0;

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.si = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stitches = 0;
    this.seams = 0;
    this.lastHit = -10;
    this.tol = Math.min(W, H) * 0.075;
    this.load();
  }

  private seam(): Seam {
    return SEAMS[this.si % SEAMS.length];
  }

  private load(): void {
    const s = this.seam();
    this.holes = [];
    const off = Math.min(this.W, this.H) * 0.06;
    for (let i = 0; i < HOLES; i++) {
      const k = i / (HOLES - 1);
      const [x, y] = s.line(k, this.W, this.H);
      const [x2, y2] = s.line(Math.min(1, k + 0.01), this.W, this.H);
      const [x1, y1] = s.line(Math.max(0, k - 0.01), this.W, this.H);
      let nx = -(y2 - y1);
      let ny = x2 - x1;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      const sign = i % 2 ? 1 : -1;
      this.holes.push({ x: x + nx * off * sign, y: y + ny * off * sign, done: false });
    }
    this.next = 0;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.time = t;
    this.flash = Math.max(0, this.flash - dt);
    if (t - this.lastHit > COMBO_GAP && this.combo > 0) this.combo = 0;
    const hole = this.holes[this.next];
    if (!hole) return;
    hands.forEach((h, hi) => {
      if (!h.on || hole.done) return;
      if (Math.hypot(h.x - hole.x, h.y - hole.y) > this.tol) return;
      hole.done = true;
      this.needleHand = hi;
      const quick = t - this.lastHit <= COMBO_GAP;
      this.combo = quick ? this.combo + 1 : 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.lastHit = t;
      this.stitches++;
      this.flash = 0.25;
      const pts = 100 + Math.min(10, this.combo - 1) * 20;
      fx.score(
        pts,
        hole.x,
        hole.y,
        this.combo >= 3 ? `${this.combo}콤보 +${pts}` : `+${pts}`,
        this.combo >= 3 ? "gold" : "white",
      );
      fx.burst(hole.x, hole.y, 8, "gold");
      fx.sound.play("stitch");
      this.next++;
    });
    if (this.next >= this.holes.length) {
      fx.score(
        SEAM_BONUS,
        this.W / 2,
        this.H * 0.4,
        `${this.seam().name} 완성! +${SEAM_BONUS}`,
        "pink",
      );
      fx.burst(this.W / 2, this.H * 0.45, 40, "pink");
      fx.sound.play("complete");
      this.seams++;
      this.si++;
      this.load();
    }
    this.hint = `${this.seam().name} 꿰매기 ${this.next}/${HOLES}${this.combo >= 2 ? ` · ${this.combo}콤보!` : " · 빛나는 구멍을 콕!"}`;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[]): void {
    const s = this.seam();
    // 바탕 옷
    const p = place(s.garment, this.W / 2, this.H * 0.54, this.W * 0.62, this.H * 0.86);
    const pts = toWorld(s.garment, p);
    const path = pathOf(pts);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = s.garment.color;
    ctx.fill(path);
    ctx.restore();
    ctx.save();
    ctx.clip(path);
    fabricTexture(ctx, p.x, p.y, p.w, p.h, s.garment.shade);
    ctx.restore();

    // 꿰맬 길 안내(점선)
    ctx.strokeStyle = s.garment.shade;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const [x, y] = s.line(i / 60, this.W, this.H);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 꿰맨 실
    ctx.lineCap = "round";
    for (let i = 1; i < this.holes.length; i++) {
      const a = this.holes[i - 1];
      const b = this.holes[i];
      if (!b.done) break;
      ctx.strokeStyle = "#ff6fa8";
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 10, b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 구멍
    this.holes.forEach((h, i) => {
      const isNext = i === this.next;
      if (isNext) {
        const pulse = 1 + Math.sin(t * 7) * 0.15;
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, this.tol * pulse);
        g.addColorStop(0, "rgba(255,224,138,0.75)");
        g.addColorStop(1, "rgba(255,224,138,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, this.tol * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = h.done ? "#ff6fa8" : isNext ? "#fff4d6" : "rgba(40,30,60,0.55)";
      ctx.strokeStyle = "#2a2238";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, isNext ? 20 : 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (isNext) {
        ctx.font = `700 34px "Gowun Batang", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#2a2238";
        ctx.fillText(String(i + 1), h.x, h.y + 2);
      }
    });

    // 바늘에 꿰인 실: 마지막 구멍에서 손까지
    const last = this.holes[this.next - 1];
    const nh = hands[this.needleHand]?.on ? hands[this.needleHand] : hands.find((h) => h.on);
    if (last && nh) {
      ctx.strokeStyle = "rgba(255,111,168,0.8)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.quadraticCurveTo((last.x + nh.x) / 2, Math.max(last.y, nh.y) + 60, nh.x, nh.y);
      ctx.stroke();
    }
    for (const h of hands) drawNeedle(ctx, h, this.tol, this.flash);
  }

  stats(): Stat[] {
    return [
      { label: "바늘땀", value: `${this.stitches}땀` },
      { label: "최고 콤보", value: `${this.maxCombo}` },
    ];
  }
}

function drawNeedle(ctx: CanvasRenderingContext2D, h: Hand, R: number, flash: number): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, R * (1 + flash), "gold");
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(-0.7);
  const s = R / 45;
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -80, 0, 10);
  g.addColorStop(0, "#c9cfdc");
  g.addColorStop(1, "#ffffff");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#4d4866";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(-6, -70);
  ctx.quadraticCurveTo(0, -84, 6, -70);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#4d4866";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -66, 2, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
