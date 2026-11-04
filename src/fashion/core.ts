import { OneEuro } from "@/game/motion";
import type { PoseFrame } from "@/game/pose";
import { BRANDS, ECO, LAYOVER, pickOutfit, type Garment, type Pt } from "./garments";
import type { FashionSound, Line, Sfx } from "./sound";
import type { StationId } from "./stations";

/** 웹캠·인식이 늦는 만큼 손을 속도 방향으로 조금 앞에 그린다(초). 멈출 때 튀어나가지 않게 짧게. */
const LEAD = 0.04;
const LEAD_MAX = 0.07;

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

/** 난이도: 0 이지, 1 노멀, 2 하드. */
export type Level = 0 | 1 | 2;
export const LEVEL_NAMES = ["이지", "노멀", "하드"] as const;
export const LEVEL_LINES = ["누구나 성공!", "실수하면 감점", "판정이 빡빡해요"] as const;
/** 대기 화면 난이도 버튼 자리(무대 0~1 좌표). 손을 올려 두면 고른다. */
export const LEVEL_BOXES = [0.28, 0.5, 0.72].map((cx) => ({
  x: cx - 0.095,
  y: 0.66,
  w: 0.19,
  h: 0.13,
}));
/** 가슴 높이라 옷매무새 고치다 잘못 골리지 않게 1초. */
const LEVEL_HOLD = 1.0;

export interface Fx {
  score(points: number, x: number, y: number, label?: string, tone?: Tone): void;
  /** 큰 판정 도장(퍼펙트·놓침 같은 한 마디). */
  stamp(text: string, x: number, y: number, tone?: Tone): void;
  /** 화면 흔들림(0~1 누적, 제곱으로 줄어든다). */
  shake(amount: number): void;
  /** 아주 잠깐 멈춤(타격감). 리듬에는 쓰지 않는다. */
  hitstop(seconds: number): void;
  burst(x: number, y: number, n: number, tone?: Tone): void;
  /** 무대 전체 축하 연출: 빛줄기 + 색종이 + 큰 글자. */
  celebrate(text: string, tone?: Tone): void;
  /** 효과음. 대기 화면 시범 중에는 조용하다. */
  sfx(name: Sfx): void;
  /** MC 음성. 게임 중에만 말한다. */
  say(line: Line, urgent?: boolean): void;
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
  /** 난이도별 등급 기준 점수 [수석 디자이너, 디자이너, 어시스턴트]. */
  grades: [number, number, number][];
  /** 지금 난이도. 판마다 reset 전에 게임이 넣어 준다. */
  level: Level;
  /** 판 동안 깔리는 잔잔한 음악. 리듬은 자체 음악. */
  music: "lofi" | null;
  /** 막판 점수 2배가 시작되는 남은 시간(초). 없으면 10초. */
  rushAt?: number;
  /** 판에 쓸 곡 파일. 카운트다운 동안 받아 둔다. */
  track?: string;
  /** 터치로 누른 자리(무대 x). */
  tap?(x: number): void;
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
  /** 막판 점수 2배 중. */
  rush: boolean;
  /** 결과 화면 다음 목표: 오늘 1위까지, 다음 등급까지 남은 점수(0이면 없음). */
  toTop: number;
  toGrade: number;
  homeProgress: number;
  level: Level;
  /** 대기 화면에서 손이 올라가 있는 난이도 버튼과 채워진 정도. */
  levelHover: { i: number; k: number } | null;
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
const RUSH_SECONDS = 10;
const HANDS_UP_HOLD = 1.0;
const ABSENT_END = 7;
/** 사람 손이 이만큼 안 보이면 대기 화면에서 시범 손이 나온다. */
const DEMO_AFTER = 1.2;
/** 손이 목표에서 이만큼 오래 떨어져 있으면 화살표. */
const GUIDE_AFTER = 1.1;

type Pop = {
  x: number;
  y: number;
  text: string;
  tone: Tone;
  t: number;
  big: boolean;
  stamp?: boolean;
};
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
  "#ffffff",
  "#9ff3ff",
  "#ff9fcb",
  "#ffffff",
];

type Spark = { x: number; y: number; vx: number; vy: number; t: number; life: number; tone: Tone };

