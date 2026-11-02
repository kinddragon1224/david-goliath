import { OneEuro } from "@/game/motion";
import type { PoseFrame } from "@/game/pose";
import { JACKET, SHIRT, pickOutfit, type Garment, type Pt } from "./garments";
import type { FashionSound, Sfx } from "./sound";
import type { StationId } from "./stations";

/** 손 하나. 좌표는 무대(stage) 안 좌표. 가로는 늘 STAGE_W, 세로는 화면 비율에 맞춘다. */
export type Hand = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 초당 이동 거리. */
  speed: number;
  on: boolean;
  /** 대기 화면 시범 손(사람 손이 아님). */
  ghost?: boolean;
};

export const STAGE_W = 1400;

export type Tone = "gold" | "pink" | "mint" | "white";

export interface Fx {
  score(points: number, x: number, y: number, label?: string, tone?: Tone): void;
  burst(x: number, y: number, n: number, tone?: Tone): void;
  /** 무대 전체 축하 연출: 빛줄기 + 색종이 + 큰 글자. */
  celebrate(text: string, tone?: Tone): void;
  /** 효과음. 대기 화면 시범 중에는 조용하다. */
  sfx(name: Sfx): void;
  sound: FashionSound;
}

export type Stat = { label: string; value: string };

/** 위쪽 진행 줄의 한 칸(옷 한 벌, 솔기 하나 등). */
export type QueueItem = {
  label: string;
  state: "done" | "now" | "next";
  pct?: number;
  shape?: Pt[];
  aspect?: number;
  color?: string;
};

/** 콤보·피버 게이지. */
export type Meter = { label: string; value: number; text: string; hot?: boolean };

/** 결과 화면 '나의 컬렉션' 한 점. */
export type Item = { label: string; shape?: Pt[]; aspect?: number; color: string; note?: string };

export type DemoHand = { x: number; y: number };

/** 체험 하나의 규칙과 그림. */
export interface Mode {
  /** 한 판 길이(초). */
  seconds: number;
  /** 지금 할 일 한 줄. */
  hint: string;
  /** 카운트다운 동안 보여 줄 요령. */
  tip: string;
  /** 등급 기준 점수 [수석 디자이너, 디자이너, 어시스턴트]. */
  grades: [number, number, number];
  /** 판 동안 깔리는 잔잔한 음악. 리듬은 자체 음악. */
  music: "lofi" | null;
  reset(W: number, H: number): void;
  update(dt: number, t: number, hands: Hand[], fx: Fx): void;
  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], phase: Phase): void;
  stats(): Stat[];
  queue(): QueueItem[];
  meter(): Meter | null;
  collection(): Item[];
  /** 대기 화면 시범 손 위치. */
  demo(t: number): DemoHand[];
  /** 지금 손이 가야 할 곳. 손이 오래 엉뚱한 데 있으면 화살표로 알려 준다. */
  target(): DemoHand | null;
  /** 리듬처럼 시간보다 먼저 끝날 때. */
  done?(): boolean;
  /** 판이 시작되는 순간(카운트다운이 끝날 때). */
  begin?(fx: Fx): void;
}

export type Phase = "boot" | "attract" | "countdown" | "play" | "finale" | "result";

/** 피팅 피날레 시간표(초): 런웨이 포즈 → 3·2·1 → 찰칵 → 잠깐 멈춘 사진 → 결과. */
export const FINALE = { count: 3, shot: 6, end: 8.2 };

export type ScoreRow = { s: number; at: number };

export type FashionUi = {
  phase: Phase;
  score: number;
  timeLeft: number;
  seconds: number;
  countdown: number;
  handsUp: number;
  present: boolean;
  noHands: boolean;
  demo: boolean;
  camera: "off" | "loading" | "live" | "denied";
  model: "off" | "loading" | "ready" | "failed";
  hint: string;
  tip: string;
  queue: QueueItem[];
  meter: Meter | null;
  stats: Stat[];
  collection: Item[];
  grade: number;
  rank: number;
  lastAt: number;
  todayTop: ScoreRow[];
  todayCount: number;
  muted: boolean;
  soundBlocked: boolean;
  resultLeft: number;
  homeProgress: number;
  /** 피팅 피날레: 3·2·1 숫자(0이면 안 셈), 찰칵 했는지, 입힌 옷 이름. */
  finale: { count: number; shot: boolean; outfit: string[] } | null;
};

