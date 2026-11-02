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
  type Tone,
} from "../core";

/** 06 리듬 챌린지
 * 런웨이 위 마네킹이 내 팔을 그대로 따라 한다. 음악에 맞춰 네 군데 빛나는 원에 손을 갖다 댄다.
 * 바깥 고리가 줄어들어 원에 딱 맞을 때가 박자. 금빛 고리는 '만세'(두 손 모두 위로).
 * 10콤보부터 런웨이 피버(점수 1.5배). */

const BPM = 112;
const BARS = 18;
const BEAT = 60 / BPM;
/** 고리가 보이기 시작해 박자에 닿기까지(초). */
const APPROACH = BEAT * 2.4;
const PERFECT = 0.14;
const GOOD = 0.32;
const FEVER_AT = 10;

type Note = { pad: number; at: number; state: "wait" | "perfect" | "good" | "miss"; sec: number };

/** 구간: 마디 범위와 이름. */
const SECTIONS = [
  { name: "인트로", from: 1, to: 4 },
  { name: "1절", from: 5, to: 8 },
  { name: "후렴", from: 9, to: 12 },
  { name: "피날레", from: 13, to: BARS - 1 },
];

/** 박 번호(0부터)별 패드. 첫 마디는 쉰다. */
export function chart(): { beat: number; pad: number }[] {
  const out: { beat: number; pad: number }[] = [];
  for (let bar = 1; bar < BARS - 1; bar++) {
    const b = bar * 4;
    if (bar <= 4) {
      out.push({ beat: b, pad: bar % 2 ? 0 : 1 }, { beat: b + 2, pad: bar % 2 ? 1 : 0 });
    } else if (bar <= 8) {
      const seq = bar % 2 ? [0, 1, 2, 3] : [2, 3, 0, 1];
      seq.forEach((pad, i) => out.push({ beat: b + i, pad }));
    } else if (bar <= 12) {
      out.push(
        { beat: b, pad: 0 },
        { beat: b, pad: 1 },
        { beat: b + 2, pad: bar % 2 ? 2 : 3 },
        { beat: b + 3, pad: bar % 2 ? 3 : 2 },
      );
    } else {
      const seq = bar % 2 ? [0, 3, 1, 2] : [1, 2, 0, 3];
      seq.forEach((pad, i) => out.push({ beat: b + i, pad }));
    }
  }
  // 마지막 박: 만세
  out.push({ beat: (BARS - 1) * 4, pad: 0 }, { beat: (BARS - 1) * 4, pad: 1 });
  return out;
}

function sectionOf(beat: number): number {
  const bar = Math.floor(beat / 4);
  const i = SECTIONS.findIndex((s) => bar >= s.from && bar <= s.to);
  return i < 0 ? SECTIONS.length - 1 : i;
}

const PAD_TONE: Tone[] = ["pink", "mint", "pink", "mint"];

