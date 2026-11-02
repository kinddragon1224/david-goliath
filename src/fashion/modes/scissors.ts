import {
  drawHandGlow,
  drawPalace,
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
  LUMINO,
  RESTITCH,
  SEOLBAEK,
  SILUA,
  TAILORED,
  fullName,
  pathOf,
  place,
  resample,
  toWorld,
  type Garment,
  type Pt,
} from "../garments";

/** 04 가위질 챌린지
 * 손이 가위. 재단 매트 위 원단에 분필로 그린 옷본 선을 따라 한 바퀴 오린다.
 * 빛나는 점(지금 자를 곳)에 손을 대고 화살표 쪽으로 천천히 움직이면 잘려 나간다. */

const ORDER: Garment[] = [RESTITCH, TAILORED, SEOLBAEK, ECO, LUMINO, SILUA];
const PRINTS = ["dots", "stripes", "check", "dots", "stripes"] as const;
const PIECE_BONUS = 600;

export class ScissorsMode implements Mode {
  seconds = 40;
  hint = "두 손이 가위! 빛나는 점 두 곳에서 양쪽으로 오려요";
  tip = "두 손을 빛나는 점에 대고, 화살표 쪽으로 천천히!";
  grades: [number, number, number] = [3600, 2400, 1300];
  music = "lofi" as const;
  private W = 1400;
  private H = 860;
  private gi = 0;
  private garment: Garment = RESTITCH;
  private pts: Pt[] = [];
  private outline = new Path2D();
  private path: Pt[] = [];
  private cut = 0;
  private tol = 70;
  private step = 12;
  private finished: Garment[] = [];
  private onLine = 0;
  private offLine = 0;
  private pieceOn = 0;
  private pieceOff = 0;
  private snipT = 0;
  private fall: { path: Path2D; color: string; t: number } | null = null;
  private lastSnip = 0;
  private back = 0;
  private activeHands: number[] = [];
  private pair = false;
  private pairT = 0;
  private fabric = { x: 0, y: 0, w: 0, h: 0 };

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.gi = 0;
    this.finished = [];
    this.onLine = 0;
    this.offLine = 0;
    this.fall = null;
    this.pair = false;
    this.pairT = 0;
    this.tol = Math.min(W, H) * 0.085;
    this.step = Math.min(W, H) * 0.014;
    this.fabric = { x: W * 0.17, y: H * 0.07, w: W * 0.66, h: H * 0.86 };
    this.load();
  }

  private load(): void {
    this.garment = ORDER[this.gi % ORDER.length];
    const p = place(this.garment, this.W / 2, this.H * 0.5, this.W * 0.5, this.H * 0.7);
    this.pts = toWorld(this.garment, p);
    this.outline = pathOf(this.pts);
    this.path = resample(this.pts, this.step);
    this.cut = 0;
    this.back = 0;
    this.pieceOn = 0;
    this.pieceOff = 0;
    this.activeHands = [];
  }

  private pct(): number {
    return Math.floor(((this.cut + this.back) / this.path.length) * 100);
  }

  /** 가위 자리 두 곳: 앞쪽(cut, 시계 방향)과 뒤쪽(back, 반대 방향). 둘이 만나면 완성. */
  private front(side: 0 | 1): number {
    const n = this.path.length;
    return side === 0 ? this.cut % n : (n - this.back) % n;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.snipT = Math.max(0, this.snipT - dt);
    if (this.fall) {
      this.fall.t += dt;
      if (this.fall.t > 1.2) this.fall = null;
    }
    const n = this.path.length;
    const look = Math.ceil((this.tol * 2.2) / this.step);
    // 두 가위 자리를 따로 민다: 한 손이면 한쪽씩, 두 손이면 양쪽에서 동시에
    const best = [this.cut, this.back];
    const by = [-1, -1];
    hands.forEach((h, hi) => {
      if (!h.on) return;
      for (const side of [0, 1] as const) {
        // 지금 자를 곳 근처에 손이 있어야 앞으로 나간다
        const [cx, cy] = this.path[this.front(side)];
        if (Math.hypot(cx - h.x, cy - h.y) > this.tol * 1.6) continue;
        const done = side === 0 ? this.cut : this.back;
        const other = side === 0 ? this.back : this.cut;
        for (let k = 1; k <= look && done + k + other <= n; k++) {
          const i = side === 0 ? this.cut + k : n - this.back - k;
          const [x, y] = this.path[((i % n) + n) % n];
          if (Math.hypot(x - h.x, y - h.y) <= this.tol && done + k > best[side]) {
            best[side] = done + k;
            by[side] = hi;
          }
        }
      }
    });
    if (best[0] + best[1] > n) best[1] = n - best[0];
    const adv = best[0] - this.cut + Math.max(0, best[1] - this.back);
    // 두 손이 양쪽을 동시에 자르면 '양손 가위'(점수 2배). 잠깐 멈춰도 0.6초는 이어진다.
    const both = by[0] >= 0 && by[1] >= 0 && by[0] !== by[1];
    this.pairT = both ? 0.6 : Math.max(0, this.pairT - dt);
    const pair = this.pairT > 0;
    if (pair && !this.pair) {
      fx.score(0, this.W / 2, this.H * 0.16, "양손 가위! 점수 2배", "gold");
      fx.sfx("perfect");
      fx.say("scissors-pair", true);
    }
    this.pair = pair;
    if (adv > 0) {
      this.cut = best[0];
      this.back = Math.max(this.back, best[1]);
      this.activeHands = by.filter((i) => i >= 0);
      this.onLine += dt;
      this.pieceOn += dt;
      const h = hands[this.activeHands[0]];
      fx.score(adv * 4 * (pair ? 2 : 1), h.x, h.y);
      this.snipT = 0.18;
      if (t - this.lastSnip > 0.16) {
        fx.sfx("snip");
        this.lastSnip = t;
      }
    } else if (hands.some((h) => h.on)) {
      this.offLine += dt;
      this.pieceOff += dt;
    }

    if (this.cut + this.back >= n) {
      const acc = this.pieceAcc();
      const bonus = PIECE_BONUS + (acc >= 80 ? 200 : 0);
      fx.score(
        bonus,
        this.W / 2,
        this.H * 0.4,
        acc >= 80 ? `깔끔한 재단! +${bonus}` : `보너스 +${bonus}`,
        "mint",
      );
      fx.celebrate(`${fullName(this.garment)} 완성!`, "mint");
      fx.sfx("complete");
      if (acc >= 80) fx.say("clean-cut", true);
      this.fall = { path: this.outline, color: this.garment.color, t: 0 };
      this.finished.push(this.garment);
      this.gi++;
      this.load();
    }
    this.hint = pair
      ? `양손 가위! 점수 2배 · ${this.pct()}%`
      : `${this.garment.name} 오리기 ${this.pct()}% · 두 손으로 양쪽에서 오리면 2배!`;
  }

  private pieceAcc(): number {
    const tot = this.pieceOn + this.pieceOff;
    return tot > 0 ? Math.round((this.pieceOn / tot) * 100) : 100;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], phase: Phase): void {
    drawMat(ctx, this.W, this.H, t);
    const f = this.fabric;
    // 원단
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = this.garment.color;
    ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.restore();
    drawPrint(ctx, f.x, f.y, f.w, f.h, PRINTS[this.gi % PRINTS.length], this.garment.shade);
    // 옷본 조각 안쪽은 살짝 밝게
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fill(this.outline);
    // 시침핀
    for (const [px, py] of [
      [f.x + 24, f.y + 24],
      [f.x + f.w - 24, f.y + 24],
      [f.x + 24, f.y + f.h - 24],
      [f.x + f.w - 24, f.y + f.h - 24],
    ]) {
      ctx.strokeStyle = "#cfd4de";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - 14, py + 14);
      ctx.lineTo(px + 10, py - 10);
      ctx.stroke();
      ctx.fillStyle = "#ff6fa8";
      ctx.beginPath();
      ctx.arc(px + 12, py - 12, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    const n = this.path.length;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const end = n - this.back;
    const line = (from: number, to: number) => {
      ctx.beginPath();
      const s = from <= to ? 1 : -1;
      for (let i = from; s > 0 ? i <= to : i >= to; i += s) {
        const [x, y] = this.path[((i % n) + n) % n];
        if (i === from) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };
    // 남은 길: 분필 점선
    ctx.strokeStyle = "rgba(30,24,44,0.8)";
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 12]);
    line(this.cut, end);
    ctx.setLineDash([]);
    // 바로 앞길(양쪽): 밝게 강조
    ctx.strokeStyle = "rgba(255,244,214,0.95)";
    ctx.lineWidth = 9;
    ctx.shadowColor = TONE.gold;
    ctx.shadowBlur = 14;
    line(this.cut, Math.min(end, this.cut + 30));
    line(end, Math.max(this.cut, end - 30));
    ctx.shadowBlur = 0;
    // 자른 길: 원단이 벌어진 틈
    for (const [from, to] of [
      [0, this.cut],
      [end, n],
    ]) {
      if (to <= from) continue;
      ctx.strokeStyle = "#141020";
      ctx.lineWidth = 7;
      line(from, to);
      ctx.strokeStyle = "rgba(168,240,224,0.9)";
      ctx.lineWidth = 2;
      line(from, to);
    }

    // 지금 자를 곳 두 군데: 고리 + 화살표(서로 반대 방향)
    const pulse = 1 + Math.sin(t * 6) * 0.12;
    const m = Math.ceil(this.tol / this.step);
    for (const side of [0, 1] as const) {
      const at = side === 0 ? this.cut : end;
      const [cx, cy] = this.path[((at % n) + n) % n];
      const nx = this.path[(((side === 0 ? at + m : at - m) % n) + n) % n];
      ctx.fillStyle = side === 0 ? "rgba(255,224,138,0.22)" : "rgba(168,240,224,0.22)";
      ctx.beginPath();
      ctx.arc(cx, cy, this.tol * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = side === 0 ? TONE.gold : TONE.mint;
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      // 처음엔 두 점이 겹쳐 있으니 화살표를 옆으로 벌린다
      const a = Math.atan2(nx[1] - cy, nx[0] - cx);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * this.tol * 1.25, cy + Math.sin(a) * this.tol * 1.25);
      ctx.rotate(a);
      ctx.fillStyle = side === 0 ? "#ffffff" : TONE.mint;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.lineTo(-10, -18);
      ctx.lineTo(-10, 18);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    if (this.cut === 0 && this.back === 0 && phase !== "result") {
      const [cx, cy] = this.path[0];
      ctx.font = `700 34px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      ctx.strokeText("두 손으로 양쪽으로!", cx, cy - this.tol - 20);
      ctx.fillStyle = TONE.gold;
      ctx.fillText("두 손으로 양쪽으로!", cx, cy - this.tol - 20);
    }

    // 다 오린 조각: 들려서 날아간다
    if (this.fall) {
      const k = this.fall.t / 1.2;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(this.W / 2, this.H / 2 - this.H * 0.55 * k * k);
      ctx.rotate(k * 0.3);
      ctx.scale(1 + k * 0.1 - k * k * 0.6, 1 + k * 0.1 - k * k * 0.6);
      ctx.translate(-this.W / 2, -this.H / 2);
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 20;
      ctx.fillStyle = this.fall.color;
      ctx.fill(this.fall.path);
      ctx.restore();
    }

    hands.forEach((h, i) =>
      drawScissors(ctx, h, this.tol, this.activeHands.includes(i) ? this.snipT : 0, t),
    );
  }

  stats(): Stat[] {
    const total = this.onLine + this.offLine;
    const acc = total > 0 ? Math.round((this.onLine / total) * 100) : 0;
    return [
      { label: "완성한 옷본", value: `${this.finished.length}개` },
      { label: "선 따라가기", value: `${Math.min(100, acc)}%` },
      { label: "마지막 옷본", value: `${this.pct()}%` },
    ];
  }

  queue(): QueueItem[] {
    const out: QueueItem[] = [];
    const n = Math.max(ORDER.length, this.gi + 1);
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
    const acc = this.pieceAcc();
    return {
      label: "선 정확도",
      value: acc / 100,
      text: acc >= 80 ? "깔끔해요! 보너스 +200" : "빛나는 길 위로!",
      hot: acc >= 80,
    };
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
    // 시범도 두 손으로 양쪽에서
    const n = this.path.length;
    const [x, y] = this.path[(this.cut + 4) % n];
    const [bx, by] = this.path[(((n - this.back - 4) % n) + n) % n];
    return [
      { x: x + Math.sin(t * 5) * 8, y: y + Math.cos(t * 4) * 8 },
      { x: bx + Math.cos(t * 5) * 8, y: by + Math.sin(t * 4) * 8 },
    ];
  }

  target(): DemoHand {
    const [x, y] = this.path[this.cut % this.path.length];
    return { x, y };
  }
}

/** 왕실 재단실: 장밋빛 벽 + 원단 아래 호두나무 재단 탁자(금 모서리). */
function drawMat(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  drawPalace(ctx, W, H, t, ["#5a1f3d", "#2a0f22"]);
  const x = W * 0.12;
  const y = H * 0.03;
  const w = W * 0.76;
  const h = H * 0.94;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  const wood = ctx.createLinearGradient(0, y, 0, y + h);
  wood.addColorStop(0, "#6b4223");
  wood.addColorStop(1, "#3e2412");
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#c99a3b";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 18);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff1b8";
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
  ctx.globalAlpha = 0.35;
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
