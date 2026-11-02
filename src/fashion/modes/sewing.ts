import {
  drawHandGlow,
  drawPalace,
  fabricTexture,
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
  SEOLBAEK,
  SILUA,
  TAILORED,
  fullName,
  pathOf,
  place,
  toWorld,
  type Garment,
} from "../garments";

/** 05 바느질 챌린지
 * 손이 바늘. 번호 붙은 바늘구멍을 차례로 콕 찍으면 실이 따라와 한 땀씩 꿰매진다.
 * 1.6초 안에 이어 찍으면 콤보, 5콤보부터는 '황금실 피버'(점수 2배). 솔기 하나를 다 꿰매면 다음 솔기. */

/** 솔기 길: 옷이 놓인 상자 안 0~1 좌표. 가로·세로 화면 어디서나 옷 위에 놓인다. */
type Seam = {
  name: string;
  garment: Garment;
  line: (k: number, aspect: number) => [number, number];
};

const SEAMS: Seam[] = [
  {
    name: "한복 치마 밑단",
    garment: SEOLBAEK,
    line: (k) => [0.15 + 0.7 * k, 0.8 + Math.sin(k * Math.PI * 2) * 0.05],
  },
  {
    name: "재킷 라펠",
    garment: TAILORED,
    line: (k) => [0.3 + 0.4 * k, 0.1 + (1 - Math.abs(k * 2 - 1)) * 0.36],
  },
  {
    name: "웨딩드레스 레이스 둘레",
    garment: SILUA,
    line: (k, aspect) => [
      0.5 + (Math.cos(k * Math.PI * 2 - Math.PI / 2) * 0.2) / aspect,
      0.68 + Math.sin(k * Math.PI * 2 - Math.PI / 2) * 0.2,
    ],
  },
  {
    name: "고딕 원피스 옆선",
    garment: ECO,
    line: (k) => [0.5 + Math.sin(k * Math.PI * 3) * 0.15, 0.2 + 0.66 * k],
  },
];
const HOLES = 10;
/** 솔기마다 바뀌는 오방색 실. */
const THREADS = ["#e8505b", "#2f6fb5", "#e0a91f", "#2e8b57"];
const SEAM_BONUS = 400;
const COMBO_GAP = 1.6;
const FEVER_AT = 5;

type Hole = { x: number; y: number; done: boolean; gold: boolean };

export class SewingMode implements Mode {
  seconds = 30;
  hint = "바늘 손으로 반짝이는 구멍을 콕! 차례대로 꿰매요";
  tip = "번호 순서대로 콕콕! 빨리 이어 찍으면 콤보";
  grades: [number, number, number] = [40000, 20000, 8000];
  music = "lofi" as const;
  private W = 1400;
  private H = 860;
  private si = 0;
  private holes: Hole[] = [];
  private next = 0;
  private tol = 70;
  private combo = 0;
  private maxCombo = 0;
  private lastHit = -10;
  private stitches = 0;
  private sewn: Seam[] = [];
  private flash = 0;
  private time = 0;
  private needleHand = 0;
  private demoPos: DemoHand | null = null;
  private box = { x: 0, y: 0, w: 1, h: 1 };

