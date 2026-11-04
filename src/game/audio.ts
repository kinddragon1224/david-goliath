import { BEAT_BPM } from "./constants";

type SfxName =
  | "throw"
  | "hitSoft"
  | "hitShield"
  | "hitHead"
  | "stagger"
  | "tick"
  | "start"
  | "end"
  | "combo"
  | "freeze"
  | "ko"
  | "warn"
  | "fever"
  | "open"
  | "finish";

/** 전체 음량. 키오스크 스피커에서 잘 들리게 예전(0.22)보다 키웠다. */
const VOLUME = 0.42;

export type SoundState = "none" | "running" | "blocked";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;
  private beatTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beatStep = 0;
  /** 피버 타임에는 장단이 빨라진다. */
  private fast = false;

  setFast(on: boolean): void {
    this.fast = on;
  }

  unlock = (): void => {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : VOLUME;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  };

  setMuted(next: boolean): void {
    this.muted = next;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(next ? 0 : VOLUME, this.ctx.currentTime, 0.03);
    }
  }

  /** 브라우저가 소리를 막고 있으면 "blocked". 화면을 한 번 누르거나 키를 누르면 풀린다. */
  get state(): SoundState {
    if (!this.ctx) return "none";
    return this.ctx.state === "running" ? "running" : "blocked";
  }

  /** 운영자 화면의 소리 확인용. */
  test(): void {
    this.unlock();
    const was = this.muted;
    this.muted = false;
    this.play("start");
    this.play("hitHead");
    this.muted = was;
  }

  /** step: 콤보가 이어질수록 음이 올라간다. */
  play(name: SfxName, step = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    // 터치 없이 동작만으로 시작해 막혀 있었다면 다시 깨워 본다
    if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => {});
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (name) {
      case "throw":
        this.noiseSweep(t, 0.18, 900, 240, 0.35);
        break;
      case "hitSoft":
        this.don(t, 0.9);
        break;
      case "hitShield":
        this.ka(t, 0.7);
        this.clang(t);
        break;
      case "hitHead":
        this.don(t, 1);
        this.chime(t, 740, 0.4);
        this.chime(t + 0.06, 990, 0.3);
        break;
      case "stagger":
        this.chime(t, 520, 0.55);
        this.chime(t + 0.08, 780, 0.4);
        break;
      case "tick":
        this.chime(t, 880, 0.12);
        break;
      case "start":
        this.chime(t, 392, 0.2);
        this.chime(t + 0.1, 523, 0.24);
        break;
      case "end":
        this.chime(t, 523, 0.28);
        this.chime(t + 0.14, 392, 0.4);
        break;
      case "combo": {
        const up = 2 ** (Math.min(step, 8) / 8);
        this.chime(t, 660 * up, 0.18);
        this.chime(t + 0.05, 880 * up, 0.16);
        break;
      }
      case "open":
        this.chime(t, 1175, 0.22);
        this.chime(t + 0.07, 1568, 0.2);
        break;
      case "finish":
        // 마지막 일격: 쿵 한 번과 길게 울리는 쇳소리, 그 뒤 잠깐 조용해진다
        this.don(t, 1);
        this.clang(t);
        this.osc(1240, "triangle", t, 0.55, 0.22, 1100);
        break;
      case "ko":
        // 쿵 쿵 쿵 + 올라가는 팡파르
        this.don(t, 1);
        this.don(t + 0.16, 1);
        this.don(t + 0.32, 1);
        [523, 659, 784, 1047].forEach((f, i) => this.chime(t + 0.5 + i * 0.11, f, 0.45));
        this.chime(t + 0.95, 1319, 0.5);
        break;
      case "warn":
        this.osc(880, "square", t, 0.12, 0.16, 860);
        this.osc(880, "square", t + 0.2, 0.12, 0.16, 860);
        this.osc(880, "square", t + 0.4, 0.12, 0.16, 860);
        break;
      case "fever":
        [392, 523, 659, 784].forEach((f, i) => this.chime(t + i * 0.07, f, 0.35));
        this.don(t, 0.8);
        break;
      case "freeze":
        this.chime(t, 311, 0.35);
        this.chime(t + 0.08, 247, 0.4);
        break;
    }
  }

  /** 경기 중 배경 북 장단. 쿵 . 딱 . 쿵 쿵 딱 . */
  startBeat(): void {
    if (!this.ctx || this.beatTimer) return;
    this.nextBeat = this.ctx.currentTime + 0.05;
    this.beatStep = 0;
    const pattern = ["don", null, "ka", null, "don", "don", "ka", null] as const;
    const base = 60 / BEAT_BPM / 2;
    this.beatTimer = setInterval(() => {
      if (!this.ctx) return;
      while (this.nextBeat < this.ctx.currentTime + 0.12) {
        const hit = pattern[this.beatStep % pattern.length];
        if (!this.muted) {
          if (hit === "don") this.don(this.nextBeat, 0.32);
          else if (hit === "ka") this.ka(this.nextBeat, 0.22);
        }
        this.nextBeat += this.fast ? base * 0.7 : base;
        this.beatStep += 1;
      }
    }, 40);
  }

  stopBeat(): void {
    if (this.beatTimer) clearInterval(this.beatTimer);
    this.beatTimer = null;
  }

  /** 북 가죽: 낮게 떨어지는 사인. */
  private don(t: number, gain: number): void {
    this.osc(170, "sine", t, 0.28, gain * 0.9, 62);
    this.osc(340, "triangle", t, 0.06, gain * 0.25, 160);
  }

  /** 북 테두리: 짧은 고음 딱. */
  private ka(t: number, gain: number): void {
    this.osc(1900, "square", t, 0.04, gain * 0.18, 1200);
    this.noiseSweep(t, 0.05, 3200, 2400, gain * 0.5);
  }

  private osc(
    freq: number,
    type: OscillatorType,
    t: number,
    dur: number,
    gain: number,
    freqEnd?: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  private thump(t: number, freq: number, gain: number): void {
    this.osc(freq, "sine", t, 0.22, gain, freq * 0.4);
  }

  private chime(t: number, freq: number, gain: number): void {
    this.osc(freq, "triangle", t, 0.35, gain, freq * 0.92);
  }

  private clang(t: number): void {
    this.osc(620, "square", t, 0.12, 0.12, 280);
    this.osc(930, "triangle", t, 0.18, 0.1, 400);
  }

  private noiseSweep(t: number, dur: number, from: number, to: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
}
