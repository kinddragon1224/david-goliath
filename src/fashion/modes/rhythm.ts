import { smoothClock, StrikeDetector, type Lane } from "../drum";
import { slow, SLOW_PC } from "@/game/perf";
import {
  artImage,
  drawArt,
  drawFlare,
  drawHandGlow,
  roundRect,
  stampLayer,
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

/** 06 몽글 드럼
 * 큰 북 하나를 두 손으로 친다. 위 줄을 흘러오는 빨강 '왼'은 왼쪽에서, 파랑 '오'는 오른쪽에서
 * 손을 들었다가 점선 아래로 내려친다. 금빛 '양손'은 두 손 같이, 끝은 마음껏 연타.
 * 밤 축제로 시작해 콤보가 쌓일수록 무대가 밝아지고, 10콤보부터 런웨이 피버(점수 1.5배). */

/** 곡 둘(11/19 대표님이 준 곡. 예전 곡 mongle-drum.mp3 은 뺐다). 대기 화면에서 고른다. 곡을 거의 끝까지 친다(74초·84초).
 * 채보는 scripts/drum-chart.py 가 곡을 분석해 만든다: 첫 박이 0초가 되게 자르고, 음악이 쉬는 곳은 쉬고, 뒤쪽 절반의 뚜렷한 스네어에 반 박을 넣는다.
 * 곡의 빠르기가 조금씩 변해서(중촌 챌린지) 음표는 "몇 번째 박"이 아니라 박자 추적이 찾은 "몇 초"로 적는다.
 * 두 곡 다 빨라서(분당 131·147박) 게임의 한 박은 음악 두 박이다. bpm 은 그 평균(박 줄·들썩임 같은 그림에만 쓴다. 판정은 chart 의 초).
 * rollAt 부터 endAt 까지는 음표 없이 마음껏 치는 연타. */
type Song = { title: string; track: string; bpm: number; rollAt: number; endAt: number; seconds: number; chart: [number, 0 | 1 | 2][] };
export const SONGS: Song[] = [
  {
    title: "중촌 챌린지",
    track: "/audio/jungchon-challenge.mp3",
    bpm: 73.468,
    rollAt: 77.584,
    endAt: 81.676,
    seconds: 84.18,
    // [초, 손]: 0 왼, 1 오, 2 양손
    chart: [[3.965,0],[4.807,1],[7.291,1],[8.121,0],[8.945,1],[9.758,1],[11.221,0],[12.045,2],[12.875,0],[13.706,1],[14.53,0],[15.354,1],[16.074,0],[16.805,0],[17.63,1],[18.454,2],[19.278,0],[20.114,1],[20.939,0],[21.775,1],[22.599,1],[23.412,1],[24.236,0],[25.06,2],[25.884,0],[26.715,1],[27.533,0],[28.357,1],[29.182,0],[30.006,0],[30.83,1],[31.66,2],[32.479,0],[33.303,1],[34.139,0],[34.952,1],[35.776,1],[36.6,1],[37.425,0],[38.249,2],[39.073,0],[39.886,1],[40.304,0],[40.716,0],[41.546,1],[41.953,0],[42.365,0],[43.183,0],[43.59,1],[44.008,1],[44.832,2],[45.65,0],[46.469,1],[46.887,0],[47.293,0],[48.118,1],[48.53,0],[48.942,1],[49.766,1],[50.173,0],[50.579,0],[51.397,2],[52.227,0],[53.052,1],[53.458,0],[54.689,1],[55.095,0],[55.501,0],[56.326,0],[56.732,1],[57.139,1],[57.963,2],[58.776,0],[59.6,1],[60.006,0],[60.413,0],[61.237,1],[61.643,0],[62.05,1],[62.874,1],[63.687,0],[64.511,2],[65.329,0],[66.148,1],[66.554,0],[66.961,0],[67.779,1],[68.191,0],[68.598,0],[69.41,0],[69.828,1],[70.229,1],[71.047,2],[71.872,0],[72.684,1],[74.31,1],[75.134,1],[75.958,1],[76.365,0],[76.765,0]],
  },
  {
    title: "중촌 비트 팡팡",
    track: "/audio/jungchon-beat.mp3",
    bpm: 66.001,
    rollAt: 67.239,
    endAt: 71.819,
    seconds: 74.32,
    // [초, 손]: 0 왼, 1 오, 2 양손
    chart: [[3.28,0],[4.226,0],[5.143,1],[6.066,2],[6.989,0],[7.895,1],[8.824,0],[9.729,1],[10.652,1],[12.452,0],[13.398,2],[14.315,0],[15.232,1],[16.149,0],[17.055,1],[17.972,0],[18.889,0],[19.807,1],[20.724,2],[21.635,0],[22.558,1],[23.475,0],[24.387,1],[25.304,1],[26.215,1],[27.109,0],[28.05,2],[28.926,0],[29.872,1],[30.79,0],[32.624,0],[34.453,1],[35.358,2],[36.241,0],[37.187,1],[37.64,0],[38.075,0],[39.01,1],[39.468,0],[39.927,1],[40.844,1],[41.749,0],[42.678,2],[43.584,0],[44.501,1],[44.954,0],[45.407,0],[46.324,1],[46.777,0],[47.229,0],[49.052,1],[50.887,0],[51.798,1],[52.251,0],[52.709,0],[53.621,1],[54.073,0],[54.532,1],[55.443,1],[55.896,0],[56.355,0],[57.272,2],[58.178,0],[59.095,1],[60,0],[60.918,1],[61.817,0],[62.729,0],[63.181,1],[63.64,1],[64.551,2],[65.445,0]],
  },
];
const SONG_KEY = "weaveon-drum-song";
let song = SONGS[0];
let SONG = song.seconds;
let BPM = song.bpm;
let BEAT = 60 / BPM;
/** 곡이 잦아들기 전 마지막 박. */
let LAST_BEAT = song.endAt / BEAT - 1;
/** 이 박부터 끝까지는 음표 없이 마음껏 치는 연타 구간. */
let ROLL_BEAT = song.rollAt / BEAT;
/** 곡을 고른다(대기 화면의 곡 버튼). 기기에 기억해 다음에도 그 곡으로 시작한다. */
export function pickSong(i: number): void {
  song = SONGS[i] ?? SONGS[0];
  SONG = song.seconds;
  BPM = song.bpm;
  BEAT = 60 / BPM;
  LAST_BEAT = song.endAt / BEAT - 1;
  ROLL_BEAT = song.rollAt / BEAT;
  try {
    localStorage.setItem(SONG_KEY, String(SONGS.indexOf(song)));
  } catch {
    // 저장 못 해도 이번 판은 고른 곡으로 간다
  }
}
export function songIndex(): number {
  return SONGS.indexOf(song);
}
if (typeof localStorage !== "undefined") {
  try {
    pickSong(Number(localStorage.getItem(SONG_KEY) ?? 0));
  } catch {
    // 기억해 둔 곡을 못 읽으면 첫 곡
  }
}
const ROLL_POINTS = 150;
/** 음표가 줄 끝에서 판정 원까지 오는 시간(초). */
const LEAD = 2.3;
/** 판정 폭(초). 웹캠은 손이 100ms쯤 늦게 보여서 일반 리듬게임(±20~50ms)보다 넉넉하다. */
// 약한 PC는 인식이 띄엄띄엄이라 치는 순간이 최대 0.15초쯤 흔들린다: 판정을 넓힌다
const PERFECT_W = slow(0.12, 0.18);
const GOOD_W = slow(0.26, 0.38);
/** 웹캠·인식이 늦는 만큼(초). 현장 카메라·TV 스피커에서 박자가 밀리면 주소에 ?lag=250 처럼(천분의 1초, 0~600) 붙여 맞춘다. */
const lagMs = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("lag");
const LAG =
  lagMs !== null && lagMs !== "" && Number(lagMs) >= 0 && Number(lagMs) <= 600
    ? Number(lagMs) / 1000
    : slow(0.06, 0.18);
/** 내려치는 줄(무대 높이 비율)과 최소 속도(초당 무대 높이). 어깨가 0.63이라 가슴 높이다. */
const LINE = 0.72;
const STRIKE_SPEED = slow(0.5, 0.35);
const FEVER_AT = 10;
/** 고수 모드(11/19 대표님: 한두 판 하면 너무 쉽다). 이 콤보가 되면 음표 사이사이(음악의 2·4박)에 덤 음표가 끼어 두 배로 촘촘해지고,
 * 이만큼 연달아 놓치면 다시 보통으로 돌아온다. 처음 하는 아이는 보통으로 끝까지 가고, 잘 치는 사람만 어려워진다. */
const HARD_AT = 12;
const HARD_OFF_MISSES = 3;

const LANE_COLOR = ["#f16e60", "#559fdc"];
const LANE_TONE: Tone[] = ["pink", "gold"];
const LANE_MARK = ["왼", "오"];
const LANE_SOUND = ["쿵!", "둥!"];
const FONT = `"Gowun Batang", serif`;

type Note = {
  lane: Lane;
  both?: boolean;
  at: number;
  /** off = 고수 모드에서만 켜지는 덤 음표가 아직 꺼져 있다(그리지도 판정하지도 않는다). */
  state: "wait" | "perfect" | "good" | "miss" | "off";
  /** 고수 모드의 덤 음표(음악의 2·4박 자리). */
  extra?: boolean;
  sec: number;
};

const SECTIONS = ["첫 장단", "둘째 장단", "셋째 장단", "피날레"];

function sectionOf(beat: number): number {
  return Math.min(SECTIONS.length - 1, Math.floor((beat / (LAST_BEAT + 1)) * SECTIONS.length));
}

export class RhythmMode implements Mode {
  // 연타가 끝나고(55박 = 40초) 2초 뒤에 판을 끝낸다. 예전에는 곡 끝(45.6초)까지 기다려, 칠 것이 없는 6초가 "막판 2배!" 글자와 함께 흘렀다
  get seconds(): number {
    return Math.ceil((LAST_BEAT + 1) * BEAT + 3);
  }
  hint = "손을 들었다가 점선 아래로 내려쳐요";
  tip = "빨강 '왼'은 왼쪽, 파랑 '오'는 오른쪽에서 내려쳐요";
  // 음표 57개 + 끝 연타. 모두 맞히고 연타 24번이면 42k(막판 2배 포함).
  // 새 곡 둘은 음표가 41~44개(예전 57개)라 등급 기준을 그만큼 낮췄다
  grades: [number, number, number] = [20000, 10000, 4000];
  music = null;
  get track(): string {
    return song.track;
  }
  /** 막판 2배는 예전과 같이 시작 30초 뒤부터(판이 43초로 줄어 17 → 13). */
  rushAt = 13;
  private W = 1400;
  private H = 860;
  private notes: Note[] = [];
  private t0 = 0;
  private started = false;
  private now = 0;
  /** 그리기용 시계(smoothClock). 판정은 now. */
  private view = 0;
  private perfect = 0;
  private good = 0;
  private miss = 0;
  private combo = 0;
  private maxCombo = 0;
  private strikes = new StrikeDetector();
  private taps: number[] = [];
  private flash = [0, 0];
  /** 판정 원 고리: 맞히면 터진다. */
  private ring: { t: number; tone: Tone }[] = [];
  private end = 0;
  /** 무대 밝기 0(밤)~1(대낮). 콤보를 따라간다. */
  private glow = 0;
  private missT = 0;
  private roll = 0;
  private rollOn = false;
  /** 고수 모드인가, 연달아 놓친 수. */
  private hard = false;
  private missRun = 0;

  reset(W: number, H: number): void {
    this.W = W;
    this.H = H;
    this.notes = [];
    this.started = false;
    this.perfect = 0;
    this.good = 0;
    this.miss = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.strikes.reset();
    this.taps = [];
    this.flash = [0, 0];
    this.ring = [];
    this.glow = 0;
    this.missT = 0;
    this.roll = 0;
    this.rollOn = false;
    this.hint = "손을 들었다가 점선 아래로 내려쳐요";
  }

  begin(fx: Fx): void {
    fx.sound.unlock();
    this.t0 = fx.sound.now() + 0.25;
    if (!fx.sound.playTrack(this.t0))
      fx.sound.startMusic(BPM, this.t0, Math.ceil(SONG / BEAT / 4));
    // 손 2(양손)는 왼·오 음표 둘로 편다
    this.notes = song.chart.flatMap(([sec, hand]) =>
      (hand === 2 ? ([0, 1] as Lane[]) : [hand as Lane]).map((lane) => ({
        lane,
        both: hand === 2 || undefined,
        at: this.t0 + sec,
        state: "wait" as const,
        sec: sectionOf(sec / BEAT),
      })),
    );
    // 덤 음표: 한 박 간격으로 이어진 두 음표의 한가운데에, 앞 음표와 반대 손으로. 꺼 둔 채 넣어 두고 고수 모드일 때만 켠다
    const base = [...new Set(this.notes.map((n) => n.at))].sort((a, b) => a - b);
    const extras: Note[] = [];
    for (let i = 0; i + 1 < base.length; i++) {
      const gap = base[i + 1] - base[i];
      if (gap < BEAT * 0.75 || gap > BEAT * 1.3) continue; // 이미 반 박이 끼어 있거나, 쉬는 자리
      const prev = this.notes.find((n) => n.at === base[i])!;
      const mid = base[i] + gap / 2;
      extras.push({ lane: prev.both ? 1 : ((1 - prev.lane) as Lane), at: mid, state: "off", extra: true, sec: sectionOf((mid - this.t0) / BEAT) });
    }
    this.notes = [...this.notes, ...extras].sort((a, b) => a.at - b.at);
    this.hard = false;
    this.missRun = 0;
    this.end = this.t0 + (LAST_BEAT + 1) * BEAT + 2;
    this.started = true;
    this.strikes.reset();
    this.combo = 0;
  }

  done(): boolean {
    return this.started && this.now > this.end + 0.3;
  }

  private fever(): boolean {
    return this.combo >= FEVER_AT;
  }

  private rolling(at: number): boolean {
    return (
      this.started &&
      at >= this.t0 + ROLL_BEAT * BEAT &&
      at <= this.t0 + (LAST_BEAT + 1) * BEAT
    );
  }

  /** 터치: 누른 쪽 북을 바로 친다. */
  tap(x: number): void {
    this.taps.push(x);
  }

  update(dt: number, t: number, hands: Hand[], fx: Fx): void {
    this.flash = this.flash.map((f) => Math.max(0, f - dt * 5));
    for (const r of this.ring) r.t += dt;
    this.ring = this.ring.filter((r) => r.t < 0.35);
    this.missT = Math.max(0, this.missT - dt);
    this.glow += (Math.min(1, this.combo / FEVER_AT) - this.glow) * Math.min(1, dt * 4);
    // 귀에 들리는 시각으로 판정한다(오디오 시계는 스피커보다 앞서 간다)
    this.now = this.started ? fx.sound.now() - fx.sound.latency() : t;
    const now = this.now;
    this.view = this.started ? smoothClock(this.view, now, dt) : now;
    if (!this.rollOn && this.rolling(now)) {
      this.rollOn = true;
      fx.stamp("마음껏 두드려요!", this.W / 2, this.H * 0.44, "gold");
      fx.shake(0.3);
    }
    // 대기 화면: 시범용 박자를 계속 만든다
    if (!this.started && !this.notes.some((n) => n.at > now)) {
      const seq: Lane[] = [0, 1, 0, 1, 1, 0, 0, 1];
      this.notes = seq.map((lane, i) => ({ lane, at: now + 1.2 + i * 0.8, state: "wait", sec: 0 }));
    }

    hands.forEach((h, i) => {
      const hit = this.strikes.update(
        i,
        h.on ? { x: h.x / this.W, y: h.y / this.H } : null,
        now * 1000,
        LINE,
        STRIKE_SPEED,
      );
      // 시범 손은 늦게 보일 일이 없다
      if (hit) this.strike(hit.lane, hit.timeMs / 1000 - (h.ghost ? 0 : LAG), !h.ghost, fx);
    });
    for (const x of this.taps) this.strike(x < this.W / 2 ? 0 : 1, now, true, fx);
    this.taps = [];

    // 고수 모드 켜고 끄기. 덤 음표는 줄 끝에서 들어올 때만 켠다(이미 지나가는 자리에 갑자기 생기지 않게)
    if (this.started && !this.hard && this.combo >= HARD_AT) {
      this.hard = true;
      fx.stamp("고수 모드! 음표가 늘어나요", this.W / 2, this.H * 0.44, "gold");
    } else if (this.hard && this.missRun >= HARD_OFF_MISSES) this.hard = false;
    if (this.hard)
      for (const n of this.notes) {
        const left = n.at - now;
        if (n.state === "off" && left > LEAD - 0.15 && left < LEAD + 0.6) n.state = "wait";
      }
    for (const n of this.notes) {
      if (n.state === "wait" && now - (this.started ? LAG : 0) - n.at > GOOD_W) {
        n.state = "miss";
        this.miss++;
        this.missRun++;
        this.combo = 0;
        this.missT = 0.35;
        fx.score(0, this.targetX(), this.railY() + this.R() * 3, "놓침", "white");
      }
    }
    // 런웨이 피버: 하늘에 불꽃
    if (this.fever() && Math.random() < dt * 2.2) {
      const tones: Tone[] = ["gold", "pink", "mint", "white"];
      fx.burst(
        this.W * (0.15 + Math.random() * 0.7),
        this.H * (0.35 + Math.random() * 0.2),
        22,
        tones[(Math.random() * 4) | 0],
      );
    }
    const next = this.notes.find((n) => n.state === "wait");
    this.hint = this.rolling(now)
      ? "마음껏 두드려요! 칠수록 점수!"
      : this.fever()
      ? `런웨이 피버! ${this.combo}콤보 · 점수 1.5배`
      : this.combo >= 4
        ? `${this.combo}콤보! 계속 박자를 타요`
        : next
          ? `${next.lane ? "오른쪽" : "왼쪽"}에서 손을 들었다가 내려쳐요`
          : "멋진 무대였어요!";
  }

  private strike(lane: Lane, at: number, loud: boolean, fx: Fx): void {
    this.flash[lane] = 1;
    if (loud) fx.sound.play(lane ? "drum-right" : "drum-left");
    fx.burst(this.W * (lane ? 0.62 : 0.38), this.H * LINE, 5, LANE_TONE[lane]);
    if (this.rolling(at)) {
      this.roll++;
      fx.score(ROLL_POINTS, this.W * (lane ? 0.62 : 0.38), this.H * LINE);
      fx.burst(this.W / 2, this.H * LINE, 10, "gold");
      fx.shake(0.1);
      return;
    }
    let n: Note | null = null;
    for (const x of this.notes) {
      if (x.lane !== lane || x.state !== "wait" || Math.abs(x.at - at) > GOOD_W) continue;
      if (!n || Math.abs(x.at - at) < Math.abs(n.at - at)) n = x;
    }
    if (!n) return;
    const kind = Math.abs(n.at - at) <= PERFECT_W ? "perfect" : "good";
    n.state = kind;
    this.missRun = 0;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    let pts = (kind === "perfect" ? 300 : 150) + Math.min(20, this.combo) * 10;
    if (this.fever()) pts = Math.round(pts * 1.5);
    const x = this.targetX();
    const y = this.railY();
    if (kind === "perfect") {
      this.perfect++;
      fx.shake(0.12);
    } else this.good++;
    fx.score(pts, x, y);
    fx.burst(x, y, kind === "perfect" ? 14 : 6, LANE_TONE[lane]);
    // 양손 음표는 두 손이 다 맞아야 '쾅!'
    const hit = n;
    const pair =
      hit.both &&
      this.notes.some((m) => m !== hit && m.at === hit.at && m.state !== "wait" && m.state !== "miss");
    if (pair) {
      fx.stamp("쾅!", this.W / 2, this.H * 0.44, "gold");
      fx.burst(this.W / 2, this.H * LINE, 30, "gold");
      fx.shake(0.4);
    } else
      fx.stamp(
        kind === "perfect" ? "퍼펙트!" : "좋아요",
        x + this.R() * 1.5,
        y + this.R() * 3,
        kind === "perfect" ? "gold" : "white",
      );
    this.ring.push({ t: 0, tone: LANE_TONE[lane] });
    if (this.combo === FEVER_AT) {
      fx.score(0, this.W / 2, this.H * 0.42, "런웨이 피버!", "gold");
      fx.say("runway-fever", true);
    } else if (this.combo % 8 === 0) fx.say(this.combo % 16 === 0 ? "perfect" : "great");
  }

  /** 음표 반지름. */
  private R(): number {
    return Math.min(this.W, this.H) * 0.055;
  }

  private railY(): number {
    return this.H * 0.2;
  }

  private targetX(): number {
    return this.W * 0.14;
  }

  draw(ctx: CanvasRenderingContext2D, t: number, hands: Hand[], _phase: Phase): void {
    const W = this.W;
    const H = this.H;
    const now = this.view || t;
    const beatPhase = this.started ? ((((now - this.t0) / BEAT) % 1) + 1) % 1 : (t / 0.8) % 1;
    const pump = Math.pow(1 - beatPhase, 3);
    const lineY = H * LINE;

    // 약한 PC: 숲 그림을 화면 크기로 한 번만 늘려 두고 찍는다(매 장면 큰 그림을 다시 늘리던 것)
    const paintForest = (c: CanvasRenderingContext2D) => {
      if (!drawArt(c, W, H, "mongle-forest", 0.08)) {
        c.fillStyle = "#58b6e8";
        c.fillRect(0, 0, W, H);
      }
    };
    if (!stampLayer(ctx, `forest|${W}x${H}|${artImage("mongle-forest") ? 1 : 0}`, 0, 0, W, H, paintForest)) paintForest(ctx);
    drawNight(ctx, W, H, t, pump, this.glow, this.fever());

    // 두 손 자리: 몸 가운데를 기준으로 왼쪽 빨강, 오른쪽 파랑
    [0, 1].forEach((lane) => {
      const g = ctx.createLinearGradient(0, lineY, 0, H);
      g.addColorStop(0, `${LANE_COLOR[lane]}${this.flash[lane] > 0.2 ? "aa" : "55"}`);
      g.addColorStop(1, `${LANE_COLOR[lane]}11`);
      ctx.fillStyle = g;
      ctx.fillRect(lane ? W / 2 : 0, lineY, W / 2, H - lineY);
    });

    drawDrummer(ctx, W, H, lineY, pump, this.flash, this.fever(), this.missT, t);

    // 내려치는 줄
    ctx.save();
    ctx.setLineDash([26, 18]);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(60,36,20,0.55)";
    ctx.beginPath();
    ctx.moveTo(0, lineY + 3);
    ctx.lineTo(W, lineY + 3);
    ctx.stroke();
    ctx.strokeStyle = "#fff9e3";
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(W, lineY);
    ctx.stroke();
    ctx.restore();

    // 친 쪽에서 소리 글자가 튄다
    this.flash.forEach((f, lane) => {
      if (f <= 0) return;
      outlined(
        ctx,
        LANE_SOUND[lane],
        W * (lane ? 0.8 : 0.2),
        lineY - H * 0.08 - (1 - f) * 30,
        H * 0.12,
        LANE_COLOR[lane],
        f,
      );
    });

    this.drawRail(ctx, now, t, pump);

    // 콤보·연타 수: 왼쪽에 크게, 박자에 뛴다
    const rolling = this.rolling(now);
    const count = rolling ? this.roll : this.combo;
    if (count >= 3) {
      const x = W * 0.17;
      outlined(ctx, `${count}`, x, H * 0.44, H * (0.14 + pump * 0.02), this.fever() ? "#ffd34d" : "#ffffff");
      outlined(ctx, rolling ? "연타" : "콤보", x, H * 0.54, H * 0.05, "#ffffff");
    }

    // 첫 마디: 곡에 맞춰 하나·둘·셋·넷 세기
    const beatNo = Math.floor((now - this.t0) / BEAT);
    if (this.started && beatNo >= 0 && beatNo < 4) {
      const k = ((now - this.t0) / BEAT) % 1;
      outlined(
        ctx,
        ["하나", "둘", "셋", "넷"][beatNo],
        W / 2,
        H * 0.44,
        H * (0.13 + (1 - k) * 0.04),
        "#ffd34d",
      );
    }

    for (const h of hands) drawStick(ctx, h, H, W, lineY);
  }

  private drawRail(ctx: CanvasRenderingContext2D, now: number, t: number, pump: number): void {
    const W = this.W;
    const r = this.R();
    const y = this.railY();
    const tx = this.targetX();
    const top = y - r * 1.9;
    const lead = LEAD;
    const x0 = W * 0.012;
    ctx.save();
    roundRect(ctx, x0, top, W - x0 * 2, r * 3.8, r * 0.9);
    ctx.fillStyle = "rgba(10,13,20,0.88)";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = this.fever() ? TONE.gold : "#8ea0b4";
    ctx.stroke();
    ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(tx, y - r * 0.9, W, r * 1.8);
    const xAt = (at: number) => tx + ((at - now) / lead) * (W - tx - r * 1.2);
    if (this.started) {
      // 박자 눈금: 음표 사이가 몇 박인지 눈으로 읽힌다
      const first = Math.ceil((now - this.t0) / BEAT);
      for (let b = Math.max(0, first); b <= LAST_BEAT; b++) {
        const x = xAt(this.t0 + b * BEAT);
        if (x > W) break;
        ctx.fillStyle = b % 4 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.34)";
        ctx.fillRect(x - 1.5, y - r * 0.9, 3, r * 1.8);
      }
      // 연타 구간: 금빛 긴 띠
      const rx = xAt(this.t0 + ROLL_BEAT * BEAT);
      const re = xAt(this.t0 + (LAST_BEAT + 1) * BEAT);
      if (rx < W && re > tx) {
        const from = Math.max(tx, rx);
        roundRect(ctx, from, y - r * 0.8, re - from, r * 1.6, r * 0.8);
        ctx.fillStyle = "#ffd34d";
        ctx.fill();
        ctx.fillStyle = "#3a2410";
        ctx.font = `800 ${Math.round(r * 0.95)}px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("연타! 연타! 연타!", from + r * 0.6, y + 2);
      }
    }
    const beat = this.flash[0] || this.flash[1];
    ctx.lineWidth = 7;
    ctx.fillStyle = "rgba(255, 136, 34,0.16)";
    ctx.strokeStyle = TONE.gold;
    ctx.beginPath();
    ctx.arc(tx, y, r * (1.35 + beat * 0.2 + pump * 0.05), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(tx, y, r * 1.05, 0, Math.PI * 2);
    ctx.stroke();
    // 가까운 음표가 위에 오도록 뒤에서부터
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (n.state !== "wait") continue;
      const left = n.at - now;
      if (left > lead + 0.2) continue;
      const x = xAt(n.at);
      if (x <= -r) continue;
      if (n.both) drawBothNote(ctx, x, y, r);
      else drawNote(ctx, x, y, r, n.lane);
    }
    ctx.restore();
    // 맞힌 자리에서 고리가 터진다
    for (const g of this.ring) {
      const k = g.t / 0.35;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = TONE[g.tone];
      ctx.lineWidth = 12 * (1 - k) + 2;
      ctx.beginPath();
      ctx.arc(tx, y, r * (1.2 + k * 1.2), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      drawFlare(ctx, tx, y, r * (2.4 - k), g.tone, 1 - k, t);
    }
  }

  stats(): Stat[] {
    return [
      { label: "퍼펙트", value: `${this.perfect}` },
      { label: "좋아요", value: `${this.good}` },
      { label: "최고 콤보", value: `${this.maxCombo}` },
      { label: "연타", value: `${this.roll}번` },
    ];
  }

  private secRatio(i: number): { hit: number; all: number } {
    const ns = this.notes.filter((n) => n.sec === i && n.state !== "off");
    return {
      hit: ns.filter((n) => n.state === "perfect" || n.state === "good").length,
      all: ns.length,
    };
  }

  queue(): QueueItem[] {
    if (!this.started)
      return SECTIONS.map((label, i) => ({ label, state: i === 0 ? "now" : "next" }));
    const beat = (this.now - this.t0) / BEAT;
    const cur = sectionOf(Math.max(0, beat));
    return SECTIONS.map((label, i) => {
      const r = this.secRatio(i);
      return {
        label,
        state: i < cur || (beat > LAST_BEAT + 1 && i === cur) ? "done" : i === cur ? "now" : "next",
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
            this.combo > 0 ? `${this.combo}콤보 · ${FEVER_AT}콤보면 피버` : "박자에 맞춰 내려쳐요",
        };
  }

  collection(): Item[] {
    return SECTIONS.map((label, i) => {
      const r = this.secRatio(i);
      const k = r.all ? r.hit / r.all : 0;
      const stars = k >= 0.9 ? 3 : k >= 0.6 ? 2 : k > 0 ? 1 : 0;
      return {
        label,
        color: ["#ffd6ea", "#d8ccff", "#c4f4ea", "#fff0d2"][i],
        note: "★".repeat(stars) + "☆".repeat(3 - stars),
      };
    });
  }

  demo(t: number): DemoHand[] {
    // 손마다 다음 음표에 맞춰 들었다가 줄을 지나 내려친다
    const now = this.now || t;
    return [0, 1].map((lane) => {
      const n = this.notes.find((x) => x.lane === lane && x.state === "wait" && x.at > now - 0.06);
      const left = n ? n.at - now : 9;
      return {
        x: this.W * (lane ? 0.68 : 0.32),
        y: this.H * (LINE - 0.26 * Math.min(1, left / 0.3)),
      };
    });
  }

  target(): DemoHand | null {
    return null;
  }
}

function outlined(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha = 1,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${Math.round(size)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = "rgba(20,14,30,0.92)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  lane: Lane,
): void {
  ctx.fillStyle = LANE_COLOR[lane];
  ctx.strokeStyle = "#614e40";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.4, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(r * 1.1)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(LANE_MARK[lane], x, y + 2);
}

/** 금빛 '양손' 음표: 두 손을 같이 내려친다. */
function drawBothNote(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const R = r * 1.2;
  ctx.fillStyle = "#ffd34d";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#3a2410";
  ctx.font = `800 ${Math.round(R * 0.72)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("양손", x, y + 2);
}

/** 밤 축제: 콤보가 없으면 어두운 무대, 쌓일수록 낮처럼 밝아진다. 조명은 박자에 뛴다. */
function drawNight(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  pump: number,
  glow: number,
  fever: boolean,
): void {
  ctx.fillStyle = `rgba(7,9,18,${0.72 * (1 - glow * 0.8)})`;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // 약한 PC: 빛줄기(화면 전체를 더하기로 여러 번 칠한다)는 뺀다
  const beams = SLOW_PC ? 0 : fever ? 6 : 4;
  for (let i = 0; i < beams; i++) {
    const ox = W * ((i + 0.5) / beams);
    const tipX = W / 2 + Math.sin(t * (0.7 + i * 0.17) + i * 1.7) * W * 0.34;
    const spread = W * 0.1;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    const a = 0.1 + pump * 0.16;
    const c = fever ? "255,211,77" : i % 2 ? "255, 136, 34" : "255,184,220";
    g.addColorStop(0, `rgba(${c},${a})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox - 12, 0);
    ctx.lineTo(ox + 12, 0);
    ctx.lineTo(tipX + spread, H);
    ctx.lineTo(tipX - spread, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** 몽글이와 큰 북. 북 가죽이 내려치는 줄에 걸린다. */
function drawDrummer(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  lineY: number,
  pump: number,
  flash: number[],
  fever: boolean,
  missT: number,
  t: number,
): void {
  const cx = W / 2;
  const S = Math.min(W, H) * 0.56;
  const hit = Math.max(flash[0], flash[1]);
  const hero = artImage("mongle");
  if (hero) {
    const hs = S * 0.92;
    // 친 쪽으로 기울고, 놓치면 움찔한다
    const lean = (flash[1] - flash[0]) * 0.06 + Math.sin(t * 40) * missT * 0.12;
    ctx.save();
    ctx.translate(cx, lineY - S * 0.1 - pump * (fever ? 26 : 8) + hit * 6);
    ctx.rotate(lean);
    ctx.drawImage(hero, -hs / 2, -hs * 0.8, hs, hs);
    ctx.restore();
  }
  const drum = artImage("mongle-drum");
  if (!drum) return;
  const top = lineY - S * 0.27;
  ctx.save();
  // 맞으면 가죽 쪽으로 살짝 눌린다
  ctx.translate(cx, top + S);
  ctx.scale(1 + hit * 0.015, 1 - hit * 0.025);
  ctx.drawImage(drum, -S / 2, -S, S, S);
  ctx.restore();
  // 친 쪽 가죽이 번쩍
  flash.forEach((f, lane) => {
    if (f <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(lane ? cx : cx - S, top, S, S);
    ctx.clip();
    ctx.globalAlpha = f * 0.7;
    ctx.fillStyle = LANE_COLOR[lane];
    ctx.beginPath();
    ctx.ellipse(cx, top + S * 0.27, S * 0.41, S * 0.23, 0, 0, Math.PI * 2);
    ctx.fill();
    // 가죽에 번지는 물결
    const k = 1 - f;
    ctx.globalAlpha = f;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(cx + (lane ? 1 : -1) * S * 0.2, top + S * 0.27, S * 0.3 * k, S * 0.16 * k, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

/** 손 = 북채. 손이 더 내려가도 채는 북 가죽 위에서 멈추고, 북 폭 밖으로 나가지 않는다. */
function drawStick(
  ctx: CanvasRenderingContext2D,
  h: Hand,
  H: number,
  W: number,
  skinY: number,
): void {
  if (!h.on) return;
  const left = h.x < W / 2;
  const r = H * 0.035;
  const half = Math.min(W, H) * 0.56 * 0.42;
  const x = Math.max(W / 2 - half, Math.min(W / 2 + half, h.x));
  const y = Math.min(h.y, skinY);
  drawHandGlow(ctx, { ...h, x, y }, r * 2.6, left ? "pink" : "gold");
  ctx.save();
  ctx.globalAlpha = h.ghost ? 0.85 : 1;
  ctx.lineCap = "round";
  const sx = x + (left ? -1 : 1) * r * 2.2;
  const sy = y - r * 2.6;
  ctx.strokeStyle = "#65483c";
  ctx.lineWidth = r * 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  ctx.strokeStyle = "#f5ce83";
  ctx.lineWidth = r * 0.42;
  ctx.stroke();
  ctx.fillStyle = left ? LANE_COLOR[0] : LANE_COLOR[1];
  ctx.strokeStyle = "#fffdf4";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
