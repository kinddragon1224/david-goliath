import {
  drawFlare,
  drawGarmentPhoto,
  drawHandGlow,
  propImage,
  drawPalace,
  fabricTexture,
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
  pathOf,
  place,
  toWorld,
  type Garment,
} from "../garments";

/** 05 바느질 챌린지
 * 손이 바늘. 옷의 솔기를 가까이 당겨 보며 번호 붙은 바늘구멍을 차례로 콕 찍으면
 * 실이 따라오고, 땀마다 음이 이어져 솔기 하나가 짧은 가락이 된다. 다 꿰매면 옷 전체가 나온다.
 * 1.6초 안에 이어 찍으면 콤보, 5콤보부터는 '황금실 피버'(점수 2배). 솔기 하나를 다 꿰매면 다음 솔기. */

/** 솔기 길: 옷이 놓인 상자 안 0~1 좌표. 가로·세로 화면 어디서나 옷 위에 놓인다. */
type Seam = {
  name: string;
  garment: Garment;
  line: (k: number, aspect: number) => [number, number];
};

/** 꺾인 길: 점들 사이를 길이 비율대로 잇는다. */
function poly(pts: [number, number][]): (k: number) => [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  return (k) => {
    let d = k * total;
    for (let i = 0; i < seg.length; i++) {
      if (d <= seg[i] || i === seg.length - 1) {
        const r = Math.min(1, d / seg[i]);
        return [
          pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r,
          pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r,
        ];
      }
      d -= seg[i];
    }
    return pts[pts.length - 1];
  };
}

/** 사진 속 실제 자리(밑단·라펠·카라·프릴)를 따라 꿰맨다. */
const SEAMS: Seam[] = [
  {
    name: "두루마기 밑단",
    garment: SEOLBAEK,
    line: (k) => [0.14 + 0.72 * k, 0.79 + Math.sin(k * Math.PI) * 0.03],
  },
  {
    name: "수트 라펠",
    garment: TAILORED,
    line: poly([
      [0.3, 0.07],
      [0.5, 0.32],
      [0.7, 0.07],
    ]),
  },
  {
    name: "리본 허리선 · 튤 옆선",
    garment: SILUA,
    line: poly([
      [0.25, 0.31],
      [0.72, 0.31],
      [0.86, 0.88],
    ]),
  },
  {
    name: "세일러 카라",
    garment: ECO,
    line: poly([
      [0.22, 0.12],
      [0.5, 0.33],
      [0.78, 0.12],
    ]),
  },
  {
    name: "치마 허리선 · 리본 끈",
    garment: RESTITCH,
    line: poly([
      [0.25, 0.33],
      [0.6, 0.33],
      [0.63, 0.74],
    ]),
  },
  {
    name: "튤 프릴 단",
    garment: LAYOVER,
    line: (k) => [0.1 + 0.8 * k, 0.62 + Math.sin(k * Math.PI * 4) * 0.015],
  },
];
const HOLES = 10;
/** 솔기마다 바뀌는 오방색 실. */
const THREADS = ["#e8505b", "#2f6fb5", "#e0a91f", "#2e8b57"];
const SEAM_BONUS = 400;
const COMBO_GAP = 1.6;
const FEVER_AT = 5;
/** 노멀·하드: 구멍마다 줄어드는 타이밍 원(초). 이지는 원 없음. */
const RING = [0, 1.2, 1.0];
/** 원이 이만큼(닫힘=1) 지나도록 못 찍으면 놓침. */
const MISS_AT = [0, 2.2, 1.9];
const MISS_PENALTY = [0, 60, 100];
/** 바늘이 구멍에 들어간 순간 원 크기로 판정: 이보다 이르면 '빨라요'(안 꿰매지고, 빼고 다시 찔러야),
 * PERFECT_TO 넘으면 '늦었어요'. 구멍 옆에서 기다렸다가 원이 닫힐 때 콕 찔러야 퍼펙트. */
