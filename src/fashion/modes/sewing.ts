import {
  drawFlare,
  drawHandGlow,
  drawPalace,
  fabricTexture,
  propImage,
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

/** 05 바느질 챌린지
 * 손이 바늘. 자수틀에 그려진 무늬의 빛나는 구멍을 차례로 콕콕 찍으면 실이 따라오고,
 * 한 바퀴를 다 돌면 무늬가 수놓아져 활짝 피어난다. 주민 체험이라 실패·감점이 없다.
 * 빨리 이어 찍으면 콤보, 5콤보부터 황금실 피버(점수 2배). */

type P2 = [number, number];
/** 무늬: 틀 가운데를 0으로 -1~1 좌표의 닫힌 선. */
type Pattern = { name: string; thread: string; cloth: string; at: (k: number) => P2 };

const TAU = Math.PI * 2;
const polar = (r: (a: number) => number) => (k: number): P2 => {
  const a = k * TAU - Math.PI / 2;
  return [Math.cos(a) * r(a), Math.sin(a) * r(a)];
};

function poly(pts: P2[]): (k: number) => P2 {
  return (k) => {
    const f = (((k % 1) + 1) % 1) * pts.length;
    const i = Math.floor(f);
    const [a, b] = [pts[i], pts[(i + 1) % pts.length]];
    return [a[0] + (b[0] - a[0]) * (f - i), a[1] + (b[1] - a[1]) * (f - i)];
  };
}

const STAR: P2[] = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * TAU - Math.PI / 2;
  const r = i % 2 ? 0.42 : 1;
  return [Math.cos(a) * r, Math.sin(a) * r];
});

const PATTERNS: Pattern[] = [
  {
    name: "하트",
    thread: "#e8505b",
    cloth: "#fff6ea",
    at: (k) => {
      const a = k * TAU;
      return [
        (16 * Math.sin(a) ** 3) / 17,
        -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 17,
      ];
    },
  },
  { name: "별", thread: "#e0a91f", cloth: "#eef3ff", at: poly(STAR) },
  {
    name: "꽃",
    thread: "#d9539a",
    cloth: "#f3fbf0",
    at: polar((a) => 0.72 + 0.26 * Math.cos(5 * a + Math.PI / 2)),
  },
  {
    name: "네잎클로버",
    thread: "#2e8b57",
    cloth: "#fff9e6",
    at: polar((a) => 0.5 + 0.46 * Math.abs(Math.cos(2 * a))),
  },
  {
    name: "나뭇잎",
    thread: "#2f6fb5",
    cloth: "#fdf1f4",
    at: (k) => {
      const a = k * TAU;
      return [Math.sin(a) * 0.62 * (0.7 + 0.3 * Math.cos(a)), -Math.cos(a) * 0.98];
    },
  },
];

const HOLES = 12;
const FEVER_AT = 5;
/** 이 안에 다음 땀을 뜨면 콤보. 넘겨도 감점은 없다. */
const COMBO_GAP = 2.4;
/** 손이 쓸고 지나가는 것만으로 한꺼번에 찍히지 않게. */
const MIN_GAP = 0.14;
const PATTERN_BONUS = 500;
const BLOOM_T = 1.3;
/** 구멍마다 내는 음(반음). 12땀이 한 가락. */
const MELODY = [-5, -3, 0, 2, 4, 7, 4, 7, 9, 12, 9, 12];
const SPOOLS = ["#e8505b", "#e0a91f", "#2e8b57", "#2f6fb5"];

type Hole = { x: number; y: number; done: boolean; gold: boolean; at?: number };

