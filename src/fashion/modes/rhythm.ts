import { drawHandGlow, TONE, type Fx, type Hand, type Mode, type Stat, type Tone } from "../core";

/** 06 리듬 챌린지: 음악에 맞춰 네 군데 빛나는 원에 손을 갖다 대요.
 * 바깥 고리가 줄어들어 원에 딱 맞을 때가 박자. 만세 박자는 두 손 모두. */

const BPM = 112;
const BARS = 18;
const BEAT = 60 / BPM;
/** 고리가 보이기 시작해 박자에 닿기까지(초). */
const APPROACH = BEAT * 2.2;
const PERFECT = 0.13;
const GOOD = 0.3;

type Note = {
  pad: number;
  at: number;
  state: "wait" | "perfect" | "good" | "miss";
  shownAt: number;
};

/** 박 번호(0부터)별 패드. 첫 마디와 끝 마디는 쉰다. */
function chart(): { beat: number; pad: number }[] {
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
      if (bar === BARS - 2) out.push({ beat: b + 3, pad: bar % 2 ? 3 : 2 });
    }
  }
  // 마지막 박: 만세
  out.push({ beat: (BARS - 1) * 4, pad: 0 }, { beat: (BARS - 1) * 4, pad: 1 });
  return out;
}

const PAD_TONE: Tone[] = ["pink", "mint", "pink", "mint"];

export class RhythmMode implements Mode {
  seconds = Math.ceil(BARS * 4 * BEAT + 1.5);
  hint = "고리가 원에 닿을 때 손을 대요!";
  grades: [number, number, number] = [16000, 11000, 6000];
  private W = 1920;
  private H = 1080;
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
  private R = 110;
  private judge: { pad: number; text: string; tone: Tone; t: number }[] = [];
  private inside: boolean[][] = [
    [false, false, false, false],
    [false, false, false, false],
  ];
  private end = 0;

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.R = Math.min(W, H) * 0.11;
    this.pads = [
      { x: W * 0.2, y: H * 0.3 },
      { x: W * 0.8, y: H * 0.3 },
      { x: W * 0.28, y: H * 0.72 },
      { x: W * 0.72, y: H * 0.72 },
    ];
    this.notes = [];
    this.started = false;
    this.perfect = 0;
    this.good = 0;
    this.miss = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.judge = [];
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
      shownAt: 0,
    }));
    this.end = this.t0 + BARS * 4 * BEAT;
    this.started = true;
  }

  done(): boolean {
    return this.started && this.now > this.end + 0.3;
  }

  update(dt: number, _t: number, hands: Hand[], fx: Fx): void {
    for (const j of this.judge) j.t += dt;
    this.judge = this.judge.filter((j) => j.t < 0.6);
    if (!this.started) return;
    this.now = fx.sound.now();
    const now = this.now;

    hands.forEach((h, hi) => {
      this.pads.forEach((p, pi) => {
        const inPad = h.on && Math.hypot(h.x - p.x, h.y - p.y) <= this.R;
        const entered = inPad && !this.inside[hi][pi];
        this.inside[hi][pi] = inPad;
        if (!inPad) return;
        // 이 패드에서 아직 안 친 가장 가까운 음
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
    this.hint =
      this.combo >= 4
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
    const pts = base + Math.min(20, this.combo) * 10;
    const p = this.pads[n.pad];
    if (kind === "perfect") this.perfect++;
    else this.good++;
    fx.score(pts, p.x, p.y - this.R * 1.3);
    fx.burst(p.x, p.y, kind === "perfect" ? 14 : 6, PAD_TONE[n.pad]);
    fx.sound.play(kind);
    this.judge.push({
      pad: n.pad,
      text: kind === "perfect" ? "퍼펙트!" : "좋아요",
      tone: kind === "perfect" ? "gold" : "white",
      t: 0,
    });
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[]): void {
    const now = this.started ? this.now : t;
    const beatPhase = this.started ? ((((now - this.t0) / BEAT) % 1) + 1) % 1 : (t / BEAT) % 1;
    const pump = Math.pow(1 - beatPhase, 3);

    // 무대 조명
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const x = this.W * (0.1 + i * 0.2);
      const sway = Math.sin(t * 0.8 + i) * this.W * 0.08;
      const g = ctx.createLinearGradient(x, 0, x + sway, this.H);
      const c = [TONE.pink, TONE.mint, TONE.gold, TONE.mint, TONE.pink][i];
      g.addColorStop(0, c + "40");
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
    ctx.restore();

    // 런웨이 바닥과 이퀄라이저
    const bars = 32;
    for (let i = 0; i < bars; i++) {
      const v = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + t * 3)) * (0.4 + pump * 0.6);
      const bw = this.W / bars;
      ctx.fillStyle = i % 2 ? "rgba(255,184,220,0.35)" : "rgba(168,240,224,0.35)";
      ctx.fillRect(i * bw + 3, this.H - v * this.H * 0.12, bw - 6, v * this.H * 0.12);
    }

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
      ctx.strokeStyle = active ? tone : "rgba(255,255,255,0.35)";
      ctx.fillStyle = active ? tone + "33" : "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.R * (1 + pump * 0.04), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.font = `700 ${Math.round(this.R * 0.32)}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(pi < 2 ? "위" : "아래", p.x, p.y);
    });

    // 다가오는 고리
    if (this.started) {
      for (const n of this.notes) {
        if (n.state !== "wait") continue;
        const left = n.at - now;
        if (left > APPROACH || left < -GOOD) continue;
        const k = Math.max(0, left / APPROACH);
        const p = this.pads[n.pad];
        const both = this.notes.some((m) => m !== n && m.at === n.at);
        ctx.strokeStyle = both ? TONE.gold : TONE[PAD_TONE[n.pad]];
        ctx.lineWidth = 12 - k * 6;
        ctx.globalAlpha = 1 - k * 0.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, this.R * (1 + k * 1.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        if (both && k < 0.9) {
          ctx.font = `700 ${Math.round(this.R * 0.45)}px "Gowun Batang", serif`;
          ctx.fillStyle = TONE.gold;
          ctx.textAlign = "center";
          ctx.fillText("만세!", this.W / 2, this.H * 0.22);
        }
      }
    }

    // 판정 글자
    for (const j of this.judge) {
      const p = this.pads[j.pad];
      ctx.globalAlpha = 1 - j.t / 0.6;
      ctx.font = `700 ${Math.round(this.R * 0.5)}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      ctx.strokeText(j.text, p.x, p.y + this.R * 1.5 - j.t * 40);
      ctx.fillStyle = TONE[j.tone];
      ctx.fillText(j.text, p.x, p.y + this.R * 1.5 - j.t * 40);
    }
    ctx.globalAlpha = 1;

    for (const h of hands) drawStarHand(ctx, h, this.R * 0.55, t);
  }

  stats(): Stat[] {
    return [
      { label: "퍼펙트", value: `${this.perfect}` },
      { label: "좋아요", value: `${this.good}` },
      { label: "최고 콤보", value: `${this.maxCombo}` },
    ];
  }
}

function drawStarHand(ctx: CanvasRenderingContext2D, h: Hand, r: number, t: number): void {
  if (!h.on) return;
  drawHandGlow(ctx, h, r * 1.8, h.id ? "mint" : "pink");
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(t * 2);
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