const OPEN_AT = [0, 0.5, 0.62];
const PERFECT_TO = 1.15;
/** 사람 손(웹캠 지연)엔 하드도 빡빡해서 '빨라요'는 콤보만 끊는다. */
const EARLY_PENALTY = [0, 0, 0];
const TOL = [0.085, 0.08, 0.072];
/** 솔기를 이만큼까지 당겨 본다(옷 사진이 흐려지지 않는 선). */
const ZOOM_MAX = 1.8;
/** 구멍마다 내는 음(반음). 10땀이 한 가락. */
const MELODY = [-5, -3, 0, 2, 4, 7, 4, 7, 9, 12];
/** 땀 하나가 이어지는 시간(초). */
const STITCH_T = 0.12;
const PULL_T = 1.1;

type Box = { x: number; y: number; w: number; h: number };
type Hole = { x: number; y: number; done: boolean; gold: boolean; miss?: boolean; at?: number };

export class SewingMode implements Mode {
  seconds = 30;
  hint = "바늘 손으로 반짝이는 구멍을 콕! 차례대로 꿰매요";
  tip = "번호 순서대로 콕콕! 빨리 이어 찍으면 콤보";
  // 봇 기준. 이지: 깔끔 62~92k, 대충 8~25k
  // 노멀: 기다렸다 콕 13k, 느린 손 11k, 그냥 대고 있기 4.7k / 하드: 기다렸다 콕 15.5k, 느린 손 6.4~7.4k, 대고 있기 4.7k
  grades: [number, number, number][] = [
    [45000, 26000, 9000],
    [12000, 7000, 3000],
    [14000, 7000, 3000],
  ];
  level: Level = 1;
  music = "lofi" as const;
  private openAt = 0;
  private perfects = 0;
  private misses = 0;
  private earlies = 0;
  private earlyAt = -9;
  private wasIn = [false, false];
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
  private box: Box = { x: 0, y: 0, w: 1, h: 1 };
  /** 옷 전체가 무대에 들어오는 상자. */
  private full: Box = { x: 0, y: 0, w: 1, h: 1 };
  /** 솔기를 다 꿰매면 가까이 보던 옷이 전체 모습으로 물러난다. */
  private pull: { g: Garment; from: Box; to: Box; t: number } | null = null;
  /** 찍은 구멍에서 퍼지는 빛 고리. */
  private pops: { x: number; y: number; t0: number; tone: "gold" | "white" }[] = [];

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
    this.perfects = 0;
    this.misses = 0;
    this.earlies = 0;
    this.earlyAt = -9;
    this.wasIn = [false, false];
    this.pops = [];
    this.pull = null;
    this.tol = Math.min(W, H) * TOL[this.level];
    this.tip = RING[this.level]
      ? "구멍 옆에서 기다렸다가, 원이 하얗게 닫힐 때 콕!"
      : "번호 순서대로 콕콕! 빨리 이어 찍으면 콤보";
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
    const full = place(s.garment, this.W / 2, this.H * 0.53, this.W * 0.6, this.H * 0.9);
    this.full = full;
    this.box = full;
    // 솔기가 무대 가운데 크게 오도록 옷을 당긴다
    const line = Array.from({ length: 21 }, (_, i) => this.at(i / 20));
    const xs = line.map((p) => p[0]);
    const ys = line.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const z = Math.max(
      1,
      Math.min(ZOOM_MAX, (this.W * 0.66) / Math.max(1, x1 - x0), (this.H * 0.6) / Math.max(1, y1 - y0)),
    );
    this.box = {
      x: this.W / 2 - ((x0 + x1) / 2 - full.x) * z,
      y: this.H * 0.5 - ((y0 + y1) / 2 - full.y) * z,
      w: full.w * z,
      h: full.h * z,
    };
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
    // 다음 update에서 그때 시각으로 연다(카운트다운 동안 원이 닫히지 않게)
    this.openAt = -1;
  }

  /** 타이밍 원 진행(0 열림 → 1 닫힘). 이지는 늘 1. */
  private ringK(t: number): number {
    const r = RING[this.level];
    return r ? (t - this.openAt) / r : 1;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.time = t;
    this.flash = Math.max(0, this.flash - dt);
    if (this.pull) {
      this.pull.t += dt;
      if (this.pull.t > PULL_T) this.pull = null;
    }
    if (this.openAt < 0) this.openAt = t;
    const timed = RING[this.level] > 0;
    // 이지는 빨리 이어 찍어야 콤보, 노멀·하드는 놓치지 않으면 콤보
    if (!timed && t - this.lastHit > COMBO_GAP && this.combo > 0) this.combo = 0;
    const hole = this.holes[this.next];
    if (!hole) return;
    const k = this.ringK(t);
    if (timed && k > MISS_AT[this.level]) {
      // 놓침: 땀이 빠지고 콤보가 끊긴다
      hole.done = true;
      hole.miss = true;
      hole.at = t;
      this.combo = 0;
      this.misses++;
      const pen = MISS_PENALTY[this.level];
      fx.score(-pen, hole.x, hole.y - this.tol * 0.9, `-${pen}`, "pink");
      fx.stamp("놓침", hole.x, hole.y - this.tol * 1.6, "pink");
      fx.shake(0.35);
      fx.sfx("miss");
      this.next++;
      this.openAt = t;
    }
    hands.forEach((h, hi) => {
      const inHole = h.on && Math.hypot(h.x - hole.x, h.y - hole.y) <= this.tol;
      const entered = inHole && !this.wasIn[hi];
      this.wasIn[hi] = inHole;
      if (!inHole || hole.done) return;
      // 노멀·하드는 찔러 들어오는 순간에 판정. 대고 기다리면 원이 하얘질 때 '좋아요'(막히지 않게, 퍼펙트는 콕만)
      let held = false;
      if (timed && !entered) {
        if (k < OPEN_AT[this.level]) return;
        held = true;
      }
      if (timed && k < OPEN_AT[this.level]) {
        // 구멍 가장자리에서 손이 떨려 들락날락해도 한 번만
        if (t - this.earlyAt < 0.5) return;
        this.earlyAt = t;
        const pen = EARLY_PENALTY[this.level];
        this.combo = 0;
        this.earlies++;
        if (pen) fx.score(-pen, hole.x, hole.y - this.tol * 0.9, `-${pen}`, "pink");
        fx.stamp("빨라요!", hole.x, hole.y - this.tol * 1.7, "pink");
        fx.shake(0.18);
        fx.sfx("miss");
        return;
      }
      const perfect = timed && !held && k <= PERFECT_TO;
      hole.done = true;
      hole.at = t;
      this.needleHand = hi;
      const quick = timed || t - this.lastHit <= COMBO_GAP;
      this.combo = quick ? this.combo + 1 : 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.lastHit = t;
      this.stitches++;
      this.flash = 0.25;
      hole.gold = this.fever();
      let pts = timed
        ? (perfect ? 160 : 70) + Math.min(10, this.combo - 1) * (perfect ? 25 : 10)
        : 100 + Math.min(10, this.combo - 1) * 20;
      if (this.fever()) pts *= 2;
      const label =
        this.combo === FEVER_AT
          ? "황금실 피버!"
          : this.combo >= 3
            ? `${this.combo}콤보 +${pts}`
            : `+${pts}`;
      fx.score(pts, hole.x, hole.y - this.tol * 0.9, label, this.fever() ? "gold" : "white");
      fx.burst(hole.x, hole.y, this.fever() || perfect ? 14 : 8, "gold");
      this.pops.push({ x: hole.x, y: hole.y, t0: t, tone: perfect || this.fever() ? "gold" : "white" });
      if (timed) {
        if (perfect) this.perfects++;
        fx.stamp(
          perfect ? "퍼펙트!" : held ? "좋아요" : "늦었어요",
          hole.x,
          hole.y - this.tol * 1.7,
          perfect ? "gold" : "white",
        );
        if (perfect) {
          fx.hitstop(0.05);
          fx.shake(0.15);
        }
      }
      fx.sfx(
        this.combo === FEVER_AT ? "perfect" : timed ? (perfect ? "perfect" : "good") : "stitch",
        MELODY[this.next],
      );
      if (this.combo === FEVER_AT) {
        fx.say("gold-fever", true);
        fx.shake(0.4);
      }
      this.next++;
      this.openAt = t;
    });
    if (this.next >= this.holes.length) {
      fx.score(SEAM_BONUS, this.W / 2, this.H * 0.32, `보너스 +${SEAM_BONUS}`, "pink");
      fx.celebrate(`${fullName(this.seam().garment)} 완성!`, "pink");
      fx.sfx("complete");
      fx.hitstop(0.16);
      fx.shake(0.6);
      // 꿰맨 자리를 따라 반짝
      for (const h of this.holes) if (!h.miss) fx.burst(h.x, h.y, 6, "gold");
      this.pull = { g: this.seam().garment, from: this.box, to: this.full, t: 0 };
      this.sewn.push(this.seam());
      this.si++;
      this.load();
    }
    this.hint = this.fever()
      ? `황금실 피버! 점수 2배 · ${this.next}/${HOLES}`
      : `${this.seam().name} ${this.next}/${HOLES}${this.combo >= 2 ? ` · ${this.combo}콤보!` : timed ? " · 원이 하얘지면 콕!" : " · 반짝이는 구멍을 콕!"}`;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], _phase: Phase): void {
    const s = this.seam();
    // 쪽빛 왕궁 방
    drawPalace(ctx, this.W, this.H, t, ["#0f1a2a", "#05080e"], "sewing");
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
    if (!drawGarmentPhoto(ctx, s.garment, p.x, p.y, p.w, p.h)) {
      fabricTexture(ctx, p.x, p.y, p.w, p.h, s.garment.shade);
    }
    ctx.restore();

    // 꿰맬 길 안내(어두운 옷 위에서는 밝게)
    const dark = s.garment === ECO || s.garment === SEOLBAEK;
    ctx.strokeStyle = dark ? "rgba(255,240,210,0.8)" : "rgba(42,34,56,0.6)";
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
      ctx.strokeStyle = b.miss
        ? "rgba(255,90,110,0.55)"
        : b.gold
          ? "#ffd34d"
          : THREADS[this.si % THREADS.length];
      ctx.lineWidth = b.miss ? 5 : 12;
      ctx.setLineDash(b.miss ? [6, 10] : []);
      if (b.gold) {
        ctx.shadowColor = "#ffd34d";
        ctx.shadowBlur = 16;
      }
      // 땀이 구멍에서 구멍으로 쭉 이어진다
      const grow = b.at === undefined ? 1 : Math.min(1, (t - b.at) / STITCH_T);
      const ex = a.x + (b.x - a.x) * grow;
      const ey = a.y + (b.y - a.y) * grow;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + ex) / 2, (a.y + ey) / 2 - 10, ex, ey);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (!b.miss) {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // 구멍: 다음 구멍은 크게, 그다음 둘은 번호만 작게
    this.holes.forEach((h, i) => {
      const isNext = i === this.next;
      const soon = i > this.next && i <= this.next + 2;
      if (isNext) {
        const pulse = 1 + Math.sin(t * 7) * 0.15;
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, this.tol * pulse);
        g.addColorStop(0, "rgba(159,243,255,0.8)");
        g.addColorStop(1, "rgba(159,243,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, this.tol * pulse, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = h.done
        ? h.miss
          ? "#5a2633"
          : h.gold
            ? "#ffd34d"
            : "#ff6fa8"
        : isNext
          ? "#ffffff"
          : "rgba(255,255,255,0.7)";
      // 어떤 색 옷 위에서도 보이게: 밝은 속 + 짙은 테
      ctx.strokeStyle = "#0b0f18";
      ctx.lineWidth = 5;
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
          ctx.fillStyle = "#ffffff";
          ctx.fillText(String(i + 1), h.x, h.y - 30);
        }
      }
    });

    // 타이밍 원: 크게 열렸다가 구멍 크기로 닫힌다. 하얘지면 콕, 닫힌 뒤엔 분홍으로 더 줄며 '늦었어요'
    const cur = this.holes[this.next];
    if (cur && RING[this.level] && _phase === "play") {
      const k = this.ringK(t);
      const ready = k >= OPEN_AT[this.level];
      const late = k > PERFECT_TO;
      const r = this.tol * (k <= 1 ? 1 + (1 - k) * 2.2 : Math.max(0.3, 1 - (k - 1) * 1.2));
      ctx.save();
      ctx.lineWidth = ready && !late ? 9 : 6;
      ctx.strokeStyle = late ? "#ff6f8a" : ready ? "#ffffff" : "rgba(159,243,255,0.9)";
      ctx.shadowColor = late ? "#ff6f8a" : TONE.gold;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, r, 0, Math.PI * 2);
      ctx.stroke();
      // 닫힐 자리(구멍 테두리)
      ctx.shadowBlur = 0;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 8]);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.arc(cur.x, cur.y, this.tol, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

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
      ctx.strokeStyle = "rgba(159,243,255,0.45)";
      ctx.lineWidth = 4;
      ctx.setLineDash([4, 16]);
      ctx.beginPath();
      ctx.moveTo(nh.x, nh.y);
      ctx.lineTo(nxt.x, nxt.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 콕! 찍은 자리에서 고리가 퍼지며 사라진다
    this.pops = this.pops.filter((p) => t - p.t0 < 0.4);
    for (const p of this.pops) {
      const k = (t - p.t0) / 0.4;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = TONE[p.tone];
      ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.tol * (0.6 + k * 1.1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawFlare(ctx, p.x, p.y, this.tol * (1.4 - k * 0.6), p.tone, 1 - k);
    }
    // 다 꿰맨 옷: 가까이 보던 자리에서 전체 모습으로 물러났다가 사라진다
    if (this.pull) {
      const { g, from, to, t: pt } = this.pull;
      const k = 1 - Math.pow(1 - Math.min(1, pt / 0.5), 3);
      const fade = Math.min(1, (PULL_T - pt) / 0.3);
      const mix = (a: number, b: number) => a + (b - a) * k;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(6,8,14,0.72)";
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 40;
      drawGarmentPhoto(ctx, g, mix(from.x, to.x), mix(from.y, to.y), mix(from.w, to.w), mix(from.h, to.h));
      ctx.restore();
    }
    for (const h of hands) drawNeedle(ctx, h, this.tol, this.flash, this.fever());
  }

  stats(): Stat[] {
    return [
      { label: "바늘땀", value: `${this.stitches}땀` },
      { label: "최고 콤보", value: `${this.maxCombo}` },
      { label: "완성한 솔기", value: `${this.sewn.length}줄` },
      ...(RING[this.level]
        ? [
            { label: "퍼펙트", value: `${this.perfects}` },
            { label: "놓침·빨라요", value: `${this.misses + this.earlies}` },
          ]
        : []),
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
            this.combo > 0
              ? `${this.combo}콤보 · ${FEVER_AT}콤보면 피버`
              : RING[this.level]
                ? "원이 하얘질 때 콕 찍으면 콤보"
                : "빨리 이어 찍으면 콤보",
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
    // 노멀·하드 시범: 구멍 위에서 기다렸다가 원이 하얘지면 콕
    const timed = RING[this.level] > 0;
    const wait = timed && this.openAt >= 0 && this.ringK(t) < 0.8;
    const gy = wait ? h.y - this.tol * 1.7 : h.y;
    const k = timed && !wait ? 0.35 : 0.09;
    this.demoPos = {
      x: from.x + (h.x - from.x) * k,
      y: from.y + (gy - from.y) * k + Math.sin(t * 3) * 1.5,
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
  const img = propImage("needle");
  if (img) {
    // 그림은 바늘 끝이 왼쪽 아래 귀퉁이. 손 위치 = 바늘 끝.
    const w = R * 3.2;
    const ih = (w * img.naturalHeight) / img.naturalWidth;
    ctx.globalAlpha = h.ghost ? 0.8 : 1;
    if (fever) {
      ctx.shadowColor = "#ffd34d";
      ctx.shadowBlur = 28;
    }
    ctx.drawImage(img, -w * 0.02, -ih * 0.97, w, ih);
  } else drawNeedleShape(ctx, R, fever, h.ghost);
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

function drawNeedleShape(
  ctx: CanvasRenderingContext2D,
  R: number,
  fever: boolean,
  ghost: boolean | undefined,
): void {
  ctx.rotate(-0.7);
  const s = R / 45;
  ctx.scale(s, s);
  ctx.globalAlpha = ghost ? 0.8 : 1;
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
}
