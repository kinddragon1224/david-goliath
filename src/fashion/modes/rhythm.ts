import {
  drawArt,
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
  hint = "원 안 숫자 3·2·1 다음 '지금!'에 손을 대요";
  tip = "원 안에 3·2·1 다음 '지금!'이 뜨면 손을 대요";
  grades: [number, number, number] = [24000, 12000, 5000];
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
  private banzaiAt = 0;

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
    this.hint = "원 안 숫자 3·2·1 다음 '지금!'에 손을 대요";
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
    fx.sound.say("rhythm-how", true);
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
    // 금빛 고리(두 손 만세)가 다가오면 MC가 미리 "만세!"
    const ban = this.notes.find(
      (n) =>
        n.state === "wait" &&
        n.pad === 0 &&
        n.at - now > 0 &&
        n.at - now < BEAT * 1.2 &&
        this.notes.some((m) => m !== n && Math.abs(m.at - n.at) < 0.01),
    );
    if (ban && ban.at !== this.banzaiAt) {
      this.banzaiAt = ban.at;
      fx.say("banzai", true);
    }
    // 런웨이 피버: 하늘에 불꽃
    if (this.fever() && Math.random() < dt * 2.2) {
      const tones: Tone[] = ["gold", "pink", "mint", "white"];
      fx.burst(
        this.W * (0.15 + Math.random() * 0.7),
        this.H * (0.08 + Math.random() * 0.25),
        22,
        tones[(Math.random() * 4) | 0],
      );
    }
    const left = this.notes.filter((n) => n.state === "wait").length;
    this.hint = this.fever()
      ? `런웨이 피버! ${this.combo}콤보 · 점수 1.5배`
      : this.combo >= 4
        ? `${this.combo}콤보! 계속 박자를 타요`
        : left > 0
          ? "원 안 숫자 3·2·1 다음 '지금!'에 손을 대요"
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
    if (this.combo === FEVER_AT) {
      fx.score(0, this.W / 2, this.H * 0.2, "런웨이 피버!", "gold");
      fx.say("runway-fever", true);
    } else if (this.combo % 8 === 0) fx.say(this.combo % 16 === 0 ? "perfect" : "great");
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

    const sec = this.started
      ? sectionOf(Math.max(4, (now - this.t0) / BEAT))
      : Math.floor(t / 6) % 4;
    drawBallroom(ctx, this.W, this.H, t, pump, fever, sec);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,224,138,${this.flash})`;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // 가운데 마네킹: 내 팔을 따라 한다
    drawMannequin(
      ctx,
      this.W,
      this.H,
      hands,
      pump,
      fever,
      t,
      this.started ? sectionOf(Math.max(4, (now - this.t0) / BEAT)) : 0,
    );

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
      // 다가오는 박자: 음악 박에 맞춰 3·2·1 세다가 박자에 '지금!'
      const next = this.notes.find(
        (n) => n.pad === pi && n.state === "wait" && n.at - now < APPROACH && n.at - now > -GOOD,
      );
      if (next) {
        const left = next.at - now;
        const now_ = left <= 0.1;
        const label = now_ ? "지금!" : String(Math.ceil(left / BEAT - 0.1));
        const pop = now_ ? 1.15 : 1 + Math.pow(1 - ((left / BEAT) % 1), 4) * 0.25;
        ctx.save();
        ctx.font = `800 ${Math.round(this.R * (now_ ? 0.62 : 0.9) * pop)}px "Gowun Batang", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 10;
        ctx.strokeStyle = "rgba(20,14,30,0.85)";
        ctx.strokeText(label, p.x, p.y);
        ctx.fillStyle = now_ ? TONE.gold : "#ffffff";
        ctx.fillText(label, p.x, p.y);
        ctx.restore();
      } else drawPalm(ctx, p.x, p.y, this.R * 0.42, "rgba(255,255,255,0.45)", pi % 2 === 1);
    });

    // 첫 마디: 음악에 맞춰 하나·둘·셋·넷 세기
    const beatNo = Math.floor((now - this.t0) / BEAT);
    if (this.started && beatNo >= 0 && beatNo < 4) {
      const k = ((now - this.t0) / BEAT) % 1;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.round(this.R * (1.1 + (1 - k) * 0.3))}px "Gowun Batang", serif`;
      ctx.lineWidth = 12;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      const word = ["하나", "둘", "셋", "넷"][beatNo];
      ctx.strokeText(word, this.W / 2, this.H * 0.16);
      ctx.fillStyle = TONE.gold;
      ctx.fillText(word, this.W / 2, this.H * 0.16);
      ctx.font = `700 ${Math.round(this.R * 0.34)}px "Gowun Batang", serif`;
      ctx.lineWidth = 8;
      const sub = "원 안 숫자가 '지금!'이 되면 손을 대요";
      ctx.strokeText(sub, this.W / 2, this.H * 0.16 + this.R * 0.95);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(sub, this.W / 2, this.H * 0.16 + this.R * 0.95);
      ctx.restore();
    }

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
/** 구간마다 바뀌는 무대 의상. */
const OUTFITS: [string, string, string][] = [
  ["#ffd6ea", "#d8ccff", "#c4f4ea"],
  ["#ff7eb6", "#b18cff", "#6fe0ff"],
  ["#ffe08a", "#ff9fcb", "#c8b8ff"],
  ["#ffffff", "#ffe08a", "#ffb347"],
];

function drawMannequin(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  hands: Hand[],
  pump: number,
  fever: boolean,
  t: number,
  look: number,
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
  const o = fever ? OUTFITS[3] : OUTFITS[look % OUTFITS.length];
  dg.addColorStop(0, o[0]);
  dg.addColorStop(0.5, o[1]);
  dg.addColorStop(1, o[2]);
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
  // 스팽글
  ctx.save();
  ctx.clip();
  ctx.shadowBlur = 0;
  for (let i = 0; i < 26; i++) {
    const tw = (Math.sin(t * 7 + i * 2.3) + 1) / 2;
    if (tw < 0.6) continue;
    const px = cx + Math.sin(i * 12.9898) * sw * 2;
    const py = sy + (((i * 37) % 100) / 100) * (H * 0.5);
    ctx.fillStyle = `rgba(255,255,255,${(tw - 0.6) * 2.4})`;
    ctx.beginPath();
    ctx.arc(px, py, 3 + tw * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 30 + pump * 30;
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

/** 런칭 쇼 연회장: 금빛 모자이크 벽 + 샹들리에 + 조명 빛줄기 + 대리석 바닥 + 응원봉·카메라 든 관객. */
function drawBallroom(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  pump: number,
  fever: boolean,
  sec: number,
): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2a1240");
  bg.addColorStop(1, "#140822");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 그린 연회장 그림이 있으면 그걸 깔고, 모자이크 벽·샹들리에·바닥은 건너뛴다
  const art = drawArt(ctx, W, H, "rhythm", 0.32 - pump * 0.12);

  if (!art) {
    // 금빛 모자이크 벽(점 화면). 구간마다 무늬가 바뀐다.
    const cols = 44;
    const cell = W / cols;
    const rows = Math.floor((H * 0.58) / cell);
    const hueBase = fever ? 45 : [330, 42, 285, 20][sec % 4];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const u = c / cols - 0.5;
        const v = r / rows - 0.5;
        let k: number;
        if (fever || sec % 4 === 3) k = (Math.sin((u + v) * 14 - t * 6) + 1) / 2;
        else if (sec % 4 === 0)
          k = (Math.sin(u * 10 + t * 2.4) * Math.cos(v * 6 - t * 1.6) + 1) / 2;
        else if (sec % 4 === 1) k = (Math.sin(Math.hypot(u * 1.6, v) * 26 - t * 5) + 1) / 2;
        else {
          const colH = (Math.abs(Math.sin(c * 0.7 + t * 3)) * 0.6 + pump * 0.4) * rows;
          k = rows - r < colH ? 1 : 0.08;
        }
        if (k < 0.12) continue;
        const hue = (hueBase + u * 40 + Math.sin(t) * 10 + 360) % 360;
        ctx.fillStyle = `hsla(${hue}, 80%, ${58 + k * 20}%, ${0.1 + k * 0.38 + pump * 0.08})`;
        ctx.fillRect(c * cell + cell * 0.18, r * cell + cell * 0.18, cell * 0.64, cell * 0.64);
      }
    }
    // 벽 아래 금 몰딩
    ctx.fillStyle = "#c99a3b";
    ctx.fillRect(0, rows * cell, W, 6);
    ctx.fillStyle = `rgba(255,241,184,${0.4 + pump * 0.4})`;
    ctx.fillRect(0, rows * cell, W, 2);

    // 샹들리에: 금 고리 + 박자에 흔들리는 크리스털
    const cx = W / 2;
    const cy = H * 0.1;
    ctx.save();
    ctx.strokeStyle = "#e9c46a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, cy - 20);
    ctx.stroke();
    for (const [rx, ry] of [
      [W * 0.12, 20],
      [W * 0.08, 14],
    ]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy + ry, rx, ry * 0.6, 0, 0, Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff6d6";
    ctx.shadowColor = "#ffe08a";
    ctx.shadowBlur = 14 + pump * 18;
    for (let i = 0; i < 13; i++) {
      const a = (i / 12) * Math.PI;
      const x = cx + Math.cos(a) * W * 0.12;
      const y = cy + 30 + Math.sin(a) * 12 + Math.sin(t * 3 + i) * 3 * (1 + pump);
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 4, y);
      ctx.lineTo(x, y + 10);
      ctx.lineTo(x - 4, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 조명 빛줄기
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const beams = fever ? 10 : 6;
  const colors = fever ? ["#ffe08a", "#ffffff", "#ffb347"] : ["#ffd27a", "#ff9fcb", "#fff1d0"];
  for (let i = 0; i < beams; i++) {
    const fromLeft = i % 2 === 0;
    const ox = fromLeft ? 0 : W;
    const oy = H * 0.02;
    const a =
      (fromLeft ? 0.35 : Math.PI - 0.35) +
      (fromLeft ? 1 : -1) * (Math.sin(t * (0.9 + i * 0.13) + i) * 0.45 + i * 0.06);
    const L = W * 1.4;
    const ex = ox + Math.cos(a) * L;
    const ey = oy + Math.sin(a) * L;
    const col = colors[i % colors.length];
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.12 + pump * 0.1;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.globalAlpha = 0.55 + pump * 0.3;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
  ctx.restore();

  // 대리석 연회장 바닥: 반사 + 원근 금줄
  const fy = H * 0.6;
  if (!art) {
    const fg = ctx.createLinearGradient(0, fy, 0, H);
    fg.addColorStop(0, "rgba(96,62,110,0.92)");
    fg.addColorStop(1, "rgba(34,18,44,0.96)");
    ctx.fillStyle = fg;
    ctx.fillRect(0, fy, W, H - fy);
    ctx.strokeStyle = `rgba(233,196,106,${0.22 + pump * 0.12})`;
    ctx.lineWidth = 2;
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 30, fy);
      ctx.lineTo(W / 2 + i * 170, H);
      ctx.stroke();
    }
    for (let j = 1; j < 6; j++) {
      const y = fy + (H - fy) * Math.pow(j / 6, 1.6);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }
  // 바닥 스포트라이트
  const sp = ctx.createRadialGradient(W / 2, H * 0.9, 0, W / 2, H * 0.9, W * 0.3);
  sp.addColorStop(0, `rgba(255,255,255,${0.16 + pump * 0.1})`);
  sp.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sp;
  ctx.fillRect(0, fy, W, H - fy);

  // 응원봉 든 런칭 쇼 관객(맨 아래)
  const n = 22;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * (W / n) + Math.sin(i * 3.1) * 12;
    const y = H - 14 + Math.sin(i * 1.7) * 6;
    ctx.fillStyle = "#05030a";
    ctx.beginPath();
    ctx.ellipse(x, y, 26, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    const sway = Math.sin(t * (Math.PI * 2 * 0.93) + i * 0.6) * 0.5;
    const sx = x + 16;
    const sy2 = y - 18;
    const tx = sx + Math.sin(sway) * 50;
    const ty = sy2 - Math.cos(sway) * 50;
    ctx.strokeStyle = "#c99a3b";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy2);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    // 런칭 쇼 관객의 카메라 플래시: 사람마다 엇갈려 가끔 번쩍
    const ph = (t * 0.45 + i * 0.37) % 1;
    if (ph < 0.05) {
      const a = 1 - ph / 0.05;
      const fl = ctx.createRadialGradient(x - 10, y - 26, 0, x - 10, y - 26, 46);
      fl.addColorStop(0, `rgba(255,255,255,${a})`);
      fl.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = fl;
      ctx.fillRect(x - 56, y - 72, 92, 92);
    }
    const col = fever ? "#ffe08a" : ["#ffd27a", "#ff9fcb", "#fff1d0", "#ffb347"][i % 4];
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = 20 + pump * 20;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(tx, ty, 9 + pump * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