export const TONE: Record<Tone, string> = {
  gold: "#9ff3ff",
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
  /** 손마다 마지막 추론 한 장(거른 위치·속도). 추론 사이 화면 프레임은 이걸로 앞을 내다본다. */
  private samples = [0, 1].map(() => ({
    r: null as PoseFrame["reach"][number],
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    at: 0,
  }));
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
  /** 걸어온 사람은 노멀로 시작한다. */
  level: Level = 1;
  private levelHover: { i: number; k: number } | null = null;
  private trauma = 0;
  private stopT = 0;
  private flashA = 0;
  private awayT = 0;
  /** 판정 도장이 찍힐 때 화면이 살짝 다가온다. */
  private zoom = 0;
  /** 막판 2배로 더 얻은 점수. 등급은 이걸 빼고 매겨서 체험별 등급 기준을 그대로 쓴다. */
  private bonus = 0;
  private rushOn = false;
  private passedTop = false;
  private toTop = 0;
  private toGrade = 0;

  private get rush(): boolean {
    return this.phase === "play" && this.timeLeft <= (this.mode.rushAt ?? RUSH_SECONDS);
  }

  setLevel(level: Level): void {
    if (this.level === level) return;
    this.level = level;
    this.awayT = 0;
    this.rows = this.load();
    this.sound.play("tick");
    if (this.phase === "attract") {
      this.mode.level = level;
      this.mode.reset(this.W, this.H);
    }
    this.emit(true);
  }

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
  private gradeSaid = false;
  private helloAt = -99;
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
    // 옷 사진은 미리 불러 둔다(처음 나올 때 색 천으로 깜빡이지 않게)
    BRANDS.forEach(garmentPhoto);
    mode.level = this.level;
    this.rows = this.load();
    this.timeLeft = mode.seconds;
  }

  private get key(): string {
    // 이지는 예전(난이도 생기기 전) 기록을 그대로 잇는다
    return `weaveon-${this.station}-scores-v1${this.level ? `-l${this.level}` : ""}`;
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

  private todayMemo: { rows: ScoreRow[]; n: number; k: string; out: ScoreRow[] } | null = null;

  /** 오늘 기록(높은 순). 화면이 0.1초마다 부르니 기록·날짜가 그대로면 다시 안 센다. */
  today(): ScoreRow[] {
    const k = dayKey(Date.now());
    const m = this.todayMemo;
    if (m && m.rows === this.rows && m.n === this.rows.length && m.k === k) return m.out;
    const out = this.rows
      .filter((r) => dayKey(r.at) === k)
      .sort((a, b) => b.s - a.s || a.at - b.at);
    this.todayMemo = { rows: this.rows, n: this.rows.length, k, out };
    return out;
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
    this.levelHover = null;
    // 아무도 없으면 다음 사람은 노멀부터
    if (!this.present && this.level !== 1) {
      this.level = 1;
      this.rows = this.load();
    }
    this.mode.level = this.level;
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
    if (this.mode.track) this.sound.loadTrack(this.mode.track);
    this.phase = "countdown";
    this.countT = COUNTDOWN;
    this.lastTick = COUNTDOWN + 1;
    this.points = 0;
    this.bonus = 0;
    this.rushOn = false;
    this.passedTop = false;
    this.pops = [];
    this.handsUpT = 0;
    this.trauma = 0;
    this.stopT = 0;
    this.mode.level = this.level;
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
    this.sound.say("start", true);
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
    const g = this.mode.grades[this.level];
    const base = this.points - this.bonus;
    this.grade = base >= g[0] ? 0 : base >= g[1] ? 1 : base >= g[2] ? 2 : 3;
    this.toTop = this.rank !== 1 && today[0] ? today[0].s - row.s + 1 : 0;
    this.toGrade = this.grade > 0 ? Math.ceil(g[this.grade - 1] - base) : 0;
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
      this.station === "rhythm" ? ECO : LAYOVER,
    );
    this.gradeSaid = false;
    this.sound.play("complete");
    this.sound.say("finale", true);
    this.sound.startMusic(124, this.sound.now() + 0.3, 4, "dance");
    this.emit(true);
  }

  private goResult(): void {
    this.sound.stopMusic();
    this.sound.play("end");
    // 피날레에서 등급을 이미 말했으면 마무리 인사, 아니면 등급 발표
    this.sound.say(this.gradeSaid ? "end" : (`grade${this.grade}` as Line), true);
    this.gradeSaid = false;
    this.phase = "result";
    this.resultT = RESULT_SECONDS;
    this.lastTick = 99;
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
    // 대기 화면에 사람이 들어오면 MC가 인사(12초에 한 번)
    if (
      frame.present &&
      !this.present &&
      this.phase === "attract" &&
      this.time - this.helloAt > 12
    ) {
      this.helloAt = this.time;
      this.sound.say("hello");
    }
    this.present = frame.present;
    this.handsUpNow = frame.handsUp;
    const pointerLive = this.pointer && nowMs - this.pointer.at < 1500;
    frame.reach.forEach((r, i) => {
      const h = this.real[i];
      if (pointerLive && i === 0) return;
      const s = this.samples[i];
      if (!r) {
        h.on = false;
        s.r = null;
        this.filters[i][0].reset();
        this.filters[i][1].reset();
        return;
      }
      // 새 추론이 없는 화면 프레임: 같은 값을 다시 거르면 손이 멈칫했다 튄다. 마지막 속도로 이어 간다.
      if (r === s.r) {
        if (h.on) {
          const k = Math.min(LEAD_MAX, (nowMs - s.at) / 1000 + LEAD);
          this.moveHand(h, this.clampX(s.x + s.vx * k), this.clampY(s.y + s.vy * k));
        }
        return;
      }
      s.r = r;
      const x = this.filters[i][0].filter(r.x * this.W, nowMs);
      const y = this.filters[i][1].filter(r.y * this.H, nowMs);
      const sdt = (nowMs - s.at) / 1000;
      if (h.on && sdt > 0 && sdt < 0.3) {
        s.vx = s.vx * 0.4 + ((x - s.x) / sdt) * 0.6;
        s.vy = s.vy * 0.4 + ((y - s.y) / sdt) * 0.6;
      } else {
        s.vx = 0;
        s.vy = 0;
      }
      s.x = x;
      s.y = y;
      s.at = nowMs;
      this.moveHand(h, this.clampX(x + s.vx * LEAD), this.clampY(y + s.vy * LEAD));
    });
  }

  private clampX(x: number): number {
    return Math.max(0, Math.min(this.W, x));
  }

  private clampY(y: number): number {
    return Math.max(0, Math.min(this.H, y));
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

  pointerDown(x: number, y: number, nowMs: number): void {
    this.pointerMove(x, y, nowMs);
    this.mode.tap?.(x);
  }

  pointerUp(): void {
    this.pointer = null;
    this.real[0].on = false;
  }

  /* Fx */
  score(points: number, x: number, y: number, label?: string, tone: Tone = "gold"): void {
    if (this.phase !== "play") return;
    if (this.rush && points > 0) {
      this.bonus += points;
      points *= 2;
    }
    this.points = Math.max(0, this.points + points);
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

  stamp(text: string, x: number, y: number, tone: Tone = "gold"): void {
    if (this.phase !== "play") return;
    // 도장은 한 번에 하나만(겹치면 읽히지 않는다)
    this.pops = this.pops.filter((p) => !p.stamp);
    this.pops.push({ x, y, text, tone, t: 0, big: true, stamp: true });
    this.zoom = 1;
  }

  shake(amount: number): void {
    if (this.phase === "play") this.trauma = Math.min(1, this.trauma + amount);
  }

  hitstop(seconds: number): void {
    if (this.phase !== "play") return;
    this.stopT = Math.max(this.stopT, seconds);
    this.flashA = Math.max(this.flashA, 0.18);
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
    this.say("complete");
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

  say(line: Line, urgent = false): void {
    if (this.phase === "play") this.sound.say(line, urgent);
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
      // 난이도 버튼 위에 사람 손을 잠깐 올려 두면 고른다
      const over = LEVEL_BOXES.findIndex((b) =>
        this.real.some(
          (h) =>
            h.on &&
            h.x >= b.x * this.W &&
            h.x <= (b.x + b.w) * this.W &&
            h.y >= b.y * this.H &&
            h.y <= (b.y + b.h) * this.H,
        ),
      );
      if (over < 0 || over === this.level) this.levelHover = null;
      else {
        const k = (this.levelHover?.i === over ? this.levelHover.k : 0) + dt / LEVEL_HOLD;
        this.levelHover = { i: over, k: Math.min(1, k) };
        if (k >= 1) {
          this.levelHover = null;
          this.setLevel(over as Level);
        }
      }
      // 사람이 떠난 지 8초면 다음 사람을 위해 노멀로 되돌린다
      // (카메라 없이 터치로 하는 중이면 사람 유무를 모르니 두지 않는다)
      this.awayT = this.present || this.camera !== "live" ? 0 : this.awayT + dt;
      if (this.awayT > 8 && this.level !== 1) {
        this.level = 1;
        this.rows = this.load();
        this.mode.level = 1;
        this.mode.reset(this.W, this.H);
        this.emit(true);
      }
      // 아무도 없으면 40초마다 MC가 지나가는 사람을 부른다
      if (!this.present && this.time - this.helloAt > 40) {
        this.helloAt = this.time;
        this.sound.say("hello");
      }
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
      // 곡이 있는 판은 째깍 소리가 박자를 흐린다
      if (sec <= 10 && sec < this.lastSecond && sec > 0 && !this.mode.track)
        this.sound.play("tick");
      if (sec === 10 && this.lastSecond > 10 && this.mode.seconds > 15) this.sound.say("ten");
      this.lastSecond = sec;
      if (this.rush && !this.rushOn) {
        this.rushOn = true;
        this.cele = { text: "막판 점수 2배!", tone: "pink", t: 0 };
        this.sound.play("complete");
        this.rain(80);
        this.emit(true);
      }
      // 오늘 1등을 넘는 순간
      const best = this.today()[0]?.s;
      if (!this.passedTop && best && this.points > best) {
        this.passedTop = true;
        this.stamp("오늘 1등 돌파!", this.W / 2, this.H * 0.42, "gold");
        this.sound.play("complete");
        this.rain(60);
      }
      // 히트스톱 동안은 옷과 판정이 멈춘다(시계는 흐른다)
      if (this.stopT > 0) this.stopT -= dt;
      else this.mode.update(dt, this.time, this.hands, this);
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
        this.sound.say((["one", "two", "three"] as const)[n - 1] ?? "one", true);
        this.lastTick = n;
      }
      if (was < FINALE.shot && this.finaleT >= FINALE.shot) {
        this.sound.play("shutter");
        this.sound.say("shot", true);
        this.rain(260);
        this.emit(true);
      }
      // 찰칵 뒤 화면에 "OO 탄생!"이 뜰 때 MC도 발표
      if (!this.gradeSaid && this.finaleT >= FINALE.shot + 0.8) {
        this.gradeSaid = true;
        this.sound.say(`grade${this.grade}` as Line, true);
      }
      if (this.finaleT >= FINALE.end) this.goResult();
    } else if (this.phase === "result") {
      this.resultT -= dt;
      const left = Math.ceil(this.resultT);
      if (left <= 10 && left < this.lastTick && left > 0) {
        this.lastTick = left;
        this.sound.play("tick");
      }
      if (this.handsUpNow && this.present && this.resultT < RESULT_SECONDS - 3) this.handsUpT += dt;
      else this.handsUpT = 0;
      if (this.handsUpT >= HANDS_UP_HOLD) this.goCountdown();
      else if (this.resultT <= 0) this.goAttract();
    }

    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.flashA = Math.max(0, this.flashA - dt * 2.5);
    this.zoom = Math.max(0, this.zoom - dt * 7);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < (p.stamp ? 0.75 : 1.1));
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
    // 흔들림: trauma² 만큼, 부드러운 잡음으로(Eiserloh 'Juicing Your Cameras')
    const sh = this.trauma * this.trauma * 30;
    if (sh > 0.3) {
      ctx.translate(Math.sin(this.time * 61) * sh, Math.cos(this.time * 47 + 1.3) * sh);
      ctx.rotate(Math.sin(this.time * 37) * sh * 0.0015);
    }
    if (this.zoom > 0) {
      const z = 1 + this.zoom * 0.025;
      ctx.translate(W / 2, H / 2);
      ctx.scale(z, z);
      ctx.translate(-W / 2, -H / 2);
    }
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
    const on = this.real.filter((h) => h.on);
    if (tgt && this.offTargetT > GUIDE_AFTER && on.length) {
      const from = on.reduce((a, b) =>
        Math.hypot(a.x - tgt.x, a.y - tgt.y) < Math.hypot(b.x - tgt.x, b.y - tgt.y) ? a : b,
      );
      drawGuide(ctx, from.x, from.y, tgt.x, tgt.y, this.time);
    }

    // 떠다니는 반짝이
    for (const g of this.glitter) {
      const tw = (Math.sin(this.time * g.sp * 2 + g.ph) + 1) / 2;
      if (tw < 0.55) continue;
      drawFlare(
        ctx,
        g.x * W,
        ((((g.y - this.time * 0.01 * g.sp) % 1) + 1) % 1) * H,
        g.r * (0.6 + tw) * 3,
        "white",
        (tw - 0.55) * 1.6,
      );
    }

    for (const s of this.sparks) {
      const k = 1 - s.t / s.life;
      drawFlare(ctx, s.x, s.y, 10 + 24 * k, s.tone, k, s.t * 4);
    }
    for (const p of this.pops) {
      if (p.stamp) {
        // 도장: 크게 찍혔다가 살짝 줄고, 끝에 흐려진다
        const k = p.t / 0.75;
        const s =
          k < 0.12
            ? 1.9 - (k / 0.12) * 0.9
            : 1 + Math.sin(Math.min(1, (k - 0.12) * 6) * Math.PI) * 0.06;
        ctx.save();
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.translate(p.x, p.y - 30 * k);
        ctx.rotate(-0.06);
        ctx.scale(s, s);
        ctx.font = `700 100px "Gowun Batang", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = 18;
        ctx.strokeStyle = "rgba(10,12,20,0.92)";
        ctx.strokeText(p.text, 0, 0);
        ctx.shadowColor = TONE[p.tone];
        ctx.shadowBlur = 28;
        ctx.fillStyle = TONE[p.tone];
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
        continue;
      }
      const k = p.t / 1.1;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `700 ${p.big ? 70 : 52}px "Gowun Batang", serif`;
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
        g.addColorStop(0, `rgba(200,245,255,${0.35 * fade})`);
        g.addColorStop(1, "rgba(200,245,255,0)");
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
    // 히트스톱 섬광
    if (this.flashA > 0.01) {
      ctx.fillStyle = `rgba(230,250,255,${this.flashA})`;
      ctx.fillRect(-40, -40, W + 80, H + 80);
    }
    ctx.restore();

    // 피버: 무대 테두리가 금빛으로 맥박
    const rush = this.rush;
    const hot = rush || ((this.phase === "play" && this.mode.meter()?.hot) ?? false);
    if (hot) {
      const pulse = (Math.sin(this.time * (rush ? 14 : 9)) + 1) / 2;
      ctx.save();
      roundRect(ctx, 4, 4, W - 8, H - 8, 34);
      ctx.lineWidth = (rush ? 16 : 10) + pulse * 8;
      ctx.strokeStyle = rush
        ? `rgba(255,111,168,${0.6 + pulse * 0.4})`
        : `rgba(159,243,255,${0.5 + pulse * 0.4})`;
      ctx.shadowColor = rush ? "#ff6fa8" : "#9ff3ff";
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
      rush: this.rush,
      toTop: this.toTop,
      toGrade: this.toGrade,
      homeProgress: this.homeProgress,
      level: this.level,
      levelHover: this.levelHover,
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

/** 화면 전체 배경(포스터 톤): 검정 위에 얼음빛 번짐과 은빛 실크 리본. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#10141d");
  g.addColorStop(1, "#040509");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glows: [number, number, string][] = [
    [0.1 + Math.sin(t * 0.2) * 0.03, 0.15, "rgba(159,243,255,0.16)"],
    [0.9, 0.2 + Math.cos(t * 0.17) * 0.04, "rgba(220,228,240,0.10)"],
    [0.55 + Math.sin(t * 0.13) * 0.05, 1.05, "rgba(200,245,255,0.14)"],
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
    g2.addColorStop(0, "rgba(200,245,255,0)");
    g2.addColorStop(0.3, "rgba(200,245,255,0.10)");
    g2.addColorStop(0.55, "rgba(230,236,245,0.12)");
    g2.addColorStop(0.8, "rgba(200,245,255,0.10)");
    g2.addColorStop(1, "rgba(200,245,255,0)");
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
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const SPRITES = new Map<string, HTMLCanvasElement | null>();

/** 효과 그림을 한 번만 그려 두고 다시 찍는다(매 프레임 그라디언트를 새로 만들지 않게). */
function sprite(
  key: string,
  paint: (c: CanvasRenderingContext2D, m: number) => void,
): HTMLCanvasElement | null {
  if (SPRITES.has(key)) return SPRITES.get(key) ?? null;
  let cv: HTMLCanvasElement | null = null;
  if (typeof document !== "undefined") {
    cv = document.createElement("canvas");
    cv.width = cv.height = 128;
    const c = cv.getContext("2d");
    if (c) paint(c, 64);
    else cv = null;
  }
  SPRITES.set(key, cv);
  return cv;
}

/** 빛 번짐 반짝이: 하얀 심 + 색 후광 + 가로세로 빛살. 빛을 더하는 방식으로 겹친다. */
export function drawFlare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tone: Tone = "white",
  alpha = 1,
  rot = 0,
): void {
  const img = sprite(`flare-${tone}`, (c, m) => {
    const halo = c.createRadialGradient(m, m, 0, m, m, m);
    halo.addColorStop(0, "#ffffff");
    halo.addColorStop(0.1, TONE[tone]);
    halo.addColorStop(0.3, `${TONE[tone]}55`);
    halo.addColorStop(1, `${TONE[tone]}00`);
    c.fillStyle = halo;
    c.fillRect(0, 0, m * 2, m * 2);
    c.globalCompositeOperation = "lighter";
    for (const [rx, ry] of [
      [m * 0.05, m],
      [m, m * 0.05],
    ]) {
      const g = c.createRadialGradient(m, m, 0, m, m, m);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(m, m, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
  if (!img || alpha <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -r, -r, r * 2, r * 2);
  ctx.restore();
}

/** 뭉게뭉게 김·연기 한 덩이(부드러운 덩어리 여러 개를 겹친 그림). */
export function drawSmoke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha = 1,
  rot = 0,
): void {
  const img = sprite("smoke", (c, m) => {
    const rnd = rng(11);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * m * 0.4;
      const rr = m * (0.28 + rnd() * 0.32);
      const px = m + Math.cos(a) * d;
      const py = m + Math.sin(a) * d;
      const g = c.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, "rgba(255,255,255,0.26)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, m * 2, m * 2);
    }
  });
  if (!img || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -r, -r, r * 2, r * 2);
  ctx.restore();
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
  g.addColorStop(1, "#ffffff");
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
  g.addColorStop(0, h.ghost ? "rgba(159,243,255,0.3)" : "rgba(255,255,255,0.35)");
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

const ART = new Map<string, HTMLImageElement>();

/** 그림 파일을 한 번만 불러 둔다. 다 불러오기 전(또는 실패)엔 null. */
function loadImage(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = ART.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    ART.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function artImage(name: string): HTMLImageElement | null {
  return loadImage(`/art/${name}.webp`);
}

/** 도구 그림(public/art/prop-<name>.png, 배경 투명). 못 불렀으면 null — 그때는 코드 그림으로. */
export function propImage(name: "iron" | "scissors" | "needle"): HTMLImageElement | null {
  return loadImage(`/art/prop-${name}.png`);
}

/** 시그니처 옷 사진(배경 지운 것). 사진이 없는 옷이거나 아직 못 불렀으면 null. */
export function garmentPhoto(g: Garment): HTMLImageElement | null {
  return g.photo ? loadImage(`/brand/${g.photo}.webp`) : null;
}

/** 옷 사진을 상자에 그린다(pts가 사진 윤곽이라 상자 = 사진). 그렸으면 true. */
export function drawGarmentPhoto(
  ctx: CanvasRenderingContext2D,
  g: Garment,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  const img = garmentPhoto(g);
  if (!img) return false;
  ctx.drawImage(img, x, y, w, h);
  return true;
}

/** 배경 그림을 무대에 꽉 채워(넘치는 쪽은 잘라) 깔고, 가운데를 살짝 어둡게 해 게임 그림이 잘 보이게. 그렸으면 true. */
export function drawArt(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  name: string,
  dim = 0.42,
): boolean {
  const img = artImage(name);
  if (!img) return false;
  const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, `rgba(20,10,32,${dim})`);
  v.addColorStop(1, `rgba(20,10,32,${dim * 0.4})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return true;
}

/** 왕궁 방(게임 무대 공통): 벽지 색 + 다마스크 무늬 + 양옆 금테 아치 창 + 샹들리에 빛 + 반짝이. */
export function drawPalace(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  wall: [string, string] = ["#141a26", "#06080d"],
  art?: string,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, wall[0]);
  g.addColorStop(1, wall[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // 그린 배경 그림(public/art)이 있으면 꽉 채워 깔고 살짝 어둡게. 없으면 아래 무늬로 그린다.
  if (!art || !drawArt(ctx, W, H, art)) {
    // 다마스크 무늬: 마름모 격자 + 작은 백합 문양
    ctx.save();
    const s = Math.min(W, H) * 0.09;
    ctx.strokeStyle = "rgba(200,235,255,0.10)";
    ctx.fillStyle = "rgba(200,235,255,0.10)";
    ctx.lineWidth = 2;
    for (let y = -s; y < H + s; y += s) {
      for (let x = -s; x < W + s; x += s) {
        const ox = (Math.round(y / s) % 2) * (s / 2);
        const cx = x + ox;
        ctx.beginPath();
        ctx.moveTo(cx, y - s * 0.42);
        ctx.lineTo(cx + s * 0.42, y);
        ctx.lineTo(cx, y + s * 0.42);
        ctx.lineTo(cx - s * 0.42, y);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(cx, y, s * 0.06, s * 0.16, 0, 0, Math.PI * 2);
        ctx.ellipse(cx, y, s * 0.16, s * 0.06, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // 양옆 금테 아치 창(궁전 벽)
    for (const ax of [0.02, 0.84]) {
      const x = W * ax;
      const w = W * 0.14;
      const top = H * 0.16;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x, top + w / 2);
      ctx.arc(x + w / 2, top + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(x + w, H);
      ctx.closePath();
      const wg = ctx.createLinearGradient(0, top, 0, H);
      wg.addColorStop(0, "rgba(140,190,255,0.35)");
      wg.addColorStop(1, "rgba(60,30,90,0.2)");
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.lineWidth = 7;
      ctx.strokeStyle = "#8ea0b4";
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#e6f6ff";
      ctx.stroke();
      ctx.restore();
    }
  }
  // 샹들리에 빛(위에서 내려와 흔들리는 금빛)
  for (const fx of [0.25, 0.5, 0.75]) {
    const lg = ctx.createRadialGradient(W * fx, 0, 0, W * fx, 0, H * 0.85);
    lg.addColorStop(0, `rgba(200,245,255,${0.22 + Math.sin(t * 1.5 + fx * 9) * 0.04})`);
    lg.addColorStop(1, "rgba(200,245,255,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);
  }
  // 반짝이 가루
  ctx.save();
  ctx.fillStyle = "#e6f6ff";
  for (let i = 0; i < 26; i++) {
    const k = (Math.sin(t * 2.2 + i * 1.9) + 1) / 2;
    const x = ((i * 0.381) % 1) * W;
    const y = ((i * 0.617) % 1) * H * 0.9;
    ctx.globalAlpha = k * 0.8;
    const r = 2 + k * 4;
    ctx.beginPath();
    ctx.moveTo(x, y - r * 2);
    ctx.lineTo(x + r * 0.5, y);
    ctx.lineTo(x, y + r * 2);
    ctx.lineTo(x - r * 0.5, y);
    ctx.closePath();
    ctx.moveTo(x - r * 2, y);
    ctx.lineTo(x, y + r * 0.5);
    ctx.lineTo(x + r * 2, y);
    ctx.lineTo(x, y - r * 0.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
