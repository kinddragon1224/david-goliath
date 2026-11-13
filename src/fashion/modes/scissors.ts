import {
  drawHandGlow,
  drawPalace,
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
import { pathOf, resample, type Pt } from "../garments";

/** 04 가위질 챌린지 · 재단
 * 재단대 원단 위에 옷본 조각이 분필선으로 그려진다. 손(가위)을 선 위에 대고 따라가면
 * 지나간 만큼 원단이 갈라진다. 선 어디서든 시작해 양쪽으로 오릴 수 있고, 한 바퀴 다 오리면
 * 조각이 원단에서 들려 옆 작업대로 간다. 옷 한 벌의 조각을 다 오리면 재단 완성.
 * 선에 가까울수록 정확도가 높고 점수가 크다. 감점은 없다. */

type Seg = Pt | [Pt, Pt];
type Print = "dots" | "stripes" | "check";
type PieceDef = {
  name: string;
  aspect: number;
  pts: Pt[];
  /** 식서(결) 화살표: 단위 좌표 두 점. */
  grain: [Pt, Pt];
  /** 가위집 자리(둘레 비율). */
  notches: number[];
  /** 추천 시작점(둘레 비율). */
  start: number;
};
type GarmentDef = { name: string; color: string; print: Print; pieces: PieceDef[] };

/** 첫 점에서 시작해 직선(Pt) 또는 2차 곡선([조절점, 끝점])을 이어 닫힌 선을 만든다. */
function shape(...segs: Seg[]): Pt[] {
  const out: Pt[] = [segs[0] as Pt];
  for (const s of segs.slice(1)) {
    if (typeof s[0] === "number") {
      out.push(s as Pt);
      continue;
    }
    const [[cx, cy], [ex, ey]] = s as [Pt, Pt];
    const [sx, sy] = out[out.length - 1];
    for (let i = 1; i <= 10; i++) {
      const k = i / 10;
      const u = 1 - k;
      out.push([u * u * sx + 2 * u * k * cx + k * k * ex, u * u * sy + 2 * u * k * cy + k * k * ey]);
    }
  }
  return out;
}

const V_GRAIN: [Pt, Pt] = [
  [0.5, 0.32],
  [0.5, 0.78],
];

const GARMENTS: GarmentDef[] = [
  {
    name: "블라우스",
    color: "#f2b8c6",
    print: "dots",
    pieces: [
      {
        name: "앞판",
        aspect: 0.86,
        pts: shape(
          [0.3, 0.03],
          [[0.5, 0.26], [0.7, 0.03]],
          [0.94, 0.11],
          [[0.8, 0.22], [0.86, 0.4]],
          [0.92, 0.97],
          [[0.5, 1.03], [0.08, 0.97]],
          [0.14, 0.4],
          [[0.2, 0.22], [0.06, 0.11]],
        ),
        grain: V_GRAIN,
        notches: [0.22, 0.78],
        start: 0.55,
      },
      {
        name: "소매",
        aspect: 1.3,
        pts: shape(
          [0.0, 0.62],
          [[0.18, 0.06], [0.5, 0.03]],
          [[0.82, 0.06], [1.0, 0.62]],
          [0.84, 0.97],
          [0.16, 0.97],
        ),
        grain: V_GRAIN,
        notches: [0.18, 0.32],
        start: 0.7,
      },
      {
        name: "칼라",
        aspect: 2,
        pts: shape([0.02, 0.3], [[0.5, 1.25], [0.98, 0.3]], [0.86, 0.06], [[0.5, 0.72], [0.14, 0.06]]),
        grain: [
          [0.38, 0.62],
          [0.62, 0.62],
        ],
        notches: [0.25],
        start: 0.0,
      },
    ],
  },
  {
    name: "플레어 스커트",
    color: "#6f9bd8",
    print: "check",
    pieces: [
      {
        name: "앞판 · 다트",
        aspect: 1.2,
        pts: shape(
          [0.3, 0.04],
          [0.4, 0.05],
          [0.43, 0.22],
          [0.46, 0.055],
          [0.54, 0.055],
          [0.57, 0.22],
          [0.6, 0.05],
          [0.7, 0.04],
          [0.98, 0.88],
          [[0.5, 1.08], [0.02, 0.88]],
        ),
        grain: V_GRAIN,
        notches: [0.72, 0.95],
        start: 0.55,
      },
      {
        name: "뒤판",
        aspect: 1.2,
        pts: shape([0.3, 0.04], [[0.5, 0.1], [0.7, 0.04]], [0.98, 0.88], [[0.5, 1.08], [0.02, 0.88]]),
        grain: V_GRAIN,
        notches: [0.3],
        start: 0.55,
      },
      {
        name: "주머니",
        aspect: 0.9,
        pts: shape([0.08, 0.06], [0.92, 0.06], [0.92, 0.66], [[0.92, 0.96], [0.5, 0.96]], [[0.08, 0.96], [0.08, 0.66]]),
        grain: V_GRAIN,
        notches: [0.12],
        start: 0.5,
      },
    ],
  },
  {
    name: "한복 저고리",
    color: "#58b38a",
    print: "stripes",
    pieces: [
      {
        name: "길",
        aspect: 0.95,
        pts: shape([0.06, 0.06], [0.94, 0.06], [0.94, 0.8], [[0.62, 0.9], [0.3, 0.97]], [0.06, 0.88]),
        grain: V_GRAIN,
        notches: [0.2, 0.62],
        start: 0.6,
      },
      {
        name: "소매 · 배래",
        aspect: 1.5,
        pts: shape([0.0, 0.08], [1.0, 0.08], [1.0, 0.52], [[0.55, 1.06], [0.0, 0.9]]),
        grain: [
          [0.25, 0.4],
          [0.75, 0.4],
        ],
        notches: [0.3],
        start: 0.55,
      },
      {
        name: "고름",
        aspect: 0.34,
        pts: shape([0.1, 0.0], [0.9, 0.0], [0.9, 0.86], [0.5, 1.0], [0.1, 0.86]),
        grain: V_GRAIN,
        notches: [0.5],
        start: 0.55,
      },
    ],
  },
];

/** 판정 여유(무대 짧은 변 비율). 손 떨림을 견딜 만큼. */
const TOL = 0.065;
/** 선 위 점 간격(무대 짧은 변 비율). */
const STEP = 0.028;
const DRAW_T = 0.6;
const LIFT_T = 1.15;
const PIECE_BONUS = 300;
const ACC_BONUS = 500;
const NOTCH_BONUS = 80;
const GARMENT_BONUS = 1000;
/** 오릴수록 올라가는 음(반음). */
const LADDER = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];