export class RhythmMode implements Mode {
  seconds = Math.ceil(BARS * 4 * BEAT + 1.5);
  hint = "고리가 원에 닿을 때 손을 대요!";
  tip = "바깥 고리가 원에 딱 닿을 때 손을 대요";
  grades: [number, number, number] = [16000, 11000, 6000];
  music = null;
  private W = 1400;
  private H = 860;
  private notes: Note[] = [];
  private t0 = 0;
  private started = false;
  private now = 0;
  private perfect = 0;
  private good = 0;
  private miss = 0;
  private combo = 0;
  private maxCombo = 0;
  private pads: { x: number; y: number }[] = [];
  private R = 100;
  private judge: { pad: number; text: string; tone: Tone; t: number }[] = [];
  private inside: boolean[][] = [
    [false, false, false, false],
    [false, false, false, false],
  ];
  private end = 0;
  private flash = 0;
  private demoPos: DemoHand[] = [];

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.R = Math.min(W, H) * 0.115;
    this.pads = [
      { x: W * 0.17, y: H * 0.27 },
      { x: W * 0.83, y: H * 0.27 },
      { x: W * 0.24, y: H * 0.72 },
      { x: W * 0.76, y: H * 0.72 },
    ];
    this.notes = [];
    this.started = false;
    this.perfect = 0;
    this.good = 0;
    this.miss = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.judge = [];
    this.demoPos = [];
    this.hint = "고리가 원에 닿을 때 손을 대요!";
  }

  begin(fx: Fx): void {
    fx.sound.unlock();
    this.t0 = fx.sound.now() + 0.25;
    fx.sound.startMusic(BPM, this.t0, BARS);
    this.notes = chart().map((c) => ({
      pad: c.pad,
      at: this.t0 + c.beat * BEAT,
      state: "wait",
      sec: sectionOf(c.beat),
    }));
    this.end = this.t0 + BARS * 4 * BEAT;
    this.started = true;
    this.combo = 0;
  }

  done(): boolean {
    return this.started && this.now > this.end + 0.3;
  }

  private fever(): boolean {
    return this.combo >= FEVER_AT;
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    for (const j of this.judge) j.t += dt;
    this.judge = this.judge.filter((j) => j.t < 0.6);
    this.flash = Math.max(0, this.flash - dt);
    this.now = this.started ? fx.sound.now() : t;
    const now = this.now;
    // 대기 화면: 시범용 박자를 계속 만든다
    if (!this.started && !this.notes.some((n) => n.at > now)) {
      const seq = [0, 1, 2, 3, 1, 0, 3, 2];
      this.notes = seq.map((pad, i) => ({ pad, at: now + 1.2 + i * 0.8, state: "wait", sec: 0 }));
    }

    hands.forEach((h, hi) => {
      this.pads.forEach((p, pi) => {
        const inPad = h.on && Math.hypot(h.x - p.x, h.y - p.y) <= this.R;
        const entered = inPad && !this.inside[hi][pi];
        this.inside[hi][pi] = inPad;
        if (!inPad) return;
        const n = this.notes.find(
          (x) => x.pad === pi && x.state === "wait" && Math.abs(x.at - now) <= GOOD,
        );
        if (!n) return;
        const d = now - n.at;
        // 미리 대고 있으면 박자가 맞을 때 친 것으로
        if (!entered && d < -PERFECT) return;
        this.hit(n, Math.abs(d) <= PERFECT ? "perfect" : "good", fx);
      });
    });

    for (const n of this.notes) {
      if (n.state === "wait" && now - n.at > GOOD) {
        n.state = "miss";
        this.miss++;
        this.combo = 0;
        this.judge.push({ pad: n.pad, text: "놓침", tone: "white", t: 0 });
      }
    }
    const left = this.notes.filter((n) => n.state === "wait").length;
    this.hint = this.fever()
      ? `런웨이 피버! ${this.combo}콤보 · 점수 1.5배`
      : this.combo >= 4
        ? `${this.combo}콤보! 계속 박자를 타요`
        : left > 0
          ? "고리가 원에 닿을 때 손을 대요!"
          : "멋진 무대였어요!";
  }

  private hit(n: Note, kind: "perfect" | "good", fx: Fx): void {
    n.state = kind;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const base = kind === "perfect" ? 300 : 150;
    let pts = base + Math.min(20, this.combo) * 10;
    if (this.fever()) pts = Math.round(pts * 1.5);
    const p = this.pads[n.pad];
    if (kind === "perfect") {
      this.perfect++;
      this.flash = 0.15;
    } else this.good++;
    fx.score(pts, p.x, p.y - this.R * 1.25);
    fx.burst(p.x, p.y, kind === "perfect" ? 14 : 6, PAD_TONE[n.pad]);
    fx.sfx(kind);
    if (this.combo === FEVER_AT) fx.score(0, this.W / 2, this.H * 0.2, "런웨이 피버!", "gold");
    this.judge.push({
      pad: n.pad,
      text: kind === "perfect" ? "퍼펙트!" : "좋아요",
      tone: kind === "perfect" ? "gold" : "white",
      t: 0,
    });
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], _phase: Phase): void {
    const now = this.now || t;
    const beatPhase = this.started ? ((((now - this.t0) / BEAT) % 1) + 1) % 1 : (t / 0.8) % 1;
    const pump = Math.pow(1 - beatPhase, 3);
    const fever = this.fever();

    // 무대 바닥
    ctx.fillStyle = "#120e1c";
    ctx.fillRect(0, 0, this.W, this.H);
    // 조명
    for (let i = 0; i < 5; i++) {
      const x = this.W * (0.1 + i * 0.2);
      const sway = Math.sin(t * 0.8 + i) * this.W * 0.08;
      const g = ctx.createLinearGradient(x, 0, x + sway, this.H);
      const c = [TONE.pink, TONE.mint, TONE.gold, TONE.mint, TONE.pink][i];
      g.addColorStop(0, c + (fever ? "70" : "40"));
      g.addColorStop(1, c + "00");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 20, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + sway + this.W * 0.09, this.H);
      ctx.lineTo(x + sway - this.W * 0.09, this.H);
      ctx.closePath();
      ctx.fill();
    }
    // 런웨이(원근)
    ctx.save();
    const rg = ctx.createLinearGradient(0, this.H * 0.5, 0, this.H);
    rg.addColorStop(0, "rgba(255,255,255,0.02)");
    rg.addColorStop(1, `rgba(255,255,255,${0.08 + pump * 0.05})`);
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(this.W * 0.44, this.H * 0.45);
    ctx.lineTo(this.W * 0.56, this.H * 0.45);
    ctx.lineTo(this.W * 0.68, this.H);
    ctx.lineTo(this.W * 0.32, this.H);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // 이퀄라이저
    const bars = 28;
    for (let i = 0; i < bars; i++) {
      const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + t * 3)) * (0.4 + pump * 0.6);
      const bw = this.W / bars;
      ctx.fillStyle = i % 2 ? "rgba(255,184,220,0.3)" : "rgba(168,240,224,0.3)";
      ctx.fillRect(i * bw + 3, this.H - v * this.H * 0.1, bw - 6, v * this.H * 0.1);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,224,138,${this.flash})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // 가운데 마네킹: 내 팔을 따라 한다
    drawMannequin(ctx, this.W, this.H, hands, pump, fever, t);

    // 패드
    this.pads.forEach((p, pi) => {
      const tone = TONE[PAD_TONE[pi]];
      const active = this.notes.some(
        (n) => n.pad === pi && n.state === "wait" && n.at - now < APPROACH && n.at - now > -GOOD,
      );
      ctx.save();
      ctx.shadowColor = tone;
      ctx.shadowBlur = active ? 40 + pump * 30 : 10;
      ctx.lineWidth = 10;
      ctx.strokeStyle = active ? tone : "rgba(255,255,255,0.3)";
      ctx.fillStyle = active ? tone + "38" : "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.R * (1 + pump * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      drawPalm(
        ctx,
        p.x,
        p.y,
        this.R * 0.42,
        active ? "#ffffff" : "rgba(255,255,255,0.45)",
        pi % 2 === 1,
      );
    });

    // 다가오는 고리
    for (const n of this.notes) {
      if (n.state !== "wait") continue;
      const left = n.at - now;
      if (left > APPROACH || left < -GOOD) continue;
      const k = Math.max(0, left / APPROACH);
      const p = this.pads[n.pad];
      const both = this.notes.some((m) => m !== n && Math.abs(m.at - n.at) < 0.01);
      ctx.strokeStyle = both ? TONE.gold : TONE[PAD_TONE[n.pad]];
      ctx.lineWidth = 12 - k * 6;
      ctx.globalAlpha = 1 - k * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.R * (1 + k * 1.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      if (both && n.pad === 0 && k < 0.95) {
        ctx.font = `700 ${Math.round(this.R * 0.5)}px "Gowun Batang", serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "rgba(20,14,30,0.85)";
        ctx.strokeText("만세!", this.W / 2, this.H * 0.12);
        ctx.fillStyle = TONE.gold;
        ctx.fillText("만세!", this.W / 2, this.H * 0.12);
      }
    }

    // 판정 글자
    for (const j of this.judge) {
      const p = this.pads[j.pad];
      ctx.globalAlpha = 1 - j.t / 0.6;
      ctx.font = `700 ${Math.round(this.R * 0.48)}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      const y = p.y + this.R * 1.45 - j.t * 40;
      ctx.strokeText(j.text, p.x, y);
      ctx.fillStyle = TONE[j.tone];
      ctx.fillText(j.text, p.x, y);
    }
    ctx.globalAlpha = 1;

    for (const h of hands) drawStarHand(ctx, h, this.R * 0.5, t);
  }

  stats(): Stat[] {
    return [
      { label: "퍼펙트", value: `${this.perfect}` },
      { label: "좋아요", value: `${this.good}` },
      { label: "최고 콤보", value: `${this.maxCombo}` },
    ];
  }

  private secRatio(i: number): { hit: number; all: number } {
    const ns = this.notes.filter((n) => n.sec === i);
    return {
      hit: ns.filter((n) => n.state === "perfect" || n.state === "good").length,
      all: ns.length,
    };
  }

  queue(): QueueItem[] {
    if (!this.started)
      return SECTIONS.map((s, i) => ({ label: s.name, state: i === 0 ? "now" : "next" }));
    const beat = (this.now - this.t0) / BEAT;
    const cur = sectionOf(Math.max(4, beat));
    return SECTIONS.map((s, i) => {
      const r = this.secRatio(i);
      return {
        label: s.name,
        state: i < cur || (beat > BARS * 4 && i === cur) ? "done" : i === cur ? "now" : "next",
        pct: r.all ? Math.round((r.hit / r.all) * 100) : undefined,
      };
    });
  }

  meter(): Meter {
    return this.fever()
      ? { label: "런웨이 피버", value: 1, text: `${this.combo}콤보 · 점수 1.5배`, hot: true }
      : {
          label: "콤보",
          value: this.combo / FEVER_AT,
          text:
            this.combo > 0 ? `${this.combo}콤보 · ${FEVER_AT}콤보면 피버` : "박자에 맞춰 손을 대요",
        };
  }

  collection(): Item[] {
    return SECTIONS.map((s, i) => {
      const r = this.secRatio(i);
      const k = r.all ? r.hit / r.all : 0;
      const stars = k >= 0.9 ? 3 : k >= 0.6 ? 2 : k > 0 ? 1 : 0;
      return {
        label: s.name,
        color: ["#ffd6ea", "#d8ccff", "#c4f4ea", "#fff0d2"][i],
        note: "★".repeat(stars) + "☆".repeat(3 - stars),
      };
    });
  }

  demo(t: number): DemoHand[] {
    // 다가오는 박자의 패드로 손을 옮긴다
    const now = this.now || t;
    const n = this.notes.find((x) => x.state === "wait" && x.at > now - 0.1);
    const target = n ? this.pads[n.pad] : { x: this.W / 2, y: this.H * 0.5 };
    const prev = this.demoPos[0] ?? { x: this.W / 2, y: this.H * 0.5 };
    const k = 0.14;
    this.demoPos = [{ x: prev.x + (target.x - prev.x) * k, y: prev.y + (target.y - prev.y) * k }];
    return this.demoPos;
  }

  target(): DemoHand | null {
    if (!this.started) return null;
    const n = this.notes.find((x) => x.state === "wait" && x.at - this.now < APPROACH * 0.6);
    return n ? this.pads[n.pad] : null;
  }
}

