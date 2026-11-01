import { OneEuro } from "@/game/motion";
import type { PoseFrame } from "@/game/pose";
import type { FashionSound } from "./sound";
import type { StationId } from "./stations";

/** 손 하나. 좌표는 월드(가로 1920 기준) 픽셀. */
export type Hand = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 초당 이동 거리(월드 픽셀). */
  speed: number;
  on: boolean;
};

export type Tone = "gold" | "pink" | "mint" | "white";

export interface Fx {
  score(points: number, x: number, y: number, label?: string, tone?: Tone): void;
  burst(x: number, y: number, n: number, tone?: Tone): void;
  sound: FashionSound;
}

export type Stat = { label: string; value: string };

/** 체험 하나의 규칙과 그림. */
export interface Mode {
  /** 한 판 길이(초). */
  seconds: number;
  /** 지금 할 일 한 줄. */
  hint: string;
  /** 등급 기준 점수 [수석 디자이너, 디자이너, 어시스턴트]. */
  grades: [number, number, number];
  reset(W: number, H: number): void;
  update(dt: number, t: number, hands: Hand[], fx: Fx): void;
  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], playing: boolean): void;
  stats(): Stat[];
  /** 리듬처럼 시간보다 먼저 끝날 때. */
  done?(): boolean;
  /** 판이 시작되는 순간(카운트다운이 끝날 때). */
  begin?(fx: Fx): void;
}

export type Phase = "boot" | "attract" | "countdown" | "play" | "result";

export type ScoreRow = { s: number; at: number };

export type FashionUi = {
  phase: Phase;
  score: number;
  timeLeft: number;
  seconds: number;
  countdown: number;
  handsUp: number;
  present: boolean;
  camera: "off" | "loading" | "live" | "denied";
  model: "off" | "loading" | "ready" | "failed";
  hint: string;
  stats: Stat[];
  grade: number;
  rank: number;
  todayTop: ScoreRow[];
  todayCount: number;
  muted: boolean;
  soundBlocked: boolean;
  resultLeft: number;
};

export const GRADE_NAMES = ["수석 디자이너", "디자이너", "어시스턴트", "인턴 디자이너"];

const COUNTDOWN = 3;
const RESULT_SECONDS = 12;
const HANDS_UP_HOLD = 1.0;
const ABSENT_END = 6;

type Pop = { x: number; y: number; text: string; tone: Tone; t: number; big: boolean };
type Spark = { x: number; y: number; vx: number; vy: number; t: number; life: number; tone: Tone };

export const TONE: Record<Tone, string> = {
  gold: "#ffe08a",
  pink: "#ffb8dc",
  mint: "#a8f0e0",
  white: "#ffffff",
};