export class SewingMode implements Mode {
  seconds = 35;
  hint = "빛나는 구멍에 바늘 손을 콕! 무늬를 따라 수놓아요";
  tip = "빛나는 구멍을 바늘 손으로 콕콕!";
  grades: [number, number, number] = [11000, 6000, 2000];
  music = "lofi" as const;
  private W = 1400;
  private H = 860;
  private cx = 700;
  private cy = 430;
  private R = 300;
  private tol = 80;
  private pi = 0;
  private holes: Hole[] = [];
  private next = 0;
  private combo = 0;
  private maxCombo = 0;
  private lastHit = -10;
  private lastStitch = -10;
  private stitches = 0;
  private sewn: Pattern[] = [];
  private needleHand = 0;
  private flash = 0;
  private demoPos: DemoHand | null = null;
  private bloom: { p: Pattern; t: number } | null = null;
  private pops: { x: number; y: number; t0: number; gold: boolean }[] = [];

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.cx = W / 2;
    this.cy = H * 0.52;
    this.R = Math.min(W * 0.4, H * 0.42);
    this.tol = Math.min(W, H) * 0.1;
    this.pi = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastHit = -10;
    this.lastStitch = -10;
    this.stitches = 0;
    this.sewn = [];
    this.bloom = null;
    this.pops = [];
    this.demoPos = null;
    this.load();
  }

  private pattern(): Pattern {
    return PATTERNS[this.pi % PATTERNS.length];
  }

  private world(p: Pattern, k: number): P2 {
    const [x, y] = p.at(k);
    return [this.cx + x * this.R * 0.74, this.cy + y * this.R * 0.74];
  }

  private load(): void {
    const p = this.pattern();
    this.holes = Array.from({ length: HOLES }, (_, i) => {
      const [x, y] = this.world(p, i / HOLES);
      return { x, y, done: false, gold: false };
    });
    this.next = 0;
  }

  private fever(): boolean {
    return this.combo >= FEVER_AT;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.flash = Math.max(0, this.flash - dt);
    if (this.bloom) {
      this.bloom.t += dt;
      if (this.bloom.t > BLOOM_T) this.bloom = null;
    }
    if (this.combo > 0 && t - this.lastHit > COMBO_GAP) this.combo = 0;
    const hole = this.holes[this.next];
    if (hole && !this.bloom && t - this.lastStitch >= MIN_GAP) {
      const hi = hands.findIndex(
        (h) => h.on && Math.hypot(h.x - hole.x, h.y - hole.y) <= this.tol,
      );
      if (hi >= 0) this.stitch(hole, hi, t, fx);
    }
    const left = HOLES - this.next;
    this.hint = this.fever()
      ? `황금실 피버! 점수 2배 · ${this.pattern().name} ${left}땀 남았어요`
      : `${this.pattern().name} 수놓기 · 빛나는 구멍을 콕! ${left}땀 남았어요`;
  }

  private stitch(hole: Hole, hi: number, t: number, fx: Fx): void {
    hole.done = true;
    hole.at = t;
    this.needleHand = hi;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastHit = t;
    this.lastStitch = t;
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
    fx.score(pts, hole.x, hole.y - this.tol * 0.8, label, hole.gold ? "gold" : "white");
    fx.burst(hole.x, hole.y, hole.gold ? 14 : 8, "gold");
    this.pops.push({ x: hole.x, y: hole.y, t0: t, gold: hole.gold });
    fx.sfx(this.combo === FEVER_AT ? "perfect" : "stitch", MELODY[this.next]);
    if (this.combo === FEVER_AT) {
      fx.say("gold-fever", true);
      fx.shake(0.4);
    }
    this.next++;
    if (this.next < HOLES) return;
    const p = this.pattern();
    fx.score(PATTERN_BONUS, this.cx, this.cy, `자수 완성 +${PATTERN_BONUS}`, "pink");
    fx.celebrate(`${p.name} 자수 완성!`, "pink");
    fx.sfx("complete");
    fx.hitstop(0.12);
    fx.shake(0.5);
    for (const h of this.holes) fx.burst(h.x, h.y, 6, "gold");
    this.sewn.push(p);
    this.bloom = { p, t: 0 };
    this.pi++;
    this.load();
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], phase: Phase): void {
    drawPalace(ctx, this.W, this.H, t, ["#14233a", "#070b14"], "sewing");
    this.drawSpools(ctx, t);
    this.drawSewn(ctx);
    const shown = this.bloom?.p ?? this.pattern();
    this.drawHoop(ctx, shown);
    if (this.bloom) this.drawBloom(ctx, this.bloom.p, this.bloom.t / BLOOM_T, t);
    else this.drawWork(ctx, t, hands, phase);
    this.pops = this.pops.filter((p) => t - p.t0 < 0.4);
    for (const p of this.pops) {
      const k = (t - p.t0) / 0.4;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = TONE[p.gold ? "gold" : "white"];
      ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.tol * (0.4 + k), 0, TAU);
      ctx.stroke();
      ctx.restore();
      drawFlare(ctx, p.x, p.y, this.tol * (1.2 - k * 0.6), p.gold ? "gold" : "white", 1 - k);
    }
    for (const h of hands) drawNeedle(ctx, h, this.tol * 0.8, this.flash, this.fever());
  }

  /** 나무 자수틀과 팽팽한 천. */
  private drawHoop(ctx: CanvasRenderingContext2D, p: Pattern): void {
    const { cx, cy, R } = this;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = p.cloth;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    fabricTexture(ctx, cx - R, cy - R, R * 2, R * 2, "#b9a98f");
    const lit = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R);
    lit.addColorStop(0, "rgba(255,255,255,0.35)");
    lit.addColorStop(1, "rgba(80,50,30,0.16)");
    ctx.fillStyle = lit;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();
    const wood = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    wood.addColorStop(0, "#e2b57a");
    wood.addColorStop(0.5, "#b47c43");
    wood.addColorStop(1, "#e0ae6e");
    ctx.strokeStyle = wood;
    ctx.lineWidth = R * 0.075;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(70,40,18,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.965, 0, TAU);
    ctx.stroke();
    // 틀을 조이는 나사
    ctx.fillStyle = "#c7ccd6";
    ctx.strokeStyle = "#555b68";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - R * 0.09, cy - R * 1.09, R * 0.18, R * 0.09, 6);
    ctx.fill();
    ctx.stroke();
  }

  /** 틀 양옆 실타래. 지금 쓰는 색이 돈다. */
  private drawSpools(ctx: CanvasRenderingContext2D, t: number): void {
    const s = Math.min(this.W, this.H) * 0.05;
    const spots: P2[] = [
      [this.W * 0.07, this.H * 0.18],
      [this.W * 0.93, this.H * 0.18],
      [this.W * 0.07, this.H * 0.8],
      [this.W * 0.93, this.H * 0.8],
    ];
    spots.forEach(([x, y], i) => {
      const on = i === this.pi % SPOOLS.length;
      ctx.save();
      ctx.translate(x, y + (on ? Math.sin(t * 5) * 4 : 0));
      ctx.fillStyle = "#d9b98c";
      ctx.fillRect(-s * 0.9, -s * 1.15, s * 1.8, s * 0.3);
      ctx.fillRect(-s * 0.9, s * 0.85, s * 1.8, s * 0.3);
      ctx.fillStyle = SPOOLS[i];
      ctx.beginPath();
      ctx.roundRect(-s * 0.72, -s * 0.85, s * 1.44, s * 1.7, s * 0.2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.lineWidth = 2;
      const shift = on ? (t * 30) % 10 : 0;
      for (let k = -s * 0.8 + shift; k < s * 0.85; k += 10) {
        ctx.beginPath();
        ctx.moveTo(-s * 0.72, k);
        ctx.lineTo(s * 0.72, k + 6);
        ctx.stroke();
      }
      ctx.restore();
    });
  }

  /** 완성한 자수를 틀 양옆에 작은 와펜으로 건다(최근 8개). 판이 진행될수록 무대가 채워진다. */
  private drawSewn(ctx: CanvasRenderingContext2D): void {
    const s = Math.min(this.W, this.H) * 0.045;
    this.sewn.slice(-8).forEach((p, i) => {
      const x = this.W * (i % 2 ? 0.93 : 0.07);
      const y = this.H * (0.32 + Math.floor(i / 2) * 0.115);
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = p.cloth;
      ctx.strokeStyle = "#b47c43";
      ctx.lineWidth = s * 0.16;
      ctx.beginPath();
      ctx.arc(0, 0, s, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.thread;
      ctx.beginPath();
      for (let k = 0; k < 40; k++) {
        const [px, py] = p.at(k / 40);
        ctx.lineTo(px * s * 0.66, py * s * 0.66);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  /** 수놓을 무늬 밑선, 뜬 땀, 다음 구멍, 바늘까지 이어진 실. */
  private drawWork(
    ctx: CanvasRenderingContext2D,
    t: number,
    hands: Hand[],
    phase: Phase,
  ): void {
    const p = this.pattern();
    ctx.save();
    ctx.strokeStyle = "rgba(70,60,80,0.45)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    for (let i = 0; i <= 90; i++) {
      const [x, y] = this.world(p, i / 90);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    ctx.lineCap = "round";
    for (let i = 1; i < this.holes.length; i++) {
      const a = this.holes[i - 1];
      const b = this.holes[i];
      if (!b.done) break;
      const grow = b.at === undefined ? 1 : Math.min(1, (t - b.at) / 0.12);
      const ex = a.x + (b.x - a.x) * grow;
      const ey = a.y + (b.y - a.y) * grow;
      drawThread(ctx, a.x, a.y, ex, ey, b.gold ? "#ffd34d" : p.thread, this.R * 0.05);
    }
    // 다음 구멍으로 흘러가는 금빛 점선: 어느 쪽으로 가야 하는지 멀리서도 보인다
    const from = this.holes[this.next - 1];
    const to = this.holes[this.next];
    if (from && to) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,190,70,0.9)";
      ctx.lineWidth = 7;
      ctx.setLineDash([4, 22]);
      ctx.lineDashOffset = -t * 90;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.restore();
    }
    this.holes.forEach((h, i) => {
      const isNext = i === this.next;
      // 그다음 구멍은 흰 고리로 미리 알려 준다
      if (i === this.next + 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 18 + Math.sin(t * 7) * 2, 0, TAU);
        ctx.stroke();
      }
      if (isNext) {
        const pulse = 1 + Math.sin(t * 7) * 0.15;
        const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, this.tol * pulse);
        g.addColorStop(0, "rgba(255,180,60,0.9)");
        g.addColorStop(1, "rgba(255,180,60,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(h.x, h.y, this.tol * pulse, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = h.done ? (h.gold ? "#ffd34d" : p.thread) : isNext ? "#ffffff" : "#6a5f73";
      ctx.strokeStyle = "#2a2238";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, isNext ? 20 : 9, 0, TAU);
      ctx.fill();
      ctx.stroke();
    });
    // 바늘에 꿰인 실: 마지막 땀에서 손까지
    const last = this.holes[this.next - 1];
    const nh = hands[this.needleHand]?.on ? hands[this.needleHand] : hands.find((h) => h.on);
    if (last && nh) {
      ctx.strokeStyle = this.fever() ? "#ffd34d" : p.thread;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.quadraticCurveTo((last.x + nh.x) / 2, Math.max(last.y, nh.y) + 60, nh.x, nh.y);
      ctx.stroke();
    }
    // 카운트다운 숫자와 겹치지 않게 그동안은 숨긴다
    if (this.next === 0 && phase !== "result" && phase !== "countdown") {
      const h = this.holes[0];
      ctx.save();
      ctx.font = `700 40px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 9;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      // 구멍 아래에: 위쪽은 공용 안내("여기로!")가 뜨는 자리
      ctx.strokeText("여기부터 콕!", h.x, h.y + this.tol + 44);
      ctx.fillStyle = TONE.gold;
      ctx.fillText("여기부터 콕!", h.x, h.y + this.tol + 44);
      ctx.restore();
    }
  }

  /** 다 뜬 무늬: 안쪽부터 실이 촘촘히 채워지며 활짝 핀다. */
  private drawBloom(ctx: CanvasRenderingContext2D, p: Pattern, k: number, t: number): void {
    const path = new Path2D();
    for (let i = 0; i <= 90; i++) {
      const [x, y] = this.world(p, i / 90);
      if (i) path.lineTo(x, y);
      else path.moveTo(x, y);
    }
    path.closePath();
    const fill = Math.min(1, k / 0.6);
    const pop = 1 + Math.sin(Math.min(1, k) * Math.PI) * 0.08;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(pop, pop);
    ctx.translate(-this.cx, -this.cy);
    ctx.save();
    ctx.clip(path);
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.R * 1.1 * fill, 0, TAU);
    ctx.clip();
    ctx.fillStyle = p.thread;
    ctx.fillRect(this.cx - this.R, this.cy - this.R, this.R * 2, this.R * 2);
    ctx.lineWidth = 3;
    for (let y = -this.R; y < this.R; y += 9) {
      ctx.strokeStyle = (y / 9) % 2 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.moveTo(this.cx - this.R, this.cy + y);
      ctx.lineTo(this.cx + this.R, this.cy + y - 40);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.stroke(path);
    ctx.restore();
    for (let i = 0; i < 8; i++) {
      const [x, y] = this.world(p, (i / 8 + t * 0.15) % 1);
      drawFlare(ctx, x, y, this.tol * 0.8, "gold", 1 - k);
    }
  }

  stats(): Stat[] {
    return [
      { label: "바늘땀", value: `${this.stitches}땀` },
      { label: "최고 콤보", value: `${this.maxCombo}` },
      { label: "완성한 자수", value: `${this.sewn.length}개` },
    ];
  }

  private shape(p: Pattern): P2[] {
    return Array.from({ length: 40 }, (_, i) => {
      const [x, y] = p.at(i / 40);
      return [(x + 1) / 2, (y + 1) / 2];
    });
  }

  queue(): QueueItem[] {
    const out: QueueItem[] = [];
    const n = Math.max(PATTERNS.length, this.pi + 1);
    for (let i = 0; i < n; i++) {
      const p = PATTERNS[i % PATTERNS.length];
      out.push({
        label: p.name,
        state: i < this.pi ? "done" : i === this.pi ? "now" : "next",
        pct: i === this.pi ? Math.round((this.next / HOLES) * 100) : undefined,
        shape: this.shape(p),
        aspect: 1,
        color: p.thread,
      });
    }
    return out.slice(Math.max(0, this.pi - 2), Math.max(0, this.pi - 2) + 5);
  }

  meter(): Meter {
    return this.fever()
      ? { label: "황금실 피버", value: 1, text: `${this.combo}콤보 · 점수 2배!`, hot: true }
      : {
          label: "콤보",
          value: this.combo / FEVER_AT,
          text:
            this.combo > 0 ? `${this.combo}콤보 · ${FEVER_AT}콤보면 피버` : "빨리 이어 찍으면 콤보",
        };
  }

  collection(): Item[] {
    return this.sewn.map((p) => ({
      label: `${p.name} 자수`,
      shape: this.shape(p),
      aspect: 1,
      color: p.thread,
    }));
  }

  demo(t: number): DemoHand[] {
    const h = this.holes[this.next] ?? this.holes[0];
    const from = this.demoPos ?? { x: this.W / 2, y: this.H / 2 };
    this.demoPos = {
      x: from.x + (h.x - from.x) * 0.16,
      y: from.y + (h.y - from.y) * 0.16 + Math.sin(t * 3) * 1.5,
    };
    return [this.demoPos];
  }

  target(): DemoHand | null {
    const h = this.holes[this.next];
    return h ? { x: h.x, y: h.y } : null;
  }
}

/** 꼬인 실 한 땀: 그림자 + 실 색 + 꼬임 무늬. */
function drawThread(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  w: number,
): void {
  const line = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 + dx, y0 + dy);
    ctx.lineTo(x1 + dx, y1 + dy);
    ctx.stroke();
  };
  ctx.strokeStyle = "rgba(40,24,20,0.35)";
  ctx.lineWidth = w;
  line(2, 4);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  line(0, 0);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = w * 0.3;
  ctx.setLineDash([w * 0.5, w * 0.6]);
  line(0, -w * 0.12);
  ctx.setLineDash([]);
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
  // 땀을 뜬 순간 바늘이 끝 쪽(왼쪽 아래)으로 콕 들어갔다 나온다
  const dip = Math.sin(Math.min(1, flash / 0.25) * Math.PI) * R * 0.3;
  ctx.translate(h.x - dip, h.y + dip);
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
  } else {
    ctx.rotate(-0.7);
    ctx.fillStyle = fever ? "#ffd34d" : "#e6ebf4";
    ctx.strokeStyle = "#4d4866";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(-R * 0.13, -R * 1.5);
    ctx.quadraticCurveTo(0, -R * 1.8, R * 0.13, -R * 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