  /** 솔기 위 한 점(무대 좌표). */
  private at(k: number): [number, number] {
    const s = this.seam();
    const [u, v] = s.line(k, s.garment.aspect);
    return [this.box.x + u * this.box.w, this.box.y + v * this.box.h];
  }

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.si = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.stitches = 0;
    this.sewn = [];
    this.lastHit = -10;
    this.tol = Math.min(W, H) * 0.085;
    this.demoPos = null;
    this.load();
  }

  private seam(): Seam {
    return SEAMS[this.si % SEAMS.length];
  }

  private fever(): boolean {
    return this.combo >= FEVER_AT;
  }

  private load(): void {
    const s = this.seam();
    this.box = place(s.garment, this.W / 2, this.H * 0.53, this.W * 0.6, this.H * 0.9);
    this.holes = [];
    const off = Math.min(this.W, this.H) * 0.065;
    for (let i = 0; i < HOLES; i++) {
      const k = i / (HOLES - 1);
      const [x, y] = this.at(k);
      const [x2, y2] = this.at(Math.min(1, k + 0.01));
      const [x1, y1] = this.at(Math.max(0, k - 0.01));
      let nx = -(y2 - y1);
      let ny = x2 - x1;
      const l = Math.hypot(nx, ny) || 1;
      nx /= l;
      ny /= l;
      const sign = i % 2 ? 1 : -1;
      this.holes.push({ x: x + nx * off * sign, y: y + ny * off * sign, done: false, gold: false });
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
      hole.gold = this.fever();
      let pts = 100 + Math.min(10, this.combo - 1) * 20;
      if (this.fever()) pts *= 2;
      const label =
        this.combo === FEVER_AT
          ? "황금실 피버!"
          : this.combo >= 3
            ? `${this.combo}콤보 +${pts}`
            : `+${pts}`;
      fx.score(pts, hole.x, hole.y - this.tol * 0.9, label, this.fever() ? "gold" : "white");
      fx.burst(hole.x, hole.y, this.fever() ? 14 : 8, "gold");
      fx.sfx(this.combo === FEVER_AT ? "perfect" : "stitch");
      if (this.combo === FEVER_AT) fx.say("gold-fever", true);
      this.next++;
    });
    if (this.next >= this.holes.length) {
      fx.score(SEAM_BONUS, this.W / 2, this.H * 0.4, `보너스 +${SEAM_BONUS}`, "pink");
      fx.celebrate(`${fullName(this.seam().garment)} 완성!`, "pink");
      fx.sfx("complete");
      this.sewn.push(this.seam());
      this.si++;
      this.load();
    }
    this.hint = this.fever()
      ? `황금실 피버! 점수 2배 · ${this.next}/${HOLES}`
      : `${this.seam().name} ${this.next}/${HOLES}${this.combo >= 2 ? ` · ${this.combo}콤보!` : " · 반짝이는 구멍을 콕!"}`;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], _phase: Phase): void {
    const s = this.seam();
    // 쪽빛 왕궁 방
    drawPalace(ctx, this.W, this.H, t, ["#1d2f5e", "#0e1630"], "sewing");
    // 바탕 옷: 브랜드 옷 색 그대로 + 천 결
    const p = this.box;
    const path = pathOf(toWorld(s.garment, p));
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = s.garment.color;
    ctx.fill(path);
    ctx.restore();
    ctx.save();
    ctx.clip(path);
    fabricTexture(ctx, p.x, p.y, p.w, p.h, s.garment.shade);
    ctx.restore();
    ctx.strokeStyle = "#d4a63c";
    ctx.lineWidth = 5;
    ctx.stroke(path);

    // 꿰맬 길 안내(어두운 옷 위에서는 밝게)
    ctx.strokeStyle = s.garment === ECO ? "rgba(255,240,210,0.7)" : "rgba(42,34,56,0.55)";
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 12]);
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const [x, y] = this.at(i / 60);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 꿰맨 실(피버 땀은 금빛)
    ctx.lineCap = "round";
    for (let i = 1; i < this.holes.length; i++) {
      const a = this.holes[i - 1];
      const b = this.holes[i];
      if (!b.done) break;
      ctx.strokeStyle = b.gold ? "#ffd34d" : THREADS[this.si % THREADS.length];
      ctx.lineWidth = 10;
      if (b.gold) {
        ctx.shadowColor = "#ffd34d";
        ctx.shadowBlur = 16;
      }
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 10, b.x, b.y);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 구멍: 다음 구멍은 크게, 그다음 둘은 번호만 작게
    this.holes.forEach((h, i) => {
      const isNext = i === this.next;
      const soon = i > this.next && i <= this.next + 2;
      if (isNext) {
        const pulse = 1 + Math.sin(t * 7) * 0.15;
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, this.tol * pulse);
        g.addColorStop(0, "rgba(255,224,138,0.8)");
        g.addColorStop(1, "rgba(255,224,138,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, this.tol * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = h.done
        ? h.gold
          ? "#ffd34d"
          : "#ff6fa8"
        : isNext
          ? "#fff4d6"
          : "rgba(40,30,60,0.55)";
      ctx.strokeStyle = "#2a2238";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, isNext ? 24 : 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (isNext || soon) {
        ctx.font = `700 ${isNext ? 34 : 24}px "Gowun Batang", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        if (isNext) {
          ctx.fillStyle = "#2a2238";
          ctx.fillText(String(i + 1), h.x, h.y + 2);
        } else {
          ctx.lineWidth = 6;
          ctx.strokeStyle = "rgba(20,14,30,0.7)";
          ctx.strokeText(String(i + 1), h.x, h.y - 30);
          ctx.fillStyle = "#fff4d6";
          ctx.fillText(String(i + 1), h.x, h.y - 30);
        }
      }
    });

    // 바늘에 꿰인 실: 마지막 구멍에서 손까지
    const last = this.holes[this.next - 1];
    const nh = hands[this.needleHand]?.on ? hands[this.needleHand] : hands.find((h) => h.on);
    if (last && nh) {
      ctx.strokeStyle = this.fever() ? "rgba(255,211,77,0.9)" : "rgba(255,111,168,0.85)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.quadraticCurveTo((last.x + nh.x) / 2, Math.max(last.y, nh.y) + 60, nh.x, nh.y);
      ctx.stroke();
    }
    // 다음 구멍까지 옅은 안내선
    const nxt = this.holes[this.next];
    if (nxt && nh && Math.hypot(nh.x - nxt.x, nh.y - nxt.y) > this.tol * 1.8) {
      ctx.strokeStyle = "rgba(255,224,138,0.45)";
      ctx.lineWidth = 4;
      ctx.setLineDash([4, 16]);
      ctx.beginPath();
      ctx.moveTo(nh.x, nh.y);
      ctx.lineTo(nxt.x, nxt.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const h of hands) drawNeedle(ctx, h, this.tol, this.flash, this.fever());
  }

  stats(): Stat[] {
    return [
      { label: "바늘땀", value: `${this.stitches}땀` },
      { label: "최고 콤보", value: `${this.maxCombo}` },
      { label: "완성한 솔기", value: `${this.sewn.length}줄` },
    ];
  }

  queue(): QueueItem[] {
    const out: QueueItem[] = [];
    const n = Math.max(SEAMS.length, this.si + 1);
    for (let i = 0; i < n; i++) {
      const s = SEAMS[i % SEAMS.length];
      out.push({
        label: s.name,
        state: i < this.si ? "done" : i === this.si ? "now" : "next",
        pct: i === this.si ? Math.round((this.next / HOLES) * 100) : undefined,
        shape: s.garment.pts,
        aspect: s.garment.aspect,
        color: s.garment.color,
      });
    }
    return out.slice(Math.max(0, this.si - 2), Math.max(0, this.si - 2) + 5);
  }

  meter(): Meter {
    return this.fever()
      ? { label: "황금실 피버", value: 1, text: `${this.combo}콤보 · 점수 2배!`, hot: true }
      : {
          label: "콤보",
          value: this.combo / FEVER_AT,
          text:
            this.combo > 0 ? `${this.combo}콤보 · ${FEVER_AT}콤보면 피버` : `빨리 이어 찍으면 콤보`,
        };
  }

  collection(): Item[] {
    // 이름은 옷 이름(피날레에서 그 옷을 입혀 준다), 아래에 브랜드
    return this.sewn.map((s) => ({
      label: s.garment.name,
      note: s.garment.brand,
      shape: s.garment.pts,
      aspect: s.garment.aspect,
      color: s.garment.color,
    }));
  }

  demo(t: number): DemoHand[] {
    const h = this.holes[this.next] ?? this.holes[0];
    const from = this.demoPos ?? { x: this.W / 2, y: this.H / 2 };
    const k = 0.09;
    this.demoPos = {
      x: from.x + (h.x - from.x) * k,
      y: from.y + (h.y - from.y) * k + Math.sin(t * 3) * 1.5,
    };
    return [this.demoPos];
  }

  target(): DemoHand | null {
    const h = this.holes[this.next];
    return h ? { x: h.x, y: h.y } : null;
  }
}

function drawNeedle(
  ctx: CanvasRenderingContext2D,
  h: Hand,
  R: number,
  flash: number,
  fever: boolean,
): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, R * (1 + flash), "gold");
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(-0.7);
  const s = R / 45;
  ctx.scale(s, s);
  ctx.globalAlpha = h.ghost ? 0.8 : 1;
  const g = ctx.createLinearGradient(0, -80, 0, 10);
  g.addColorStop(0, fever ? "#ffd34d" : "#c9cfdc");
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
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -66, 2, 7, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (fever && !h.ghost) {
    ctx.fillStyle = TONE.gold;
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) {
      const a = performance.now() / 300 + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.arc(h.x + Math.cos(a) * R * 0.9, h.y + Math.sin(a) * R * 0.9, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
