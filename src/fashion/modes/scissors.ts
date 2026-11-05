import {
  drawFlare,
  drawGarmentPhoto,
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
  resample,
  toWorld,
  type Garment,
  type Pt,
} from "../garments";

/** 04 가위질 챌린지
 * 손이 가위. 재단 매트 위 원단에 분필로 그린 옷본 선을 따라 한 바퀴 오린다.
 * 빛나는 점(지금 자를 곳)에 손을 대고 화살표 쪽으로 천천히 움직이면 잘려 나간다. */

const ORDER: Garment[] = [RESTITCH, TAILORED, SEOLBAEK, ECO, LAYOVER, SILUA];
const PRINTS = ["dots", "stripes", "check", "dots", "stripes"] as const;
const PIECE_BONUS = 600;
/** 선 허용 폭(화면 짧은 쪽 비율). */
const TOL = 0.07;
/** 가위 자리 가까이서 선을 벗어나면 원단에 흠집 + 감점. */
const NICK_PENALTY = 80;
const NICK_GAP = 0.5;
/** 선에서 이만큼(허용 폭 배수) 벗어나야 흠집. 웹캠 손 떨림은 봐준다. */
const NICK_AT = 1.25;
/** 흠집 내면 가위가 잠깐 걸려 못 자른다(대충 빨리 휘두르는 게 손해가 되게). */
const JAM = 0.3;
/** 싹둑 사이가 이만큼(초) 벌어지면 연속 컷이 끊긴다. */
const CHAIN_GAP = 0.7;
/** 이어 자를 때 올라가는 음(반음). 어떤 순서로 들려도 어울리는 5음계. */
const LADDER = [2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export class ScissorsMode implements Mode {
  seconds = 40;
  hint = "두 손이 가위! 빛나는 점 두 곳에서 양쪽으로 오려요";
  tip = "두 손을 빛나는 점에 대고, 화살표 쪽으로 천천히!";
  // 봇 기준: 양손 깔끔 31k, 손 떨림 27k, 한 손 16k, 선 밖으로 휘두르기 16~17k
  grades: [number, number, number] = [15000, 7500, 3000];
  music = "lofi" as const;
  private nicks: { x: number; y: number; a: number }[] = [];
  private nickT = 0;
  private nickCount = 0;
  private cutAt = [-9, -9];
  private jamT = 0;
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
  private fall: {
    path: Path2D;
    g: Garment;
    box: { x: number; y: number; w: number; h: number };
    color: string;
    print: (typeof PRINTS)[number];
    t: number;
  } | null = null;
  private chain = 0;
  /** 싹둑 순간 날에서 튀는 불꽃 자리. */
  private sparks: { x: number; y: number; t: number }[] = [];
  private box = { x: 0, y: 0, w: 0, h: 0 };
  private lastSnip = 0;
  private back = 0;
  private activeHands: number[] = [];
  private pair = false;
  private pairT = 0;
  private fabric = { x: 0, y: 0, w: 0, h: 0 };
  /** 손마다 최근 위치(칼날 궤적). */
  private trails: { x: number; y: number; t: number }[][] = [[], []];
  /** 자를 때 튀는 실밥·천 부스러기. */
  private bits: { x: number; y: number; vx: number; vy: number; a: number; va: number; life: number; c: string }[] = [];

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
    this.nickCount = 0;
    this.nickT = 0;
    this.jamT = 0;
    this.cutAt = [-9, -9];
    this.trails = [[], []];
    this.bits = [];
    this.chain = 0;
    this.sparks = [];
    this.tol = Math.min(W, H) * TOL;
    this.step = Math.min(W, H) * 0.014;
    this.fabric = { x: W * 0.17, y: H * 0.07, w: W * 0.66, h: H * 0.86 };
    this.load();
  }

  private load(): void {
    this.garment = ORDER[this.gi % ORDER.length];
    this.nicks = [];
    const p = place(this.garment, this.W / 2, this.H * 0.5, this.W * 0.5, this.H * 0.7);
    this.box = p;
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
    hands.forEach((h, i) => {
      const tr = (this.trails[i] ??= []);
      if (h.on) tr.push({ x: h.x, y: h.y, t });
      while (tr.length && (t - tr[0].t > 0.16 || tr.length > 12)) tr.shift();
    });
    for (const b of this.bits) {
      b.life -= dt;
      b.vy += 1400 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.a += b.va * dt;
    }
    this.bits = this.bits.filter((b) => b.life > 0);
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter((s) => s.t < 0.14);
    if (this.fall) {
      this.fall.t += dt;
      if (this.fall.t > 1.2) this.fall = null;
    }
    const n = this.path.length;
    const look = Math.ceil((this.tol * 2.2) / this.step);
    // 두 가위 자리를 따로 민다: 한 손이면 한쪽씩, 두 손이면 양쪽에서 동시에
    const best = [this.cut, this.back];
    const by = [-1, -1];
    // 가위 자리 근처 손이 선에서 얼마나 떨어졌나(흠집 판정)
    const stray: { h: Hand; d: number }[] = [];
    hands.forEach((h, hi) => {
      if (!h.on) return;
      let near = false;
      let minD = Infinity;
      for (const side of [0, 1] as const) {
        // 지금 자를 곳 근처에 손이 있어야 앞으로 나간다
        const [cx, cy] = this.path[this.front(side)];
        if (Math.hypot(cx - h.x, cy - h.y) > this.tol * 1.6) continue;
        near = true;
        minD = Math.min(minD, Math.hypot(cx - h.x, cy - h.y));
        const done = side === 0 ? this.cut : this.back;
        const other = side === 0 ? this.back : this.cut;
        for (let k = 1; k <= look && done + k + other <= n; k++) {
          const i = side === 0 ? this.cut + k : n - this.back - k;
          const [x, y] = this.path[((i % n) + n) % n];
          minD = Math.min(minD, Math.hypot(x - h.x, y - h.y));
          if (Math.hypot(x - h.x, y - h.y) <= this.tol && done + k > best[side]) {
            best[side] = done + k;
            by[side] = hi;
          }
        }
      }
      // 막 자르던 손이 선을 벗어날 때만(멀리서 다가오는 손은 봐준다)
      if (near && minD > this.tol * NICK_AT && h.speed > this.W * 0.1 && t - this.cutAt[hi] < 0.5)
        stray.push({ h, d: minD });
    });
    // 선을 벗어나 가위질하면 흠집
    this.nickT = Math.max(0, this.nickT - dt);
    if (stray.length && this.nickT <= 0) {
      const { h } = stray[0];
      const pen = NICK_PENALTY;
      this.nickT = NICK_GAP;
      this.jamT = JAM;
      this.nickCount++;
      this.chain = 0;
      this.pieceOff += 0.4;
      this.nicks.push({ x: h.x, y: h.y, a: Math.atan2(h.vy, h.vx) });
      fx.score(-pen, h.x, h.y - this.tol, `흠집 -${pen}`, "pink");
      fx.stamp("삐뚤!", h.x, h.y - this.tol * 2, "pink");
      fx.shake(0.3);
      fx.sfx("miss");
    }
    if (best[0] + best[1] > n) best[1] = n - best[0];
    this.jamT = Math.max(0, this.jamT - dt);
    const adv = this.jamT > 0 ? 0 : best[0] - this.cut + Math.max(0, best[1] - this.back);
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
      for (const i of this.activeHands) this.cutAt[i] = t;
      this.onLine += dt;
      this.pieceOn += dt;
      const h = hands[this.activeHands[0]];
      fx.score(adv * 4 * (pair ? 2 : 1), h.x, h.y);
      // 싹둑할 때마다 자른 자리에서 실밥이 튄다(천 색 + 안감 색)
      for (const side of [0, 1] as const) {
        if (t - this.lastSnip <= 0.16 || (side === 1 && best[1] <= 0)) continue;
        const [px, py] = this.path[this.front(side)];
        for (let k = 0; k < 5 && this.bits.length < 60; k++)
          this.bits.push({
            x: px,
            y: py,
            vx: (Math.random() - 0.5) * 420,
            vy: -120 - Math.random() * 260,
            a: Math.random() * Math.PI,
            va: (Math.random() - 0.5) * 18,
            life: 0.5 + Math.random() * 0.4,
            c: Math.random() < 0.6 ? this.garment.color : this.garment.shade,
          });
      }
      this.snipT = 0.18;
      if (t - this.lastSnip > 0.16) {
        this.chain = t - this.lastSnip < CHAIN_GAP ? this.chain + 1 : 1;
        fx.sfx("snip", LADDER[Math.min(this.chain, LADDER.length) - 1]);
        this.lastSnip = t;
        for (const i of this.activeHands) this.sparks.push({ x: hands[i].x, y: hands[i].y, t: 0 });
        if (this.chain % 15 === 0) {
          fx.stamp(
            `연속 ${this.chain}컷!`,
            h.x,
            Math.max(this.H * 0.18, h.y - this.tol * 2),
            "gold",
          );
          fx.burst(h.x, h.y, 16, "gold");
          fx.shake(0.2);
        }
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
        this.H * 0.32,
        acc >= 80 ? `깔끔한 재단! +${bonus}` : `보너스 +${bonus}`,
        "mint",
      );
      fx.celebrate(`${fullName(this.garment)} 완성!`, "mint");
      fx.sfx("complete");
      fx.hitstop(0.16);
      fx.shake(0.6);
      if (acc >= 80) fx.say("clean-cut", true);
      this.fall = {
        path: this.outline,
        g: this.garment,
        box: { ...this.box },
        color: this.garment.color,
        print: PRINTS[this.gi % PRINTS.length],
        t: 0,
      };
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
    drawCloth(ctx, f, this.garment, PRINTS[this.gi % PRINTS.length]);
    // 어두운 원단 위 옷본만 조명을 받는다(흰 옷도 선이 또렷하게)
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fill(this.outline);
    ctx.save();
    ctx.globalAlpha = 0.85;
    const b = this.box;
    drawGarmentPhoto(ctx, this.garment, b.x, b.y, b.w, b.h);
    ctx.restore();
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
    // 남은 길: 분필 점선(옷 색이 밝든 어둡든 보이게 검은 테 + 흰 선)
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = "rgba(10,10,18,0.85)";
    ctx.lineWidth = 9;
    line(this.cut, end);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
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
      ctx.lineWidth = 11;
      line(from, to);
      ctx.strokeStyle = "rgba(168,240,224,0.9)";
      ctx.lineWidth = 3;
      line(from, to);
    }
    // 방금 자른 자리는 날에 달궈진 듯 빛난다
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.shadowColor = TONE.gold;
    ctx.shadowBlur = 20;
    if (this.cut > 0) line(Math.max(0, this.cut - 14), this.cut);
    if (this.back > 0) line(end, Math.min(n, end + 14));
    ctx.shadowBlur = 0;

    // 흠집: 선 밖으로 삐져나간 가위 자국
    for (const k of this.nicks) {
      ctx.save();
      ctx.lineCap = "round";
      ctx.translate(k.x, k.y);
      ctx.rotate(k.a);
      ctx.strokeStyle = "#141020";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-26, -4);
      ctx.lineTo(-8, 5);
      ctx.lineTo(8, -5);
      ctx.lineTo(26, 4);
      ctx.stroke();
      ctx.strokeStyle = "#ff6f8a";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // 지금 자를 곳 두 군데: 고리 + 화살표(서로 반대 방향)
    const pulse = 1 + Math.sin(t * 6) * 0.12;
    const m = Math.ceil(this.tol / this.step);
    for (const side of [0, 1] as const) {
      const at = side === 0 ? this.cut : end;
      const [cx, cy] = this.path[((at % n) + n) % n];
      const nx = this.path[(((side === 0 ? at + m : at - m) % n) + n) % n];
      ctx.fillStyle = side === 0 ? "rgba(159,243,255,0.22)" : "rgba(168,240,224,0.22)";
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

    // 다 오린 조각: 남은 원단은 두 쪽으로 갈라져 떨어지고, 옷은 들려서 날아간다
    if (this.fall) {
      const k = this.fall.t / 1.2;
      const hole = new Path2D();
      hole.rect(f.x, f.y, f.w, f.h);
      hole.addPath(this.fall.path);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.globalAlpha = 1 - k * k;
        ctx.translate(this.W / 2 + side * this.W * 0.5 * k * k, this.H / 2 + this.H * 0.9 * k * k);
        ctx.rotate(side * k * 0.45);
        ctx.translate(-this.W / 2, -this.H / 2);
        ctx.beginPath();
        ctx.rect(side < 0 ? f.x : f.x + f.w / 2, f.y, f.w / 2, f.h);
        ctx.clip();
        ctx.clip(hole, "evenodd");
        ctx.fillStyle = this.fall.color;
        ctx.fillRect(f.x, f.y, f.w, f.h);
        drawCloth(ctx, f, this.fall.g, this.fall.print);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(this.W / 2, this.H / 2 - this.H * 0.55 * k * k);
      ctx.rotate(k * 0.3);
      ctx.scale(1 + k * 0.1 - k * k * 0.6, 1 + k * 0.1 - k * k * 0.6);
      ctx.translate(-this.W / 2, -this.H / 2);
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 20;
      const fb = this.fall.box;
      if (!drawGarmentPhoto(ctx, this.fall.g, fb.x, fb.y, fb.w, fb.h)) {
        ctx.fillStyle = this.fall.color;
        ctx.fill(this.fall.path);
      }
      ctx.restore();
    }

    // 실밥
    for (const b of this.bits) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.life * 2.5);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.a);
      ctx.fillStyle = b.c;
      ctx.fillRect(-7, -2, 14, 4);
      ctx.strokeStyle = "rgba(20,14,30,0.4)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-7, -2, 14, 4);
      ctx.restore();
    }
    // 칼날 궤적: 자르는 중이면 밝은 민트, 아니면 은은하게
    this.trails.forEach((tr, i) => {
      if (tr.length < 2) return;
      const hot = this.activeHands.includes(i) && this.snipT > 0;
      // 밝은 천 위에서도 보이게: 짙은 청록 테 + 흰 심
      ctx.save();
      ctx.lineCap = "round";
      for (const [col, wid] of hot
        ? ([["32,150,140", 18], ["255,255,255", 7]] as const)
        : ([["255,255,255", 8]] as const))
        for (let k = 1; k < tr.length; k++) {
          const f = k / tr.length;
          ctx.strokeStyle = `rgba(${col},${(hot ? 0.85 : 0.3) * f})`;
          ctx.lineWidth = wid * f;
          ctx.beginPath();
          ctx.moveTo(tr[k - 1].x, tr[k - 1].y);
          ctx.lineTo(tr[k].x, tr[k].y);
          ctx.stroke();
        }
      ctx.restore();
    });

    hands.forEach((h, i) =>
      drawScissors(ctx, h, this.tol, this.activeHands.includes(i) ? this.snipT : 0, t),
    );
    for (const s of this.sparks)
      drawFlare(ctx, s.x, s.y, this.tol * (1.1 - s.t * 3), "white", 1 - s.t / 0.14, s.t * 9);
    // 연속 컷 수: 손 곁에 붙어 따라간다
    const lead = hands[this.activeHands[0]];
    if (this.chain >= 3 && lead?.on && t - this.lastSnip < 0.5) {
      const size = 46 + Math.min(30, this.chain);
      ctx.save();
      ctx.font = `700 ${size}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(10,12,20,0.92)";
      const y = lead.y + this.tol * (lead.y > this.H * 0.72 ? -1.7 : 1.7);
      ctx.strokeText(`${this.chain}컷`, lead.x, y);
      ctx.fillStyle = TONE.gold;
      ctx.fillText(`${this.chain}컷`, lead.x, y);
      ctx.restore();
    }
  }

  stats(): Stat[] {
    const total = this.onLine + this.offLine;
    const acc = total > 0 ? Math.round((this.onLine / total) * 100) : 0;
    return [
      { label: "완성한 옷본", value: `${this.finished.length}개` },
      { label: "선 따라가기", value: `${Math.min(100, acc)}%` },
      { label: "마지막 옷본", value: `${this.pct()}%` },
      { label: "흠집", value: `${this.nickCount}개` },
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

/** 원단 무늬·결·조명을 깔고 어둡게 눌러 옷본이 돋보이게 한다. */
function drawCloth(
  ctx: CanvasRenderingContext2D,
  f: { x: number; y: number; w: number; h: number },
  g: Garment,
  print: (typeof PRINTS)[number],
): void {
  drawPrint(ctx, f.x, f.y, f.w, f.h, print, g.shade);
  // 천의 결 + 위에서 비치는 조명(납작한 색판이 아니라 천처럼)
  fabricTexture(ctx, f.x, f.y, f.w, f.h, g.shade);
  const lit = ctx.createLinearGradient(f.x, f.y, f.x + f.w * 0.4, f.y + f.h);
  lit.addColorStop(0, "rgba(255,255,255,0.16)");
  lit.addColorStop(0.6, "rgba(255,255,255,0)");
  lit.addColorStop(1, "rgba(0,0,0,0.14)");
  ctx.fillStyle = lit;
  ctx.fillRect(f.x, f.y, f.w, f.h);
  ctx.fillStyle = "rgba(12,14,24,0.62)";
  ctx.fillRect(f.x, f.y, f.w, f.h);
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