/** 손바닥 모양(패드 안 표시). */
function drawPalm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  flip: boolean,
): void {
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.25, r * 0.55, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const fingers = [
    [-0.42, -0.5, 0.42],
    [-0.14, -0.72, 0.52],
    [0.14, -0.74, 0.54],
    [0.42, -0.58, 0.46],
  ];
  for (const [fx, fy, len] of fingers) {
    ctx.beginPath();
    ctx.ellipse(fx * r, fy * r, r * 0.12, r * len * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(-r * 0.62, r * 0.15, r * 0.12, r * 0.32, -0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 런웨이 마네킹. 어깨에서 사람 손 위치로 팔을 뻗는다. */
function drawMannequin(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  hands: Hand[],
  pump: number,
  fever: boolean,
  t: number,
): void {
  const cx = W / 2;
  const sy = H * 0.4;
  const sw = W * 0.055;
  const bob = pump * 6;
  ctx.save();
  ctx.translate(0, -bob);
  const glow = fever ? TONE.gold : "#d8ccff";
  ctx.shadowColor = glow;
  ctx.shadowBlur = 30 + pump * 30;
  // 드레스
  const dg = ctx.createLinearGradient(cx, sy, cx, H * 0.92);
  dg.addColorStop(0, fever ? "#ffe08a" : "#ffd6ea");
  dg.addColorStop(0.5, "#d8ccff");
  dg.addColorStop(1, "#c4f4ea");
  ctx.fillStyle = dg;
  const sway = Math.sin(t * 4) * 14;
  ctx.beginPath();
  ctx.moveTo(cx - sw, sy);
  ctx.lineTo(cx + sw, sy);
  ctx.lineTo(cx + sw * 0.55, H * 0.55);
  ctx.quadraticCurveTo(cx + sw * 2.4 + sway, H * 0.75, cx + sw * 2.2 + sway, H * 0.92);
  ctx.lineTo(cx - sw * 2.2 + sway, H * 0.92);
  ctx.quadraticCurveTo(cx - sw * 2.4 + sway, H * 0.75, cx - sw * 0.55, H * 0.55);
  ctx.closePath();
  ctx.fill();
  // 머리·목
  ctx.fillStyle = "#f6f1ff";
  ctx.beginPath();
  ctx.arc(cx, sy - H * 0.1, H * 0.055, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 10, sy - H * 0.05, 20, H * 0.05);
  ctx.shadowBlur = 0;
  // 팔
  const on = hands.filter((h) => h.on).sort((a, b) => a.x - b.x);
  const sides = [
    { sx: cx - sw, h: on.length === 2 ? on[0] : on[0] && on[0].x < cx ? on[0] : null, dir: -1 },
    { sx: cx + sw, h: on.length === 2 ? on[1] : on[0] && on[0].x >= cx ? on[0] : null, dir: 1 },
  ];
  ctx.strokeStyle = "#f6f1ff";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of sides) {
    const hx = s.h ? s.h.x : s.sx + s.dir * W * 0.04;
    const hy = s.h ? s.h.y + bob : sy + H * 0.25;
    // 팔을 너무 길게 늘이지 않게 어깨 쪽으로 당긴 손 끝
    const dx = hx - s.sx;
    const dy = hy - sy;
    const L = Math.hypot(dx, dy);
    const maxL = W * 0.22;
    const k = L > maxL ? maxL / L : 1;
    const ex = s.sx + dx * k;
    const ey = sy + dy * k;
    const mx = (s.sx + ex) / 2 + s.dir * 24;
    const my = (sy + ey) / 2 + 20;
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(s.sx, sy + 8);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();
    ctx.fillStyle = "#f6f1ff";
    ctx.beginPath();
    ctx.arc(ex, ey, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStarHand(ctx: CanvasRenderingContext2D, h: Hand, r: number, t: number): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, r * 1.8, h.id ? "mint" : "pink");
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(t * 2);
  ctx.globalAlpha = h.ghost ? 0.8 : 1;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
