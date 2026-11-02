import {
  drawHandGlow,
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

const ORDER: Garment[] = [SKIRT, SHIRT, PANTS, DRESS, JACKET];
const PRINTS = ["dots", "stripes", "check", "dots", "stripes"] as const;
const PIECE_BONUS = 600;

export class ScissorsMode implements Mode {
  seconds = 40;
  hint = "가위 손을 빛나는 점에 대고 선을 따라가요";
  tip = "빛나는 점에 손을 대고, 화살표 쪽으로 천천히!";
  grades: [number, number, number] = [3600, 2400, 1300];
  music = "lofi" as const;
  private W = 1400;
  private H = 860;
  private gi = 0;
  private garment: Garment = SKIRT;
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
  private activeHand = -1;
  private fabric = { x: 0, y: 0, w: 0, h: 0 };

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.gi = 0;
    this.finished = [];
    this.onLine = 0;
    this.offLine = 0;
    this.fall = null;
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
    this.pieceOn = 0;
    this.pieceOff = 0;
    this.activeHand = -1;
  }

  private pct(): number {
    return Math.floor((this.cut / this.path.length) * 100);
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
      this.pieceOn += dt;
      const h = hands[bestHand];
      fx.score(adv * 4, h.x, h.y);
      this.snipT = 0.18;
      if (t - this.lastSnip > 0.16) {
        fx.sfx("snip");
        this.lastSnip = t;
      }
    } else if (hands.some((h) => h.on)) {
      this.offLine += dt;
      this.pieceOff += dt;
    }

    if (this.cut >= n) {
      const acc = this.pieceAcc();
      const bonus = PIECE_BONUS + (acc >= 80 ? 200 : 0);
      fx.score(
        bonus,
        this.W / 2,
        this.H * 0.4,
        acc >= 80 ? `깔끔한 재단! +${bonus}` : `보너스 +${bonus}`,
        "mint",
      );
      fx.celebrate(`${this.garment.name} 완성!`, "mint");
      fx.sfx("complete");
      this.fall = { path: this.outline, color: this.garment.color, t: 0 };
      this.finished.push(this.garment);
      this.gi++;
      this.load();
    }
    this.hint = `${this.garment.name} 오리기 ${this.pct()}% · 빛나는 점을 따라 천천히!`;
  }

  private pieceAcc(): number {
    const tot = this.pieceOn + this.pieceOff;
    return tot > 0 ? Math.round((this.pieceOn / tot) * 100) : 100;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], phase: Phase): void {
    drawMat(ctx, this.W, this.H);
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
    // 남은 길: 분필 점선
    ctx.strokeStyle = "rgba(30,24,44,0.8)";
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    for (let i = this.cut; i <= n; i++) {
      const [x, y] = this.path[i % n];
      if (i === this.cut) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // 바로 앞길: 밝게 강조
    const ahead = Math.min(n, this.cut + 30);
    ctx.strokeStyle = "rgba(255,244,214,0.95)";
    ctx.lineWidth = 9;
    ctx.shadowColor = TONE.gold;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    for (let i = this.cut; i <= ahead; i++) {
      const [x, y] = this.path[i % n];
      if (i === this.cut) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 자른 길: 원단이 벌어진 틈
    if (this.cut > 0) {
      ctx.strokeStyle = "#141020";
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i <= this.cut; i++) {
        const [x, y] = this.path[i % n];
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(168,240,224,0.9)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 지금 자를 곳: 진행 고리 + 화살표
    const [cx, cy] = this.path[this.cut % n];
    const nx = this.path[(this.cut + Math.ceil(this.tol / this.step)) % n];
    const pulse = 1 + Math.sin(t * 6) * 0.12;
    ctx.fillStyle = "rgba(255,224,138,0.22)";
    ctx.beginPath();
    ctx.arc(cx, cy, this.tol * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = TONE.gold;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, this.tol * 0.62, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * this.cut) / n);
    ctx.stroke();
    ctx.fillStyle = TONE.gold;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    const a = Math.atan2(nx[1] - cy, nx[0] - cx);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * this.tol * 1.25, cy + Math.sin(a) * this.tol * 1.25);
    ctx.rotate(a);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-10, -18);
    ctx.lineTo(-10, 18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    if (this.cut === 0 && phase !== "result") {
      ctx.font = `700 34px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      ctx.strokeText("여기서 시작!", cx, cy - this.tol - 20);
      ctx.fillStyle = TONE.gold;
      ctx.fillText("여기서 시작!", cx, cy - this.tol - 20);
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
      drawScissors(ctx, h, this.tol, i === this.activeHand ? this.snipT : 0, t),
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
      shape: g.pts,
      aspect: g.aspect,
      color: g.color,
    }));
  }

  demo(t: number): DemoHand[] {
    const n = this.path.length;
    const [x, y] = this.path[(this.cut + 4) % n];
    return [{ x: x + Math.sin(t * 5) * 8, y: y + Math.cos(t * 4) * 8 }];
  }

  target(): DemoHand {
    const [x, y] = this.path[this.cut % this.path.length];
    return { x, y };
  }
}

/** 초록 재단 매트: 눈금 + 자. */
function drawMat(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = "#1f3b35";
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 35) {
    ctx.strokeStyle = x % 175 === 0 ? "rgba(220,255,240,0.22)" : "rgba(220,255,240,0.08)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 35) {
    ctx.strokeStyle = y % 175 === 0 ? "rgba(220,255,240,0.22)" : "rgba(220,255,240,0.08)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(220,255,240,0.35)";
  ctx.font = "600 16px sans-serif";
  ctx.textAlign = "center";
  for (let x = 175, i = 5; x < W; x += 175, i += 5) ctx.fillText(String(i), x, 22);
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