type Done = { def: PieceDef; color: string; acc: number };

export class ScissorsMode implements Mode {
  seconds = 35;
  hint = "분필선 위에 가위 손을 대고 따라 오려요";
  tip = "분필선을 따라 가위 손을 천천히!";
  grades: [number, number, number] = [13000, 8000, 3500];
  music = "lofi" as const;
  private W = 1400;
  private H = 860;
  private g0 = 0;
  private gi = 0;
  private pi = 0;
  private P: Pt[] = [];
  private cut: boolean[] = [];
  private notch = new Set<number>();
  private count = 0;
  private a = 0;
  private b = 0;
  private s = 0;
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private path = new Path2D();
  private inner = new Path2D();
  private accSum = 0;
  private accN = 0;
  private stage: "draw" | "cut" | "lift" = "draw";
  private stageT = 0;
  private cutStart = 0;
  private rack: Done[] = [];
  private garmentsDone: { name: string; color: string; n: number; acc: number }[] = [];
  private pieces = 0;
  private accAll = 0;
  private prev: (Pt | null)[] = [null, null];
  private snip = [0, 0];
  private lastSfx = -1;
  private bits: { x: number; y: number; vx: number; vy: number; a: number; life: number; c: string }[] = [];

  private garment(): GarmentDef {
    return GARMENTS[(this.g0 + this.gi) % GARMENTS.length];
  }
  private piece(): PieceDef {
    return this.garment().pieces[this.pi];
  }
  private tol(): number {
    return Math.min(this.W, this.H) * TOL;
  }
  private fabric() {
    return { x: this.W * 0.17, y: this.H * 0.05, w: this.W * 0.66, h: this.H * 0.9 };
  }

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.g0 = Math.floor(Math.random() * GARMENTS.length);
    this.gi = 0;
    this.pi = 0;
    this.rack = [];
    this.garmentsDone = [];
    this.pieces = 0;
    this.accAll = 0;
    this.prev = [null, null];
    this.snip = [0, 0];
    this.bits = [];
    this.load();
  }

  private load(): void {
    const d = this.piece();
    let h = this.H * 0.66;
    let w = h * d.aspect;
    if (w > this.W * 0.44) {
      w = this.W * 0.44;
      h = w / d.aspect;
    }
    this.box = { x: this.W * 0.5 - w / 2, y: this.H * 0.5 - h / 2, w, h };
    const world: Pt[] = d.pts.map(([x, y]) => [this.box.x + x * w, this.box.y + y * h]);
    const P = resample(world, Math.min(this.W, this.H) * STEP);
    if (P.length > 2 && dist(P[P.length - 1], P[0]) < Math.min(this.W, this.H) * STEP * 0.5) P.pop();
    this.P = P;
    const N = P.length;
    this.cut = new Array(N).fill(false);
    this.notch = new Set(d.notches.map((f) => Math.round(f * N) % N));
    this.s = Math.round(d.start * N) % N;
    this.count = 0;
    this.a = this.s;
    this.b = (this.s - 1 + N) % N;
    this.accSum = 0;
    this.accN = 0;
    this.path = pathOf(P);
    // 완성선(시접 안쪽): 가운데로 조금 당긴 선
    const cx = P.reduce((s, p) => s + p[0], 0) / N;
    const cy = P.reduce((s, p) => s + p[1], 0) / N;
    const r = P.reduce((s, p) => s + dist(p, [cx, cy]), 0) / N;
    const k = 1 - Math.min(0.2, (this.H * 0.022) / r);
    this.inner = pathOf(P.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]));
    this.stage = "draw";
    this.stageT = 0;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.snip = this.snip.map((s) => Math.max(0, s - dt));
    for (const b of this.bits) {
      b.life -= dt;
      b.vy += 900 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += dt * 7;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
    this.stageT += dt;
    if (this.stage === "draw" && this.stageT >= DRAW_T) {
      this.stage = "cut";
      this.stageT = 0;
      this.cutStart = t;
    }
    if (this.stage === "lift" && this.stageT >= LIFT_T) this.next(fx);

    hands.forEach((h, hi) => {
      const p0 = this.prev[hi];
      this.prev[hi] = h.on ? [h.x, h.y] : null;
      if (!h.on || this.stage !== "cut") return;
      // 빠르게 휘둘러도 사이를 건너뛰지 않게 지난 자리부터 촘촘히 훑는다
      const from = p0 ?? [h.x, h.y];
      const n = Math.min(24, Math.max(1, Math.ceil(dist(from, [h.x, h.y]) / (this.tol() * 0.4))));
      let got = 0;
      for (let i = 1; i <= n && this.stage === "cut"; i++) {
        const k = i / n;
        got += this.advance([from[0] + (h.x - from[0]) * k, from[1] + (h.y - from[1]) * k], fx);
      }
      if (!got) return;
      this.snip[hi] = 0.18;
      if (t - this.lastSfx > 0.09) {
        this.lastSfx = t;
        const step = LADDER[Math.min(LADDER.length - 1, Math.floor((this.count / this.P.length) * LADDER.length))];
        fx.sfx("snip", step);
      }
    });

    const d = this.piece();
    const g = this.garment();
    this.hint =
      this.stage === "cut" && this.count === 0
        ? `분필선 위에 가위 손을 대요 · ${g.name} ${d.name}`
        : `선을 따라 쭉 오려요 · ${g.name} ${d.name} (${this.pi + 1}/${g.pieces.length})`;
  }

  /** 손 자리 hp에서 오릴 수 있는 만큼 양쪽 끝을 밀고 나간다. 오린 점 수를 돌려준다. */
  private advance(hp: Pt, fx: Fx): number {
    const N = this.P.length;
    const tol = this.tol();
    if (this.count === 0) {
      // 선 어디서든 시작: 손에서 가장 가까운 점
      let best = -1;
      let bd = tol;
      this.P.forEach((p, i) => {
        const d = dist(hp, p);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      if (best < 0) return 0;
      this.s = best;
      this.a = best;
      this.b = (best - 1 + N) % N;
    }
    let got = 0;
    for (const dir of [1, -1]) {
      for (let guard = 0; guard < 30; guard++) {
        const idx = dir > 0 ? this.a : this.b;
        if (this.cut[idx] || dist(hp, this.P[idx]) > tol) break;
        // 정확도: 손이 선에서 옆으로 벗어난 거리(손 근처 선분 중 가장 가까운 것)
        let d = dist(hp, this.P[idx]);
        for (let k = -3; k <= 6; k++) {
          const i0 = (((idx + dir * k) % N) + N) % N;
          const i1 = (((idx + dir * (k + 1)) % N) + N) % N;
          d = Math.min(d, segDist(hp, this.P[i0], this.P[i1]));
        }
        const acc = Math.max(0, Math.min(1, 1 - d / tol));
        this.cut[idx] = true;
        this.count++;
        got++;
        this.accSum += acc;
        this.accN++;
        const [x, y] = this.P[idx];
        fx.score(Math.round(10 * (0.6 + 0.8 * acc)), x, y);
        if (this.notch.has(idx)) fx.score(NOTCH_BONUS, x, y - 30, `가위집 +${NOTCH_BONUS}`, "mint");
        if (Math.random() < 0.3 && this.bits.length < 50)
          this.bits.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 260,
            vy: -60 - Math.random() * 160,
            a: Math.random() * 3,
            life: 0.5 + Math.random() * 0.4,
            c: this.garment().color,
          });
        if (dir > 0) this.a = (idx + 1) % N;
        else this.b = (idx - 1 + N) % N;
        if (this.count === N) {
          this.finish(fx);
          return got;
        }
      }
    }
    return got;
  }

  private acc(): number {
    return this.accN ? this.accSum / this.accN : 0;
  }

  private finish(fx: Fx): void {
    const acc = this.acc();
    const d = this.piece();
    const cx = this.box.x + this.box.w / 2;
    const cy = this.box.y + this.box.h / 2;
    const bonus = Math.round(PIECE_BONUS + ACC_BONUS * acc);
    const sharp = acc >= 0.9;
    fx.score(bonus, cx, cy - 40, `${d.name} 재단 +${bonus}`, sharp ? "gold" : "white");
    fx.stamp(sharp ? "칼같이!" : acc >= 0.75 ? "깔끔해요!" : "좋아요!", cx, cy + 60, sharp ? "gold" : "mint");
    fx.sfx("complete");
    fx.burst(cx, cy, sharp ? 26 : 12, sharp ? "gold" : "white");
    fx.shake(0.15);
    if (sharp) fx.say("clean-cut");
    this.rack.push({ def: d, color: this.garment().color, acc });
    this.pieces++;
    this.accAll += acc;
    this.stage = "lift";
    this.stageT = 0;
  }

  private next(fx: Fx): void {
    const g = this.garment();
    this.pi++;
    if (this.pi >= g.pieces.length) {
      const acc = this.rack.reduce((s, r) => s + r.acc, 0) / this.rack.length;
      this.garmentsDone.push({ name: g.name, color: g.color, n: this.rack.length, acc });
      fx.score(GARMENT_BONUS, this.W / 2, this.H * 0.45, `${g.name} 재단 완성 +${GARMENT_BONUS}`, "pink");
      fx.celebrate(`${g.name} 재단 완성!`, "pink");
      fx.shake(0.4);
      this.rack = [];
      this.pi = 0;
      this.gi++;
    }
    this.load();
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], _phase: Phase): void {
    drawMat(ctx, this.W, this.H, t);
    const g = this.garment();
    const F = this.fabric();
    const lift = this.stage === "lift" ? Math.min(1, this.stageT / LIFT_T) : 0;
    // 원단: 다 오리면 그 자리가 뚫려 아래 매트가 보인다
    const sheet = new Path2D();
    sheet.rect(F.x, F.y, F.w, F.h);
    if (this.stage === "lift") sheet.addPath(this.path);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = g.color;
    ctx.fill(sheet, "evenodd");
    ctx.restore();
    ctx.save();
    ctx.clip(sheet, "evenodd");
    drawCloth(ctx, F.x, F.y, F.w, F.h, g.color, g.print);
    ctx.restore();
    if (this.stage === "lift") {
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 6;
      ctx.stroke(this.path);
    }
    drawSelvage(ctx, F);

    if (this.stage !== "lift") this.drawPattern(ctx, t);
    this.drawRack(ctx);
    this.drawOrder(ctx);
    if (this.stage === "lift") this.drawLifted(ctx, lift);

    for (const b of this.bits) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.life * 2.5);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.strokeStyle = b.c;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.quadraticCurveTo(0, -6, 9, 0);
      ctx.stroke();
      ctx.restore();
    }
    const R = Math.min(this.W, this.H) * 0.085;
    hands.forEach((h, i) => drawScissors(ctx, h, R, this.snip[i] ?? 0, t));
  }

  /** 옷본 표시: 완성선, 식서 화살표, 이름, 시침핀, 분필 재단선(오린 곳은 갈라진 틈), 가위집. */
  private drawPattern(ctx: CanvasRenderingContext2D, t: number): void {
    const d = this.piece();
    const { x, y, w, h } = this.box;
    const N = this.P.length;
    const shown = this.stage === "draw" ? Math.floor((this.stageT / DRAW_T) * N) : N;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (this.stage !== "draw") {
      ctx.setLineDash([3, 9]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.stroke(this.inner);
      ctx.setLineDash([]);
      // 식서 화살표
      const [[gx0, gy0], [gx1, gy1]] = d.grain.map(([u, v]) => [x + u * w, y + v * h]);
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gx0, gy0);
      ctx.lineTo(gx1, gy1);
      const ang = Math.atan2(gy1 - gy0, gx1 - gx0);
      for (const [px, py, s] of [
        [gx0, gy0, -1],
        [gx1, gy1, 1],
      ]) {
        for (const side of [-1, 1]) {
          ctx.moveTo(px, py);
          ctx.lineTo(px - s * Math.cos(ang + side * 0.45) * 18, py - s * Math.sin(ang + side * 0.45) * 18);
        }
      }
      ctx.stroke();
      // 이름(분필 글씨)
      const fs = Math.round(Math.min(46, Math.max(24, Math.min(w, h) * 0.12)));
      ctx.font = `700 ${fs}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      const lx = (gx0 + gx1) / 2 + (Math.abs(gx1 - gx0) > Math.abs(gy1 - gy0) ? 0 : fs * 1.6);
      const ly = (gy0 + gy1) / 2 - (Math.abs(gx1 - gx0) > Math.abs(gy1 - gy0) ? fs * 1.1 : 0);
      ctx.strokeText(d.name, lx, ly);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(d.name, lx, ly);
      // 시침핀
      const pins: Pt[] = [
        [0.3, 0.3],
        [0.7, 0.3],
        [0.5, 0.82],
      ];
      for (const [u, v] of pins) {
        const px = x + u * w;
        const py = y + v * h;
        if (!ctx.isPointInPath(this.inner, px, py)) continue;
        ctx.strokeStyle = "#d9dde5";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px - 16, py + 10);
        ctx.lineTo(px + 14, py - 8);
        ctx.stroke();
        ctx.fillStyle = "#e8505b";
        ctx.beginPath();
        ctx.arc(px + 14, py - 8, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 재단선: 오린 구간은 갈라진 틈, 남은 구간은 분필 점선
    const chalk = new Path2D();
    const slit = new Path2D();
    for (let i = 0; i < Math.min(shown, N); i++) {
      const j = (i + 1) % N;
      const [x0, y0] = this.P[i];
      const [x1, y1] = this.P[j];
      const p = this.cut[i] && this.cut[j] ? slit : chalk;
      p.moveTo(x0, y0);
      p.lineTo(x1, y1);
    }
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(10,10,20,0.4)";
    ctx.stroke(chalk);
    ctx.setLineDash([14, 9]);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.stroke(chalk);
    ctx.setLineDash([]);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#07080d";
    ctx.stroke(slit);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.stroke(slit);
    // 가위집: 선 안쪽으로 짧은 칼집
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (const i of this.notch) {
      if (i >= shown) continue;
      const [px, py] = this.P[i];
      const l = Math.hypot(cx - px, cy - py) || 1;
      ctx.strokeStyle = this.cut[i] ? "#07080d" : "#ffffff";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + ((cx - px) / l) * 20, py + ((cy - py) / l) * 20);
      ctx.stroke();
    }
    // 오릴 자리 표시
    if (this.stage === "cut") {
      const pulse = 0.6 + Math.sin(t * 8) * 0.4;
      const marks = this.count === 0 ? [this.s] : [this.a, this.b];
      for (const i of marks) {
        const [px, py] = this.P[i];
        ctx.strokeStyle = TONE.gold;
        ctx.globalAlpha = pulse;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(px, py, 18 + pulse * 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (this.count === 0) {
        const [px, py] = this.P[this.s];
        ctx.font = `700 34px "Gowun Batang", serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(10,12,20,0.9)";
        ctx.strokeText("여기부터 싹둑", px, py + 62);
        ctx.fillStyle = TONE.gold;
        ctx.fillText("여기부터 싹둑", px, py + 62);
      }
    }
    ctx.restore();
  }

  /** 다 오린 조각: 원단에서 들렸다가 오른쪽 작업대로 날아간다. */
  private drawLifted(ctx: CanvasRenderingContext2D, k: number): void {
    const g = this.garment();
    const { x, y, w, h } = this.box;
    const up = Math.min(1, k / 0.4);
    const fly = Math.max(0, (k - 0.4) / 0.6) ** 2;
    const slot = this.slot(this.rack.length - 1);
    const s0 = 1 + up * 0.05;
    const s = s0 + (slot.s / Math.max(w, h) - s0) * fly;
    const cx = x + w / 2 + (slot.x - x - w / 2) * fly;
    const cy = y + h / 2 - up * 14 + (slot.y - y - h / 2) * fly;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(fly * 0.3);
    ctx.scale(s, s);
    ctx.translate(-x - w / 2, -y - h / 2);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 10 + up * 30;
    ctx.shadowOffsetY = up * 22;
    ctx.fillStyle = g.color;
    ctx.fill(this.path);
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.clip(this.path);
    drawCloth(ctx, x, y, w, h, g.color, g.print);
    ctx.restore();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.stroke(this.path);
    ctx.restore();
  }

  private slot(i: number) {
    // 양옆 아래는 '다른 체험' 버튼이 덮으니 오른쪽 위에만 쌓는다
    return { x: this.W * 0.915, y: this.H * (0.18 + i * 0.105), s: Math.min(this.W * 0.1, this.H * 0.075) };
  }

  /** 오른쪽 작업대: 이번 옷에서 다 오린 조각들. */
  private drawRack(ctx: CanvasRenderingContext2D): void {
    const n = this.stage === "lift" ? this.rack.length - 1 : this.rack.length;
    ctx.save();
    ctx.font = `700 26px "Gowun Batang", serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,240,215,0.75)";
    ctx.fillText("오린 조각", this.W * 0.915, this.H * 0.1);
    for (let i = 0; i < n; i++) {
      const r = this.rack[i];
      const { x, y, s } = this.slot(i);
      const w = r.def.aspect >= 1 ? s : s * r.def.aspect;
      const h = r.def.aspect >= 1 ? s / r.def.aspect : s;
      const path = pathOf(r.def.pts.map(([u, v]) => [x - w / 2 + u * w, y - h / 2 + v * h]));
      ctx.fillStyle = r.color;
      ctx.fill(path);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.stroke(path);
      ctx.font = `600 18px sans-serif`;
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,240,215,0.85)";
      ctx.fillText(`${Math.round(r.acc * 100)}%`, x + s * 0.62, y + 6);
      ctx.textAlign = "center";
    }
    ctx.restore();
  }

  /** 왼쪽 작업지시서: 지금 옷과 조각 목록. */
  private drawOrder(ctx: CanvasRenderingContext2D): void {
    const g = this.garment();
    const x = this.W * 0.02;
    const y = this.H * 0.12;
    const w = this.W * 0.13;
    const h = this.H * (0.16 + g.pieces.length * 0.075);
    ctx.save();
    ctx.translate(x + w / 2, y);
    ctx.rotate(-0.03);
    ctx.translate(-x - w / 2, -y);
    ctx.fillStyle = "#f4ead6";
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 14;
    ctx.fillRect(x, y, w, h);
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#b8463e";
    ctx.fillRect(x, y, w, 8);
    ctx.textAlign = "left";
    ctx.fillStyle = "#3a2c22";
    ctx.font = `600 18px sans-serif`;
    ctx.fillText("작업지시서", x + 14, y + 34);
    ctx.font = `700 26px "Gowun Batang", serif`;
    ctx.fillText(g.name, x + 14, y + 72);
    g.pieces.forEach((p, i) => {
      const ly = y + 110 + i * this.H * 0.075;
      const done = i < this.pi || (i === this.pi && this.stage === "lift");
      ctx.strokeStyle = "#3a2c22";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 14, ly - 14, 20, 20);
      if (done) {
        ctx.strokeStyle = "#b8463e";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 17, ly - 4);
        ctx.lineTo(x + 24, ly + 3);
        ctx.lineTo(x + 38, ly - 18);
        ctx.stroke();
      }
      ctx.font = `${i === this.pi ? 700 : 500} 20px sans-serif`;
      ctx.fillStyle = i === this.pi ? "#b8463e" : "#3a2c22";
      ctx.fillText(p.name, x + 44, ly + 2, w - 52);
    });
    ctx.restore();
  }

  stats(): Stat[] {
    return [
      { label: "오린 조각", value: `${this.pieces}장` },
      { label: "재단 완성", value: `${this.garmentsDone.length}벌` },
      { label: "평균 정확도", value: this.pieces ? `${Math.round((this.accAll / this.pieces) * 100)}%` : "-" },
    ];
  }

  queue(): QueueItem[] {
    const g = this.garment();
    return g.pieces.map((p, i) => ({
      label: p.name,
      state: i < this.pi ? "done" : i === this.pi ? "now" : "next",
      pct: i === this.pi ? Math.round((this.count / Math.max(1, this.P.length)) * 100) : undefined,
      shape: p.pts,
      aspect: p.aspect,
      color: g.color,
    }));
  }

  meter(): Meter {
    const acc = this.acc();
    return {
      label: "정확도",
      value: acc,
      text: this.accN ? `${Math.round(acc * 100)}% · 선 위로 또박또박` : "분필선 위에 가위를 대요",
      hot: acc >= 0.85,
    };
  }

  collection(): Item[] {
    const items: Item[] = this.garmentsDone.map((g) => ({
      label: g.name,
      color: g.color,
      note: `${g.n}조각 · 정확도 ${Math.round(g.acc * 100)}%`,
    }));
    if (this.rack.length)
      items.push({ label: `${this.garment().name}(재단 중)`, color: this.garment().color, note: `${this.rack.length}조각` });
    return items;
  }

  demo(t: number): DemoHand[] {
    if (this.stage !== "cut" || !this.P.length) return [{ x: this.W * 0.5, y: this.H * 0.5 }];
    if (this.count === 0) {
      const [x, y] = this.P[this.s];
      return [{ x, y }];
    }
    // 선을 따라 초당 15점씩 나아간다
    const N = this.P.length;
    const u = this.s + Math.max(0, t - this.cutStart) * 15;
    const i = Math.floor(u) % N;
    const [x0, y0] = this.P[i];
    const [x1, y1] = this.P[(i + 1) % N];
    const k = u - Math.floor(u);
    return [{ x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * k }];
  }

  target(): DemoHand | null {
    if (this.stage !== "cut") return null;
    const [x, y] = this.P[this.count === 0 ? this.s : this.a];
    return { x, y };
  }
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
  return Math.hypot(p[0] - a[0] - dx * k, p[1] - a[1] - dy * k);
}

/** 원단 왼쪽 끝 식서(셀비지): 구멍 줄과 직물 이름. */
function drawSelvage(ctx: CanvasRenderingContext2D, F: { x: number; y: number; w: number; h: number }): void {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(F.x, F.y, 22, F.h);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  for (let yy = F.y + 14; yy < F.y + F.h; yy += 26) {
    ctx.beginPath();
    ctx.arc(F.x + 8, yy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.translate(F.x + 17, F.y + F.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `600 13px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(40,30,30,0.6)";
  ctx.fillText("WEAVE ON 중촌 · 100% COTTON · WEAVE ON 중촌", 0, 0);
  ctx.restore();
}