function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export class FashionGame implements Fx {
  W = 1920;
  H = 1080;
  phase: Phase = "boot";
  points = 0;
  timeLeft = 0;
  private countT = 0;
  private resultT = 0;
  private handsUpT = 0;
  private absentT = 0;
  private lastNow = 0;
  private lastTick = 0;
  grade = 3;
  rank = 0;
  hands: Hand[] = [0, 1].map((id) => ({ id, x: 0, y: 0, vx: 0, vy: 0, speed: 0, on: false }));
  private filters = [0, 1].map(() => [new OneEuro(1.2, 0.02), new OneEuro(1.2, 0.02)]);
  private pointer: { x: number; y: number; at: number } | null = null;
  private pops: Pop[] = [];
  private sparks: Spark[] = [];
  present = false;
  private handsUpNow = false;
  camera: FashionUi["camera"] = "off";
  model: FashionUi["model"] = "off";
  private rows: ScoreRow[] = [];
  private uiAt = 0;
  private time = 0;

  constructor(
    readonly station: StationId,
    readonly mode: Mode,
    readonly sound: FashionSound,
    private onUi: (ui: FashionUi) => void,
  ) {
    this.rows = this.load();
    this.timeLeft = mode.seconds;
  }

  private get key(): string {
    return `weaveon-${this.station}-scores-v1`;
  }

  private load(): ScoreRow[] {
    try {
      const raw = JSON.parse(localStorage.getItem(this.key) ?? "[]") as ScoreRow[];
      return Array.isArray(raw)
        ? raw.filter((r) => typeof r.s === "number" && typeof r.at === "number")
        : [];
    } catch {
      return [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.rows.slice(-3000)));
    } catch {
      /* 저장이 막혀도 게임은 돈다 */
    }
  }

  clearToday(): void {
    const today = dayKey(Date.now());
    this.rows = this.rows.filter((r) => dayKey(r.at) !== today);
    this.save();
    this.emit(true);
  }

  today(): ScoreRow[] {
    const k = dayKey(Date.now());
    return this.rows.filter((r) => dayKey(r.at) === k).sort((a, b) => b.s - a.s || a.at - b.at);
  }

  resize(W: number, H: number): void {
    const changed = W !== this.W || H !== this.H;
    this.W = W;
    this.H = H;
    if (changed && this.phase !== "play") this.mode.reset(W, H);
  }

  begin(): void {
    if (this.phase === "boot") this.goAttract();
  }

  goAttract(): void {
    this.phase = "attract";
    this.handsUpT = 0;
    this.mode.reset(this.W, this.H);
    this.emit(true);
  }

  pressStart(): void {
    if (this.phase === "attract" || this.phase === "result" || this.phase === "boot")
      this.goCountdown();
  }

  private goCountdown(): void {
    this.sound.unlock();
    this.phase = "countdown";
    this.countT = COUNTDOWN;
    this.lastTick = COUNTDOWN + 1;
    this.points = 0;
    this.pops = [];
    this.mode.reset(this.W, this.H);
    this.timeLeft = this.mode.seconds;
    this.emit(true);
  }

  private goPlay(): void {
    this.phase = "play";
    this.absentT = 0;
    this.sound.play("start");
    this.mode.begin?.(this);
    this.emit(true);
  }

  private finish(): void {
    this.sound.stopMusic();
    this.sound.play("end");
    this.phase = "result";
    this.resultT = RESULT_SECONDS;
    const row = { s: Math.round(this.points), at: Date.now() };
    if (row.s > 0) {
      this.rows.push(row);
      this.save();
    }
    const today = this.today();
    this.rank = row.s > 0 ? today.findIndex((r) => r.at === row.at) + 1 : 0;
    const g = this.mode.grades;
    this.grade = this.points >= g[0] ? 0 : this.points >= g[1] ? 1 : this.points >= g[2] ? 2 : 3;
    this.emit(true);
  }

  setReadiness(camera: FashionUi["camera"], model: FashionUi["model"]): void {
    this.camera = camera;
    this.model = model;
    this.emit(true);
  }

  /** 카메라 한 장면. 손 위치를 거르고 사람이 있는지 본다. */
  notePose(frame: PoseFrame, nowMs: number): void {
    this.present = frame.present;
    this.handsUpNow = frame.handsUp;
    const pointerLive = this.pointer && nowMs - this.pointer.at < 1500;
    frame.reach.forEach((r, i) => {
      const h = this.hands[i];
      if (pointerLive && i === 0) return;
      if (!r) {
        h.on = false;
        this.filters[i][0].reset();
        this.filters[i][1].reset();
        return;
      }
      const x = this.filters[i][0].filter(r.x * this.W, nowMs);
      const y = this.filters[i][1].filter(r.y * this.H, nowMs);
      this.moveHand(h, x, y);
    });
  }

  private moveHand(h: Hand, x: number, y: number): void {
    const dt = Math.max(1 / 120, Math.min(0.1, this.frameDt || 1 / 30));
    if (h.on) {
      const vx = (x - h.x) / dt;
      const vy = (y - h.y) / dt;
      h.vx = h.vx * 0.5 + vx * 0.5;
      h.vy = h.vy * 0.5 + vy * 0.5;
    } else {
      h.vx = 0;
      h.vy = 0;
    }
    h.speed = Math.hypot(h.vx, h.vy);
    h.x = x;
    h.y = y;
    h.on = true;
  }

  private frameDt = 1 / 30;

  /** 마우스·터치로도 손 하나를 움직일 수 있다(카메라 없을 때, 점검용). */
  pointerMove(x: number, y: number, nowMs: number, down: boolean): void {
    if (!down && !this.pointer) return;
    this.pointer = { x, y, at: nowMs };
    this.moveHand(this.hands[0], x, y);
  }

  pointerUp(): void {
    this.pointer = null;
    this.hands[0].on = false;
  }

  score(points: number, x: number, y: number, label?: string, tone: Tone = "gold"): void {
    if (this.phase !== "play") return;
    this.points += points;
    if (label) this.pops.push({ x, y, text: label, tone, t: 0, big: points >= 300 });
  }

  burst(x: number, y: number, n: number, tone: Tone = "gold"): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 150 + Math.random() * 450;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 120,
        t: 0,
        life: 0.5 + Math.random() * 0.6,
        tone,
      });
    }
    if (this.sparks.length > 400) this.sparks.splice(0, this.sparks.length - 400);
  }

  update(nowMs: number): void {
    const dt = this.lastNow ? Math.min(0.1, (nowMs - this.lastNow) / 1000) : 0;
    this.lastNow = nowMs;
    this.frameDt = dt || 1 / 30;
    this.time += dt;
    if (this.pointer && nowMs - this.pointer.at > 1500 && !this.present) this.hands[0].on = false;

    if (this.phase === "attract") {
      if (this.handsUpNow && this.present) this.handsUpT += dt;
      else this.handsUpT = Math.max(0, this.handsUpT - dt * 2);
      if (this.handsUpT >= HANDS_UP_HOLD) this.goCountdown();
      // 대기 화면에서도 손으로 미리 해 볼 수 있다(점수는 안 오른다)
      this.mode.update(dt, this.time, this.hands, this);
    } else if (this.phase === "countdown") {
      this.countT -= dt;
      const n = Math.ceil(this.countT);
      if (n < this.lastTick && n > 0) {
        this.sound.play("tick");
        this.lastTick = n;
      }
      if (this.countT <= 0) this.goPlay();
    } else if (this.phase === "play") {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      this.mode.update(dt, this.time, this.hands, this);
      this.absentT = this.present || this.pointer ? 0 : this.absentT + dt;
      if (this.timeLeft <= 0 || this.mode.done?.() || this.absentT > ABSENT_END) this.finish();
    } else if (this.phase === "result") {
      this.resultT -= dt;
      if (this.handsUpNow && this.present && this.resultT < RESULT_SECONDS - 3) this.handsUpT += dt;
      else this.handsUpT = 0;
      if (this.handsUpT >= HANDS_UP_HOLD) this.goCountdown();
      else if (this.resultT <= 0) this.goAttract();
    }

    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < 1.1);
    for (const s of this.sparks) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 700 * dt;
      s.vx *= 0.98;
    }
    this.sparks = this.sparks.filter((s) => s.t < s.life);

    if (nowMs - this.uiAt > 100) this.emit(false);
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawBackdrop(ctx, this.W, this.H, this.time);
    this.mode.draw(ctx, this.time, this.hands, this.phase === "play" || this.phase === "attract");
    for (const s of this.sparks) {
      const k = 1 - s.t / s.life;
      ctx.globalAlpha = k;
      ctx.fillStyle = TONE[s.tone];
      drawStar(ctx, s.x, s.y, 4 + 10 * k);
    }
    ctx.globalAlpha = 1;
    for (const p of this.pops) {
      const k = p.t / 1.1;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `700 ${p.big ? 64 : 46}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      ctx.lineJoin = "round";
      const y = p.y - 90 * Math.sqrt(k);
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = TONE[p.tone];
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;
  }

  emit(force: boolean): void {
    if (!force && this.phase === "boot") return;
    this.uiAt = performance.now();
    const today = this.today();
    this.onUi({
      phase: this.phase,
      score: Math.round(this.points),
      timeLeft: this.timeLeft,
      seconds: this.mode.seconds,
      countdown: Math.max(1, Math.ceil(this.countT)),
      handsUp: Math.min(1, this.handsUpT / HANDS_UP_HOLD),
      present: this.present,
      camera: this.camera,
      model: this.model,
      hint: this.mode.hint,
      stats: this.phase === "result" ? this.mode.stats() : [],
      grade: this.grade,
      rank: this.rank,
      todayTop: today.slice(0, 5),
      todayCount: today.length,
      muted: this.sound.muted,
      soundBlocked: !!this.sound.ctx && !this.sound.running,
      resultLeft: Math.max(0, Math.ceil(this.resultT)),
    });
  }
}

/* ───────── 공통 그림 ───────── */

/** 아틀리에 배경: 깊은 밤색 위에 진주빛 번짐. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#15111f");
  g.addColorStop(1, "#0a0910");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glows: [number, number, string][] = [
    [0.12 + Math.sin(t * 0.2) * 0.03, 0.2, "rgba(255,184,220,0.16)"],
    [0.88, 0.25 + Math.cos(t * 0.17) * 0.04, "rgba(184,170,255,0.16)"],
    [0.5 + Math.sin(t * 0.13) * 0.05, 1.0, "rgba(160,240,224,0.12)"],
  ];
  for (const [x, y, c] of glows) {
    const r = Math.max(W, H) * 0.55;
    const rg = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** 진주빛(무지개 光) 그라디언트. */
export function pearl(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t = 0,
): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  const s = (Math.sin(t) + 1) * 0.08;
  g.addColorStop(0, "#ffd6ea");
  g.addColorStop(0.3 + s, "#d8ccff");
  g.addColorStop(0.65 - s, "#c4f4ea");
  g.addColorStop(1, "#fff4d6");
  return g;
}

/** 손 위치 표시(체험별 도구 아래에 깔리는 빛 동그라미). */
export function drawHandGlow(
  ctx: CanvasRenderingContext2D,
  h: Hand,
  r: number,
  tone: Tone = "white",
): void {
  if (!h.on) return;
  const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
  g.addColorStop(0, "rgba(255,255,255,0.35)");
  g.addColorStop(0.6, TONE[tone] + "33");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** 원단 위 미세한 결. */
export function fabricTexture(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.08;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < w; i += 7) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i, y + h);
  }
  for (let j = 0; j < h; j += 7) {
    ctx.moveTo(x, y + j);
    ctx.lineTo(x + w, y + j);
  }
  ctx.stroke();
  ctx.restore();
}

/** 0~1 난수(시드 고정). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
