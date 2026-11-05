import {
  drawFlare,
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

/** 04 가위질 챌린지
 * 손이 가위. 줄에 걸린 천의 점선을 쓱 지나가면 싹둑 잘린다.
 * 잘린 천 조각이 아래 조각보 칸으로 날아가 붙고, 칸을 다 채우면 조각보 한 장 완성.
 * 선을 정확히 따라가지 않아도 되고 틀려도 감점이 없다. 금빛 천은 점수 3배. */

const LANES = 5;
const COLS = 6;
const ROWS = 3;
const CELLS = COLS * ROWS;
const COLORS = ["#e8505b", "#2f6fb5", "#e0a91f", "#2e8b57", "#d9539a", "#7a55c7", "#f0824a"];
const PRINTS = ["dots", "stripes", "check"] as const;
type Print = (typeof PRINTS)[number];
const QUILT_BONUS = 1000;
/** 손이 이만큼 빠르면(초당 무대 폭 비율) 가위질로 친다. 천천히 대기만 해선 안 잘린다. */
const CUT_SPEED = 0.14;
const CHAIN_GAP = 1.6;
const FLY_T = 0.6;
/** 이어 자를 때 올라가는 음(반음). */
const LADDER = [2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

type Ribbon = {
  color: string;
  print: Print;
  gold: boolean;
  /** 위에서 내려오는 정도 0~1. */
  drop: number;
  cutAt: number | null;
};
type Patch = { color: string; print: Print; gold: boolean };
type Piece = Patch & { x: number; y: number; w: number; h: number; cell: number; t: number };

export class ScissorsMode implements Mode {
  seconds = 35;
  hint = "손을 휘둘러 점선을 싹둑! 천 조각으로 조각보를 채워요";
  tip = "가위 손으로 점선을 쓱 지나가요!";
  grades: [number, number, number] = [12000, 7000, 3000];
  music = "lofi" as const;
  private W = 1400;
  private H = 860;
  private ribbons: Ribbon[] = [];
  private patches: Patch[] = [];
  private pieces: Piece[] = [];
  private quilts: Patch[][] = [];
  private cuts = 0;
  private chain = 0;
  private maxChain = 0;
  private lastCut = -10;
  private lastHand = -1;
  private hit = [-10, -10];
  private snip = [0, 0];
  private seed = 1;
  private bits: { x: number; y: number; vx: number; vy: number; a: number; life: number; c: string }[] = [];

  private rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private newRibbon(): Ribbon {
    return {
      color: COLORS[Math.floor(this.rand() * COLORS.length)],
      print: PRINTS[Math.floor(this.rand() * PRINTS.length)],
      gold: this.rand() < 0.14,
      drop: 0,
      cutAt: null,
    };
  }

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.seed = 20261120;
    this.ribbons = Array.from({ length: LANES }, () => ({ ...this.newRibbon(), drop: 1 }));
    this.patches = [];
    this.pieces = [];
    this.quilts = [];
    this.cuts = 0;
    this.chain = 0;
    this.maxChain = 0;
    this.lastCut = -10;
    this.lastHand = -1;
    this.hit = [-10, -10];
    this.snip = [0, 0];
    this.bits = [];
  }

  private laneX(i: number): number {
    return this.W * (0.14 + (0.72 * i) / (LANES - 1));
  }
  private ribbonW(): number {
    return this.W * 0.14;
  }
  private railY(): number {
    return this.H * 0.06;
  }
  private cutY(): number {
    return this.H * 0.36;
  }
  private endY(): number {
    return this.H * 0.54;
  }
  private quilt() {
    const x = this.W * 0.1;
    const y = this.H * 0.6;
    const w = this.W * 0.8;
    const h = this.H * 0.28;
    return { x, y, w, h, cw: w / COLS, ch: h / ROWS };
  }
  private cellBox(i: number) {
    const q = this.quilt();
    return { x: q.x + (i % COLS) * q.cw, y: q.y + Math.floor(i / COLS) * q.ch, w: q.cw, h: q.ch };
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.snip = this.snip.map((s) => Math.max(0, s - dt));
    if (this.chain > 0 && t - this.lastCut > CHAIN_GAP) this.chain = 0;
    for (const b of this.bits) {
      b.life -= dt;
      b.vy += 1400 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += dt * 9;
    }
    this.bits = this.bits.filter((b) => b.life > 0);

    this.ribbons.forEach((r, i) => {
      if (r.cutAt !== null && t - r.cutAt > 0.55) this.ribbons[i] = this.newRibbon();
      else if (r.drop < 1) r.drop = Math.min(1, r.drop + dt * 3);
    });

    hands.forEach((h, hi) => {
      if (!h.on || h.speed < this.W * CUT_SPEED || t - this.hit[hi] < 0.12) return;
      if (Math.abs(h.y - this.cutY()) > this.H * 0.09) return;
      const i = this.ribbons.findIndex(
        (r, k) =>
          r.cutAt === null &&
          r.drop >= 1 &&
          Math.abs(h.x - this.laneX(k)) < this.ribbonW() * 0.68,
      );
      if (i >= 0) this.cut(i, hi, t, fx);
    });

    for (const p of this.pieces) p.t += dt;
    for (const p of this.pieces.filter((q) => q.t >= FLY_T)) this.land(p, fx);
    this.pieces = this.pieces.filter((p) => p.t < FLY_T);

    this.hint =
      this.chain >= 3
        ? `${this.chain}연속 싹둑! 계속 휘둘러요`
        : `점선을 가위 손으로 쓱! 조각보 ${this.patches.length + this.pieces.length}/${CELLS}칸`;
  }

  private cut(i: number, hi: number, t: number, fx: Fx): void {
    const r = this.ribbons[i];
    r.cutAt = t;
    this.hit[hi] = t;
    this.snip[hi] = 0.18;
    this.cuts++;
    this.chain = t - this.lastCut < CHAIN_GAP ? this.chain + 1 : 1;
    this.maxChain = Math.max(this.maxChain, this.chain);
    const x = this.laneX(i);
    const y = this.cutY();
    const pair = hi !== this.lastHand && this.lastHand >= 0 && t - this.lastCut < 0.5;
    this.lastCut = t;
    this.lastHand = hi;
    const pts = (150 + Math.min(this.chain, 10) * 25 + (pair ? 100 : 0)) * (r.gold ? 3 : 1);
    fx.score(pts, x, y - 40, r.gold ? `금빛 천 +${pts}` : `+${pts}`, r.gold ? "gold" : "white");
    fx.stamp(pair ? "양손 싹둑!" : "싹둑!", x, y + 70, r.gold ? "gold" : "mint");
    fx.sfx("snip", LADDER[Math.min(this.chain, LADDER.length) - 1]);
    fx.burst(x, y, r.gold ? 22 : 10, r.gold ? "gold" : "white");
    fx.shake(r.gold ? 0.25 : 0.1);
    if (pair) fx.say("scissors-pair");
    for (let k = 0; k < 7 && this.bits.length < 60; k++)
      this.bits.push({
        x: x + (this.rand() - 0.5) * this.ribbonW(),
        y,
        vx: (this.rand() - 0.5) * 420,
        vy: -120 - this.rand() * 260,
        a: this.rand() * 3,
        life: 0.5 + this.rand() * 0.4,
        c: r.gold ? "#ffd34d" : r.color,
      });
    const w = this.ribbonW();
    this.pieces.push({
      color: r.gold ? "#ffd34d" : r.color,
      print: r.print,
      gold: r.gold,
      x: x - w / 2,
      y,
      w,
      h: this.endY() - y,
      cell: (this.patches.length + this.pieces.length) % CELLS,
      t: 0,
    });
  }

  private land(p: Piece, fx: Fx): void {
    this.patches.push({ color: p.color, print: p.print, gold: p.gold });
    const c = this.cellBox(p.cell);
    fx.burst(c.x + c.w / 2, c.y + c.h / 2, 5, "white");
    if (this.patches.length < CELLS) return;
    this.quilts.push(this.patches);
    this.patches = [];
    fx.score(QUILT_BONUS, this.W / 2, this.H * 0.5, `조각보 완성 +${QUILT_BONUS}`, "pink");
    fx.celebrate("조각보 한 장 완성!", "pink");
    fx.sfx("complete");
    fx.say("clean-cut", true);
    fx.shake(0.5);
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], _phase: Phase): void {
    drawMat(ctx, this.W, this.H, t);
    this.drawRail(ctx);
    this.ribbons.forEach((r, i) => this.drawRibbon(ctx, r, this.laneX(i), t));
    this.drawQuilt(ctx);
    for (const p of this.pieces) {
      const k = Math.min(1, p.t / FLY_T);
      const e = k * k * (3 - 2 * k);
      const c = this.cellBox(p.cell);
      const x = p.x + (c.x - p.x) * e;
      const y = p.y + (c.y - p.y) * e;
      const w = p.w + (c.w - p.w) * e;
      const h = p.h + (c.h - p.h) * e;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(Math.sin(k * Math.PI) * 0.5);
      drawCloth(ctx, -w / 2, -h / 2, w, h, p.color, p.print);
      ctx.restore();
    }
    for (const b of this.bits) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.life * 2.5);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.fillStyle = b.c;
      ctx.fillRect(-8, -3, 16, 6);
      ctx.restore();
    }
    const R = Math.min(this.W, this.H) * 0.085;
    hands.forEach((h, i) => drawScissors(ctx, h, R, this.snip[i] ?? 0, t));
    if (this.chain >= 3 && t - this.lastCut < 0.7) {
      ctx.save();
      ctx.font = `700 ${70 + Math.min(40, this.chain * 2)}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(10,12,20,0.92)";
      ctx.strokeText(`${this.chain}연속`, this.W / 2, this.H * 0.47);
      ctx.fillStyle = TONE.gold;
      ctx.fillText(`${this.chain}연속`, this.W / 2, this.H * 0.47);
      ctx.restore();
    }
  }

  private drawRail(ctx: CanvasRenderingContext2D): void {
    const y = this.railY();
    const g = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    g.addColorStop(0, "#e2b57a");
    g.addColorStop(1, "#8a5a2e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(this.W * 0.04, y - 12, this.W * 0.92, 24, 12);
    ctx.fill();
  }

  private drawRibbon(ctx: CanvasRenderingContext2D, r: Ribbon, x: number, t: number): void {
    const w = this.ribbonW();
    const top = this.railY();
    const cutY = this.cutY();
    const full = this.endY();
    const end = r.cutAt !== null ? cutY : top + (full - top) * r.drop;
    const color = r.gold ? "#ffd34d" : r.color;
    const sway = Math.sin(t * 1.6 + x) * 5;
    ctx.save();
    ctx.translate(sway, 0);
    if (r.gold) {
      ctx.shadowColor = "#ffd34d";
      ctx.shadowBlur = 30;
    }
    drawCloth(ctx, x - w / 2, top, w, end - top, color, r.print);
    ctx.shadowBlur = 0;
    // 집게
    ctx.fillStyle = "#f4e6c8";
    for (const dx of [-w * 0.3, w * 0.3]) ctx.fillRect(x + dx - 8, top - 18, 16, 36);
    if (r.cutAt === null && r.drop >= 1) {
      const pulse = 0.65 + Math.sin(t * 7) * 0.35;
      ctx.fillStyle = `rgba(255,255,255,${0.16 * pulse})`;
      ctx.fillRect(x - w / 2, cutY - 26, w, 52);
      ctx.setLineDash([16, 12]);
      ctx.lineWidth = 11;
      ctx.strokeStyle = "rgba(10,10,18,0.9)";
      ctx.beginPath();
      ctx.moveTo(x - w / 2 - 12, cutY);
      ctx.lineTo(x + w / 2 + 12, cutY);
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  private drawQuilt(ctx: CanvasRenderingContext2D): void {
    const q = this.quilt();
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#2b1d14";
    ctx.beginPath();
    ctx.roundRect(q.x - 14, q.y - 14, q.w + 28, q.h + 28, 12);
    ctx.fill();
    ctx.restore();
    for (let i = 0; i < CELLS; i++) {
      const c = this.cellBox(i);
      const p = this.patches[i];
      if (p) drawCloth(ctx, c.x + 2, c.y + 2, c.w - 4, c.h - 4, p.color, p.print);
      else {
        ctx.fillStyle = "rgba(255,240,215,0.08)";
        ctx.fillRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4);
        ctx.strokeStyle = "rgba(255,240,215,0.28)";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(c.x + 5, c.y + 5, c.w - 10, c.h - 10);
        ctx.setLineDash([]);
      }
    }
    if (this.patches.length === 0 && this.pieces.length === 0) {
      ctx.font = `700 ${Math.round(q.ch * 0.5)}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,240,215,0.72)";
      ctx.fillText("잘라낸 천으로 조각보를 채워요", q.x + q.w / 2, q.y + q.h / 2);
    }
    drawFlare(ctx, q.x, q.y, 0, "white", 0);
  }

  stats(): Stat[] {
    return [
      { label: "자른 천", value: `${this.cuts}장` },
      { label: "완성한 조각보", value: `${this.quilts.length}장` },
      { label: "최고 연속", value: `${this.maxChain}번` },
    ];
  }

  queue(): QueueItem[] {
    const out: QueueItem[] = [];
    const now = this.quilts.length;
    for (let i = Math.max(0, now - 1); i < now + 3; i++)
      out.push({
        label: `조각보 ${i + 1}`,
        state: i < now ? "done" : i === now ? "now" : "next",
        pct: i === now ? Math.round((this.patches.length / CELLS) * 100) : undefined,
        color: COLORS[i % COLORS.length],
      });
    return out;
  }

  meter(): Meter {
    return {
      label: "연속 싹둑",
      value: Math.min(1, this.chain / 10),
      text: this.chain ? `${this.chain}연속 · 이어 자르면 점수 쑥쑥` : "쉬지 않고 이어 잘라요",
      hot: this.chain >= 5,
    };
  }

  collection(): Item[] {
    const items: Item[] = this.quilts.map((q, i) => ({
      label: `조각보 ${i + 1}`,
      color: q[0].color,
      note: `${CELLS}조각`,
    }));
    if (this.patches.length)
      items.push({
        label: "만들던 조각보",
        color: this.patches[0].color,
        note: `${this.patches.length}조각`,
      });
    return items;
  }

  demo(t: number): DemoHand[] {
    return [{ x: this.W * (0.5 + 0.42 * Math.sin(t * 1.5)), y: this.cutY() + Math.sin(t * 5) * 18 }];
  }

  target(): DemoHand | null {
    const i = this.ribbons.findIndex((r) => r.cutAt === null && r.drop >= 1);
    return i >= 0 ? { x: this.laneX(i), y: this.cutY() } : null;
  }
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
  // 자 눈금과 숫자(위쪽 가장자리)
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
  kind: "dots" | "stripes" | "check",
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

function drawScissors(
  ctx: CanvasRenderingContext2D,
  h: Hand,
  R: number,
  snip: number,
  t: number,
): void {
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
    0.34 -
    (snip > 0 ? 0.3 * Math.sin((snip / 0.18) * Math.PI) : 0) +
    (h.ghost ? Math.sin(t * 10) * 0.08 : 0);
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