/** 천 한 장: 바탕색 + 무늬 + 위에서 비치는 빛. */
function drawCloth(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  print: Print,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  drawPrint(ctx, x, y, w, h, print, "#ffffff");
  const lit = ctx.createLinearGradient(x, y, x + w, y + h);
  lit.addColorStop(0, "rgba(255,255,255,0.2)");
  lit.addColorStop(1, "rgba(0,0,0,0.18)");
  ctx.fillStyle = lit;
  ctx.fillRect(x, y, w, h);
}

/** 재단실: 원단 아래 검은 재단 매트(은빛 눈금 + 자 눈금). */
function drawMat(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  drawPalace(ctx, W, H, t, ["#1a1626", "#07070c"], "scissors");
  const x = W * 0.12;
  const y = H * 0.03;
  const w = W * 0.76;
  const h = H * 0.94;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  const mat = ctx.createLinearGradient(x, y, x + w, y + h);
  mat.addColorStop(0, "#232a38");
  mat.addColorStop(1, "#10141d");
  ctx.fillStyle = mat;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.clip();
  const cell = w / 30;
  for (let i = 1; i * cell < Math.max(w, h); i++) {
    ctx.strokeStyle = i % 5 === 0 ? "rgba(236,255,248,0.26)" : "rgba(236,255,248,0.1)";
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.beginPath();
    if (i * cell < w) {
      ctx.moveTo(x + i * cell, y);
      ctx.lineTo(x + i * cell, y + h);
    }
    if (i * cell < h) {
      ctx.moveTo(x, y + i * cell);
      ctx.lineTo(x + w, y + i * cell);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(236,255,248,0.55)";
  ctx.font = `600 ${Math.round(cell * 0.42)}px sans-serif`;
  ctx.textAlign = "center";
  for (let i = 1; i * cell < w; i++) {
    ctx.fillRect(x + i * cell - 1, y, 2, i % 5 === 0 ? cell * 0.45 : cell * 0.22);
    if (i % 5 === 0) ctx.fillText(String(i), x + i * cell, y + cell * 0.85);
  }
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#8ea0b4";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#e6f6ff";
  ctx.stroke();
}

/** 원단 무늬. */
function drawPrint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: Print,
  color: string,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (kind === "dots") {
    for (let j = 0, yy = y + 20; yy < y + h; yy += 44, j++)
      for (let xx = x + 20 + (j % 2) * 22; xx < x + w; xx += 44) {
        ctx.beginPath();
        ctx.arc(xx, yy, 6, 0, Math.PI * 2);
        ctx.fill();
      }
  } else if (kind === "stripes") {
    ctx.lineWidth = 14;
    for (let xx = x - h; xx < x + w; xx += 48) {
      ctx.beginPath();
      ctx.moveTo(xx, y);
      ctx.lineTo(xx + h, y + h);
      ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.18;
    for (let xx = x; xx < x + w; xx += 60) ctx.fillRect(xx, y, 26, h);
    for (let yy = y; yy < y + h; yy += 60) ctx.fillRect(x, yy, w, 26);
  }
  ctx.restore();
}

function drawScissors(ctx: CanvasRenderingContext2D, h: Hand, R: number, snip: number, t: number): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, R * 1.05, "mint");
  ctx.save();
  ctx.translate(h.x, h.y);
  // 움직이는 쪽을 향한다
  const dir = h.speed > 30 ? Math.atan2(h.vy, h.vx) : -Math.PI / 2;
  ctx.rotate(dir + Math.PI / 2);
  const img = propImage("scissors");
  if (img) {
    // 그림은 날이 위. 손 위치 = 날이 엇갈리는 축. 싹둑할 때 가로로 좁혀 날이 닫히는 것처럼.
    const ih = R * 3;
    const w = (ih * img.naturalWidth) / img.naturalHeight;
    const close = snip > 0 ? Math.sin((snip / 0.18) * Math.PI) * 0.35 : 0;
    const wob = h.ghost ? Math.sin(t * 10) * 0.08 : 0;
    ctx.scale(1 - close + wob, 1);
    ctx.globalAlpha = h.ghost ? 0.8 : 1;
    ctx.drawImage(img, -w * 0.5, -ih * 0.52, w, ih);
    ctx.restore();
    return;
  }
  const s = R / 62;
  ctx.scale(s, s);
  ctx.globalAlpha = h.ghost ? 0.8 : 1;
  const open =
    0.34 - (snip > 0 ? 0.3 * Math.sin((snip / 0.18) * Math.PI) : 0) + (h.ghost ? Math.sin(t * 10) * 0.08 : 0);
  for (const sign of [-1, 1]) {
    ctx.save();
    ctx.rotate(sign * open - Math.PI / 2);
    ctx.fillStyle = "#eef2f8";
    ctx.strokeStyle = "#4d4866";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-72, -2);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