export const GRADE_NAMES = ["수석 디자이너", "디자이너", "어시스턴트", "인턴 디자이너"];
export const GRADE_LINES = [
  "런웨이에 설 실력이에요!",
  "손끝이 야무진 디자이너!",
  "조금만 더 하면 디자이너!",
  "첫 작품 완성! 다시 도전해 봐요",
];

const COUNTDOWN = 3;
const RESULT_SECONDS = 14;
const HANDS_UP_HOLD = 1.0;
const ABSENT_END = 7;
/** 사람 손이 이만큼 안 보이면 대기 화면에서 시범 손이 나온다. */
const DEMO_AFTER = 1.2;
/** 손이 목표에서 이만큼 오래 떨어져 있으면 화살표. */
const GUIDE_AFTER = 1.1;

type Pop = { x: number; y: number; text: string; tone: Tone; t: number; big: boolean };
type Confetti = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  t: number;
  life: number;
};
type Glitter = { x: number; y: number; r: number; ph: number; sp: number };
const CONFETTI_COLORS = [
  "#ffd6ea",
  "#d8ccff",
  "#c4f4ea",
  "#fff4d6",
  "#ffe08a",
  "#ff9fcb",
  "#ffffff",
];

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
  W = STAGE_W;
  H = 860;
  phase: Phase = "boot";
  points = 0;
  timeLeft = 0;
  private countT = 0;
  private resultT = 0;
  private handsUpT = 0;
  private absentT = 0;
  private noHandT = 0;
  private lastNow = 0;
  private lastTick = 0;
  private lastSecond = 99;
  grade = 3;
  rank = 0;
  lastAt = 0;
  hands: Hand[] = [0, 1].map((id) => ({ id, x: 0, y: 0, vx: 0, vy: 0, speed: 0, on: false }));
  private real: Hand[] = [0, 1].map((id) => ({
    id,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    on: false,
  }));
  private ghost: Hand[] = [0, 1].map((id) => ({
    id,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    on: false,
    ghost: true,
  }));
  private filters = [0, 1].map(() => [new OneEuro(1.2, 0.02), new OneEuro(1.2, 0.02)]);
  private pointer: { at: number } | null = null;
  private pops: Pop[] = [];
  private sparks: Spark[] = [];
  private confetti: Confetti[] = [];
  private glitter: Glitter[] = [];
  private cele: { text: string; tone: Tone; t: number } | null = null;
  private trailT = 0;
  private homeT = 0;
  private homeArmed = false;
  private needRelease = false;
  homeProgress = 0;

  /** 처음 화면으로(버튼·모션 공통). 이번 판은 기록하지 않는다. */
  goHome(): void {
    if (this.phase === "attract" || this.phase === "boot") return;
    this.needRelease = true;
    this.homeT = 0;
    this.goAttract();
  }
  present = false;
  private handsUpNow = false;
  camera: FashionUi["camera"] = "off";
  model: FashionUi["model"] = "off";
  private rows: ScoreRow[] = [];
  private uiAt = 0;
  private time = 0;
  private frameDt = 1 / 30;
  private realGoneT = 99;
  private offTargetT = 0;
  private demoOn = false;
  private collected: Item[] = [];
  private finalStats: Stat[] = [];
  finaleT = 0;
  /** 피날레에 입힐 옷(그리는 순서: 하의 → 상의). */
  outfit: Garment[] = [];

  get finaleShot(): boolean {
    return this.phase === "finale" && this.finaleT >= FINALE.shot;
  }

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
    const changed = Math.abs(W - this.W) > 1 || Math.abs(H - this.H) > 1;
    this.W = W;
    this.H = H;
    if (changed && this.phase !== "play") this.mode.reset(W, H);
  }

  begin(): void {
    if (this.phase === "boot") this.goAttract();
  }

  goAttract(): void {
    this.sound.stopMusic();
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
    this.sound.stopMusic();
    this.phase = "countdown";
    this.countT = COUNTDOWN;
    this.lastTick = COUNTDOWN + 1;
    this.points = 0;
    this.pops = [];
    this.handsUpT = 0;
    this.mode.reset(this.W, this.H);
    this.timeLeft = this.mode.seconds;
    this.lastSecond = 99;
    this.emit(true);
  }

  private goPlay(): void {
    this.phase = "play";
    this.absentT = 0;
    this.noHandT = 0;
    this.offTargetT = 0;
    this.sound.play("start");
    if (this.mode.music)
      this.sound.startMusic(
        96,
        this.sound.now() + 0.4,
        Math.ceil(this.mode.seconds / 2.5) + 2,
        "lofi",
      );
    this.mode.begin?.(this);
    this.emit(true);
  }

  private finish(): void {
    this.sound.stopMusic();
    this.collected = this.mode.collection();
    this.finalStats = this.mode.stats();
    const row = { s: Math.round(this.points), at: Date.now() };
    this.lastAt = row.at;
    if (row.s > 0) {
      this.rows.push(row);
      this.save();
    }
    const today = this.today();
    this.rank = row.s > 0 ? today.findIndex((r) => r.at === row.at) + 1 : 0;
    const g = this.mode.grades;
    this.grade = this.points >= g[0] ? 0 : this.points >= g[1] ? 1 : this.points >= g[2] ? 2 : 3;
    // 거울 앞에 사람이 있으면 완성한 옷을 입혀 보는 피날레, 없으면 바로 결과
    if (this.present && this.camera === "live") this.goFinale();
    else this.goResult();
  }

  private goFinale(): void {
    this.phase = "finale";
    this.finaleT = 0;
    this.lastTick = 99;
    this.outfit = pickOutfit(
      this.collected.map((c) => c.label),
      this.station === "rhythm" ? JACKET : SHIRT,
    );
    this.sound.play("complete");
    this.sound.startMusic(124, this.sound.now() + 0.3, 4, "dance");
    this.emit(true);
  }

  private goResult(): void {
    this.sound.stopMusic();
    this.sound.play("end");
    this.phase = "result";
    this.resultT = RESULT_SECONDS;
    this.rain(this.grade <= 1 ? 220 : 120);
    this.emit(true);
  }

  setReadiness(camera: FashionUi["camera"], model: FashionUi["model"]): void {
    this.camera = camera;
    this.model = model;
    this.emit(true);
  }

  /** 카메라 한 장면. 손 위치를 거르고 사람이 있는지 본다. reach는 화면 0~1 → 무대 좌표. */
  notePose(frame: PoseFrame, nowMs: number): void {
    this.present = frame.present;
    this.handsUpNow = frame.handsUp;
    const pointerLive = this.pointer && nowMs - this.pointer.at < 1500;
    frame.reach.forEach((r, i) => {
      const h = this.real[i];
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
    const dt = Math.max(1 / 120, Math.min(0.1, this.frameDt));
    if (h.on) {
      h.vx = h.vx * 0.5 + ((x - h.x) / dt) * 0.5;
      h.vy = h.vy * 0.5 + ((y - h.y) / dt) * 0.5;
    } else {
      h.vx = 0;
      h.vy = 0;
    }
    h.speed = Math.hypot(h.vx, h.vy);
    h.x = x;
    h.y = y;
    h.on = true;
  }

  /** 마우스·터치로도 손 하나를 움직일 수 있다(카메라 없을 때, 점검용). 좌표는 무대 좌표. */
  pointerMove(x: number, y: number, nowMs: number): void {
    this.pointer = { at: nowMs };
    this.moveHand(this.real[0], x, y);
  }

  pointerUp(): void {
    this.pointer = null;
    this.real[0].on = false;
  }

  /* Fx */
  score(points: number, x: number, y: number, label?: string, tone: Tone = "gold"): void {
    if (this.phase !== "play") return;
    this.points += points;
    if (label)
      this.pops.push({
        x,
        y,
        text: label,
        tone,
        t: 0,
        big: points >= 400 || (label?.includes("!") ?? false),
      });
  }

  burst(x: number, y: number, n: number, tone: Tone = "gold"): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 120 + Math.random() * 380;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 100,
        t: 0,
        life: 0.5 + Math.random() * 0.6,
        tone,
      });
    }
    if (this.sparks.length > 400) this.sparks.splice(0, this.sparks.length - 400);
  }

  celebrate(text: string, tone: Tone = "gold"): void {
    if (this.phase !== "play" && this.phase !== "attract") return;
    this.cele = { text, tone, t: 0 };
    this.rain(this.phase === "play" ? 140 : 50);
    this.burst(this.W / 2, this.H * 0.45, 40, tone);
  }

  /** 위에서 색종이를 뿌린다. */
  private rain(n: number): void {
    for (let i = 0; i < n; i++) {
      this.confetti.push({
        x: Math.random() * this.W,
        y: -20 - Math.random() * this.H * 0.4,
        vx: (Math.random() - 0.5) * 160,
        vy: 180 + Math.random() * 260,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 12,
        w: 10 + Math.random() * 12,
        h: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0],
        t: 0,
        life: 2.6 + Math.random() * 1.4,
      });
    }
    if (this.confetti.length > 600) this.confetti.splice(0, this.confetti.length - 600);
  }

  sfx(name: Sfx): void {
    if (this.phase === "play") this.sound.play(name);
  }

  update(nowMs: number): void {
    const dt = this.lastNow ? Math.min(0.1, (nowMs - this.lastNow) / 1000) : 0;
    this.lastNow = nowMs;
    this.frameDt = dt || 1 / 30;
    this.time += dt;
    if (this.pointer && nowMs - this.pointer.at > 1500 && !this.present) this.real[0].on = false;

    // 사람 손이 있으면 사람 손, 대기 화면에서 한동안 없으면 시범 손
    const anyReal = this.real.some((h) => h.on);
    this.realGoneT = anyReal ? 0 : this.realGoneT + dt;
    this.demoOn = this.phase === "attract" && this.realGoneT > DEMO_AFTER;
    if (this.demoOn) {
      const pts = this.mode.demo(this.time);
      this.ghost.forEach((g, i) => {
        const p = pts[i];
        if (!p) {
          g.on = false;
          return;
        }
        const ox = g.x;
        const oy = g.y;
        const was = g.on;
        g.x = p.x;
        g.y = p.y;
        g.vx = was && dt ? (g.x - ox) / dt : 0;
        g.vy = was && dt ? (g.y - oy) / dt : 0;
        g.speed = Math.hypot(g.vx, g.vy);
        g.on = true;
      });
      this.hands = this.ghost;
    } else {
      this.ghost.forEach((g) => (g.on = false));
      this.hands = this.real;
    }

    // 게임 중 양손을 2.5초 들고 있으면 처음 화면으로(시작 때 든 손은 한 번 내린 뒤부터 센다)
    if (this.phase === "countdown" || this.phase === "play") {
      if (!this.homeArmed) {
        if (!this.handsUpNow) this.homeArmed = true;
      } else if (this.handsUpNow && this.present) this.homeT += dt;
      else this.homeT = Math.max(0, this.homeT - dt * 3);
      if (this.homeT >= 2.5) this.goHome();
    } else {
      this.homeArmed = false;
      this.homeT = 0;
    }
    this.homeProgress = Math.max(0, Math.min(1, (this.homeT - 0.6) / 1.9));
    if (this.needRelease && !this.handsUpNow) this.needRelease = false;

    if (this.phase === "attract") {
      if (this.handsUpNow && this.present && !this.needRelease) this.handsUpT += dt;
      else this.handsUpT = Math.max(0, this.handsUpT - dt * 2);
      if (this.handsUpT >= HANDS_UP_HOLD) this.goCountdown();
      else this.mode.update(dt, this.time, this.hands, this);
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
      const sec = Math.ceil(this.timeLeft);
      if (sec <= 5 && sec < this.lastSecond && sec > 0) this.sound.play("tick");
      this.lastSecond = sec;
      this.mode.update(dt, this.time, this.hands, this);
      this.absentT = this.present || this.pointer ? 0 : this.absentT + dt;
      this.noHandT = anyReal ? 0 : this.noHandT + dt;
      // 목표에서 오래 떨어져 있나
      const tgt = this.mode.target();
      if (tgt && anyReal) {
        const near = Math.min(
          ...this.real.filter((h) => h.on).map((h) => Math.hypot(h.x - tgt.x, h.y - tgt.y)),
        );
        this.offTargetT = near > this.W * 0.14 ? this.offTargetT + dt : 0;
      } else this.offTargetT = 0;
      if (this.timeLeft <= 0 || this.mode.done?.() || this.absentT > ABSENT_END) this.finish();
    } else if (this.phase === "finale") {
      const was = this.finaleT;
      this.finaleT += dt;
      const n = FINALE.shot - Math.floor(this.finaleT);
      if (this.finaleT >= FINALE.count && this.finaleT < FINALE.shot && n < this.lastTick) {
        this.sound.play("tick");
        this.lastTick = n;
      }
      if (was < FINALE.shot && this.finaleT >= FINALE.shot) {
        this.sound.play("shutter");
        this.rain(260);
        this.emit(true);
      }
      if (this.finaleT >= FINALE.end) this.goResult();
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
      s.vy += 650 * dt;
      s.vx *= 0.98;
    }
    this.sparks = this.sparks.filter((s) => s.t < s.life);
    for (const c of this.confetti) {
      c.t += dt;
      c.x += (c.vx + Math.sin(c.t * 3 + c.rot) * 60) * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
    }
    this.confetti = this.confetti.filter((c) => c.t < c.life && c.y < this.H + 40);
    if (this.cele) {
      this.cele.t += dt;
      if (this.cele.t > 1.8) this.cele = null;
    }
    // 결과 화면은 색종이가 조금씩 계속
    if (this.phase === "result" && Math.random() < dt * 6) this.rain(3);
    // 손이 지나간 자리에 반짝이 꼬리
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.035;
      for (const h of this.hands) {
        if (!h.on || h.speed < 160) continue;
        this.sparks.push({
          x: h.x + (Math.random() - 0.5) * 30,
          y: h.y + (Math.random() - 0.5) * 30,
          vx: -h.vx * 0.05 + (Math.random() - 0.5) * 40,
          vy: -h.vy * 0.05 - 40,
          t: 0,
          life: 0.45 + Math.random() * 0.3,
          tone: h.id ? "mint" : "pink",
        });
      }
    }
    // 떠다니는 반짝이
    if (this.glitter.length === 0) {
      for (let i = 0; i < 36; i++)
        this.glitter.push({
          x: Math.random(),
          y: Math.random(),
          r: 2 + Math.random() * 5,
          ph: Math.random() * 6,
          sp: 0.6 + Math.random() * 1.6,
        });
    }

    if (nowMs - this.uiAt > 100) this.emit(false);
  }

  /** 무대 안 그림. 호출하는 쪽에서 무대 위치로 옮기고 확대해 둔다. */
  render(ctx: CanvasRenderingContext2D): void {
    const W = this.W;
    const H = this.H;
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 36);
    ctx.clip();
    this.mode.draw(ctx, this.time, this.hands, this.phase);

    // 시범 손 이름표
    if (this.demoOn) {
      const g = this.ghost.find((h) => h.on);
      if (g) {
        ctx.font = `700 34px "Gowun Batang", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const ty = g.y - 120;
        ctx.fillStyle = "rgba(20,14,30,0.75)";
        roundRect(ctx, g.x - 120, ty - 30, 240, 60, 30);
        ctx.fill();
        ctx.fillStyle = TONE.gold;
        ctx.fillText("이렇게 해요!", g.x, ty + 2);
      }
    }

    // 엉뚱한 곳에 오래 있으면 "여기로!" 화살표
    const tgt = this.phase === "play" ? this.mode.target() : null;
    if (tgt && this.offTargetT > GUIDE_AFTER) {
      const on = this.real.filter((h) => h.on);
      const from = on.reduce((a, b) =>
        Math.hypot(a.x - tgt.x, a.y - tgt.y) < Math.hypot(b.x - tgt.x, b.y - tgt.y) ? a : b,
      );
      drawGuide(ctx, from.x, from.y, tgt.x, tgt.y, this.time);
    }

    // 떠다니는 반짝이
    for (const g of this.glitter) {
      const tw = (Math.sin(this.time * g.sp * 2 + g.ph) + 1) / 2;
      if (tw < 0.55) continue;
      ctx.globalAlpha = (tw - 0.55) * 1.6;
      ctx.fillStyle = "#ffffff";
      drawStar(
        ctx,
        g.x * W,
        ((((g.y - this.time * 0.01 * g.sp) % 1) + 1) % 1) * H,
        g.r * (0.6 + tw),
      );
    }
    ctx.globalAlpha = 1;

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
      ctx.font = `700 ${p.big ? 56 : 42}px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "rgba(20,14,30,0.85)";
      ctx.lineJoin = "round";
      const y = p.y - 80 * Math.sqrt(k);
      ctx.strokeText(p.text, p.x, y);
      ctx.fillStyle = TONE[p.tone];
      ctx.fillText(p.text, p.x, y);
    }
    ctx.globalAlpha = 1;

    // 축하: 빛줄기 + 큰 글자
    if (this.cele) {
      const k = this.cele.t / 1.8;
      const cx = W / 2;
      const cy = H * 0.45;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(cx, cy);
      ctx.rotate(this.time * 0.6);
      const fade = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      for (let i = 0; i < 14; i++) {
        ctx.rotate((Math.PI * 2) / 14);
        const g = ctx.createLinearGradient(0, 0, Math.max(W, H) * 0.8, 0);
        g.addColorStop(0, `rgba(255,236,170,${0.35 * fade})`);
        g.addColorStop(1, "rgba(255,236,170,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.max(W, H), -60);
        ctx.lineTo(Math.max(W, H), 60);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      const pop = k < 0.12 ? 0.4 + (k / 0.12) * 0.8 : k < 0.2 ? 1.2 - ((k - 0.12) / 0.08) * 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      ctx.translate(cx, cy);
      ctx.scale(pop, pop);
      ctx.font = `700 110px "Gowun Batang", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = 18;
      ctx.strokeStyle = "rgba(20,14,30,0.9)";
      ctx.strokeText(this.cele.text, 0, 0);
      ctx.fillStyle = pearl(ctx, -360, -60, 360, 60, this.time * 3);
      ctx.shadowColor = TONE[this.cele.tone];
      ctx.shadowBlur = 40;
      ctx.fillText(this.cele.text, 0, 0);
      ctx.restore();
    }

    // 색종이
    for (const c of this.confetti) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (c.life - c.t) * 2);
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.scale(1, Math.abs(Math.cos(c.t * 6 + c.rot)) + 0.15);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    ctx.restore();

    // 피버: 무대 테두리가 금빛으로 맥박
    const hot = (this.phase === "play" && this.mode.meter()?.hot) ?? false;
    if (hot) {
      const pulse = (Math.sin(this.time * 9) + 1) / 2;
      ctx.save();
      roundRect(ctx, 4, 4, W - 8, H - 8, 34);
      ctx.lineWidth = 10 + pulse * 8;
      ctx.strokeStyle = `rgba(255,224,138,${0.5 + pulse * 0.4})`;
      ctx.shadowColor = "#ffe08a";
      ctx.shadowBlur = 40;
      ctx.stroke();
      ctx.restore();
    }

    // 무대 테두리
    ctx.save();
    roundRect(ctx, 1.5, 1.5, W - 3, H - 3, 36);
    ctx.lineWidth = 3;
    ctx.strokeStyle = pearl(ctx, 0, 0, W, H, this.time * 0.5);
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.restore();
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
      noHands: this.phase === "play" && this.noHandT > 1,
      demo: this.demoOn,
      camera: this.camera,
      model: this.model,
      hint: this.mode.hint,
      tip: this.mode.tip,
      queue: this.mode.queue(),
      meter: this.mode.meter(),
      stats: this.phase === "result" ? this.finalStats : [],
      collection: this.phase === "result" ? this.collected : [],
      grade: this.grade,
      rank: this.rank,
      lastAt: this.lastAt,
      todayTop: today.slice(0, 5),
      todayCount: today.length,
      muted: this.sound.muted,
      soundBlocked: !!this.sound.ctx && !this.sound.running,
      resultLeft: Math.max(0, Math.ceil(this.resultT)),
      homeProgress: this.homeProgress,
      finale:
        this.phase === "finale"
          ? {
              count:
                this.finaleT >= FINALE.count && this.finaleT < FINALE.shot
                  ? FINALE.shot - Math.floor(this.finaleT)
                  : 0,
              shot: this.finaleShot,
              outfit: this.outfit.map((g) => g.name),
            }
          : null,
    });
  }
}

/* ───────── 공통 그림 ───────── */

/** 아틀리에 배경(화면 전체): 깊은 밤색 위에 진주빛 번짐. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#16111f");
  g.addColorStop(1, "#09080e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glows: [number, number, string][] = [
    [0.1 + Math.sin(t * 0.2) * 0.03, 0.15, "rgba(255,184,220,0.16)"],
    [0.9, 0.2 + Math.cos(t * 0.17) * 0.04, "rgba(184,170,255,0.16)"],
    [0.55 + Math.sin(t * 0.13) * 0.05, 1.05, "rgba(160,240,224,0.12)"],
  ];
  for (const [x, y, c] of glows) {
    const r = Math.max(W, H) * 0.55;
    const rg = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  // 포스터처럼 흐르는 진주빛 실크 리본
  for (let i = 0; i < 3; i++) {
    const ph = t * (0.25 + i * 0.07) + i * 2;
    const y0 = H * (0.2 + i * 0.3);
    const amp = H * (0.12 + i * 0.03);
    const thick = H * (0.05 + i * 0.015);
    const g2 = ctx.createLinearGradient(0, 0, W, 0);
    g2.addColorStop(0, "rgba(255,214,234,0)");
    g2.addColorStop(0.3, "rgba(255,214,234,0.10)");
    g2.addColorStop(0.55, "rgba(216,204,255,0.13)");
    g2.addColorStop(0.8, "rgba(196,244,234,0.10)");
    g2.addColorStop(1, "rgba(196,244,234,0)");
    ctx.fillStyle = g2;
    ctx.beginPath();
    const N = 24;
    for (let k = 0; k <= N; k++) {
      const x = (k / N) * W;
      const y = y0 + Math.sin(k * 0.35 + ph) * amp;
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    for (let k = N; k >= 0; k--) {
      const x = (k / N) * W;
      const tw = Math.sin(k * 0.5 + ph * 1.3) * thick;
      ctx.lineTo(x, y0 + Math.sin(k * 0.35 + ph) * amp + thick + tw);
    }
    ctx.closePath();
    ctx.fill();
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
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

/** 진주빛 그라디언트. */
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

/** 손 위치 표시(체험별 도구 아래에 깔리는 빛 동그라미). 시범 손은 점선 고리. */
export function drawHandGlow(
  ctx: CanvasRenderingContext2D,
  h: Hand,
  r: number,
  tone: Tone = "white",
): void {
  if (!h.on) return;
  const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, r);
  g.addColorStop(0, h.ghost ? "rgba(255,224,138,0.3)" : "rgba(255,255,255,0.35)");
  g.addColorStop(0.6, TONE[tone] + "33");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
  ctx.fill();
  if (h.ghost) {
    ctx.save();
    ctx.strokeStyle = TONE.gold;
    ctx.lineWidth = 4;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(h.x, h.y, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** 손에서 목표까지 "여기로!" 점선 화살표. */
export function drawGuide(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  t: number,
): void {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 60) return;
  const a = Math.atan2(y1 - y0, x1 - x0);
  const sx = x0 + Math.cos(a) * 60;
  const sy = y0 + Math.sin(a) * 60;
  const ex = x1 - Math.cos(a) * 70;
  const ey = y1 - Math.sin(a) * 70;
  ctx.save();
  ctx.strokeStyle = TONE.gold;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.setLineDash([4, 22]);
  ctx.lineDashOffset = -t * 120;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = TONE.gold;
  ctx.beginPath();
  ctx.moveTo(26, 0);
  ctx.lineTo(-14, -20);
  ctx.lineTo(-14, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 목표 고리
  const pulse = 1 + Math.sin(t * 8) * 0.12;
  ctx.save();
  ctx.strokeStyle = TONE.gold;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x1, y1, 60 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `700 36px "Gowun Batang", serif`;
  ctx.textAlign = "center";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(20,14,30,0.85)";
  ctx.strokeText("여기로!", x1, y1 - 90);
  ctx.fillStyle = TONE.gold;
  ctx.fillText("여기로!", x1, y1 - 90);
  ctx.restore();
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

/** 두 점 사이를 부드럽게(시범 손용). */
export function ease(a: number, b: number, k: number): number {
  const s = k * k * (3 - 2 * k);
  return a + (b - a) * s;
}
