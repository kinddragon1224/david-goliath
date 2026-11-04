/** 패션 체험 효과음과 음악. 몽글 드럼 곡만 파일이고 나머지는 Web Audio로 만든다(오프라인·TV 대응). */

export type Sfx =
  | "tick"
  | "start"
  | "good"
  | "perfect"
  | "miss"
  | "complete"
  | "snip"
  | "stitch"
  | "steam"
  | "end"
  | "shutter"
  | "drum-left"
  | "drum-right";

/** MC 음성(일레븐랩스로 미리 만든 파일, public/voice). 인터넷 없이 나온다. */
export const LINES = [
  "hello",
  "start",
  "perfect",
  "great",
  "complete",
  "ten",
  "end",
  "iron-pair",
  "steam",
  "scissors-pair",
  "clean-cut",
  "gold-fever",
  "runway-fever",
  "finale",
  "three",
  "two",
  "one",
  "shot",
  "grade0",
  "grade1",
  "grade2",
  "grade3",
] as const;
export type Line = (typeof LINES)[number];

const VOLUME = 0.45;
/** 음악·효과음 위로 또렷하게. */
const VOICE_GAIN = 1.8;
/** 몽글 드럼 곡 크기. 북소리가 곡 위로 들리는 정도는 현장 스피커에서 맞춘다. */
const TRACK_GAIN = 1.3;

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class FashionSound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = false;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private steamUntil = 0;
  private voices = new Map<Line, AudioBuffer>();
  private voice: AudioBufferSourceNode | null = null;
  private voiceUntil = 0;
  private track: AudioBuffer | null = null;
  private trackSrc: AudioBufferSourceNode | null = null;

  unlock = (): void => {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : VOLUME;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.loadVoices();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  };

  /** MC 음성을 미리 받아 풀어 둔다. 없는 파일은 조용히 건너뛴다. */
  private loadVoices(): void {
    for (const line of LINES) {
      fetch(`/voice/${line}.mp3`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => this.ctx!.decodeAudioData(b))
        .then((buf) => this.voices.set(line, buf))
        .catch(() => {});
    }
  }

  /** MC 한마디. 말하는 중이면 넘어가고, urgent면 끊고 말한다. */
  say(line: Line, urgent = false): void {
    const ctx = this.ctx;
    const buf = this.voices.get(line);
    if (!ctx || !this.master || !buf || ctx.state !== "running") return;
    const now = ctx.currentTime;
    if (!urgent && now < this.voiceUntil) return;
    this.voice?.stop();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = VOICE_GAIN;
    src.connect(g).connect(this.master);
    src.start();
    this.voice = src;
    this.voiceUntil = now + buf.duration;
  }

  get running(): boolean {
    return this.ctx?.state === "running";
  }

  /** 오디오 시계(초). 리듬 판정은 이 시계를 쓴다. */
  now(): number {
    return this.ctx && this.ctx.state === "running"
      ? this.ctx.currentTime
      : performance.now() / 1000;
  }

  /** 오디오 시계가 스피커보다 앞서 가는 만큼(초). */
  latency(): number {
    return this.running ? (this.ctx?.baseLatency ?? 0) + (this.ctx?.outputLatency ?? 0) : 0;
  }

  /** 곡을 받아 풀어 둔다. 못 받으면 playTrack이 false를 준다. */
  loadTrack(url: string): void {
    if (this.track) return;
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => this.ctx!.decodeAudioData(b))
      .then((buf) => (this.track = buf))
      .catch(() => {});
  }

  /** 풀어 둔 곡을 at(오디오 시계 초)부터 튼다. 틀었으면 true. */
  playTrack(at: number): boolean {
    this.stopMusic();
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.track || !this.running) return false;
    const src = ctx.createBufferSource();
    src.buffer = this.track;
    const g = ctx.createGain();
    g.gain.value = TRACK_GAIN;
    src.connect(g).connect(this.master);
    src.start(at);
    this.trackSrc = src;
    return true;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(m ? 0 : VOLUME, this.ctx.currentTime, 0.03);
  }

  private tone(
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private hiss(at: number, dur: number, gain: number, freq: number, q = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.005;
    switch (name) {
      case "tick":
        this.tone(1320, t, 0.08, "sine", 0.25);
        break;
      case "start":
        [72, 76, 79, 84].forEach((n, i) =>
          this.tone(NOTE(n), t + i * 0.07, 0.25, "triangle", 0.25),
        );
        break;
      case "good":
        this.tone(NOTE(81), t, 0.12, "triangle", 0.2);
        break;
      case "perfect":
        this.tone(NOTE(84), t, 0.1, "triangle", 0.22);
        this.tone(NOTE(91), t + 0.05, 0.16, "sine", 0.18);
        this.tone(95, t, 0.18, "sine", 0.45, 45);
        break;
      case "miss":
        this.tone(220, t, 0.18, "sine", 0.12, 150);
        break;
      case "complete":
        [76, 79, 83, 88, 91].forEach((n, i) => this.tone(NOTE(n), t + i * 0.06, 0.4, "sine", 0.2));
        this.hiss(t, 0.6, 0.05, 8000, 0.7);
        this.tone(110, t, 0.3, "sine", 0.55, 40);
        break;
      case "snip":
        this.hiss(t, 0.05, 0.25, 4500, 3);
        this.tone(2600, t, 0.03, "square", 0.04);
        break;
      case "stitch":
        this.tone(NOTE(88), t, 0.07, "sine", 0.2);
        this.hiss(t, 0.04, 0.1, 6000, 4);
        break;
      case "steam":
        if (t < this.steamUntil) return;
        this.steamUntil = t + 0.35;
        this.hiss(t, 0.4, 0.07, 3000, 0.6);
        break;
      case "end":
        [84, 79, 76, 72].forEach((n, i) => this.tone(NOTE(n), t + i * 0.09, 0.3, "triangle", 0.22));
        break;
      case "shutter":
        // 찰-칵: 짧은 두 번의 기계음 + 반짝 화음
        this.hiss(t, 0.04, 0.4, 3500, 2);
        this.tone(1800, t, 0.02, "square", 0.08);
        this.hiss(t + 0.09, 0.06, 0.45, 2500, 2);
        this.tone(1200, t + 0.09, 0.03, "square", 0.08);
        [84, 88, 91, 96].forEach((n, i) =>
          this.tone(NOTE(n), t + 0.18 + i * 0.05, 0.5, "sine", 0.16),
        );
        break;
      case "drum-left":
      case "drum-right": {
        // 같은 북 가죽을 치되 오른손이 조금 높다: 몸통 + 배음 + 가죽 때리는 소리
        const pitch = name === "drum-left" ? 128 : 150;
        this.tone(pitch, t, 0.34, "sine", 0.6, pitch * 0.42);
        this.tone(pitch * 1.58, t, 0.17, "sine", 0.14);
        this.hiss(t, 0.075, 0.22, 1050, 0.7);
        break;
      }
    }
  }

  /** 합성 음악. startAt(오디오 시계 초)부터 bars 마디. 4/4, 16분음표 단위로 미리 깔아 둔다. */
  startMusic(bpm: number, startAt: number, bars: number, style: "dance" | "lofi" = "dance"): void {
    this.stopMusic();
    const ctx = this.ctx;
    if (!ctx) return;
    const step = 60 / bpm / 4;
    const total = bars * 16;
    let i = 0;
    // Am - F - C - G
    const roots = [57, 53, 60, 55];
    const chords = [
      [69, 72, 76],
      [65, 69, 72],
      [67, 72, 76],
      [67, 71, 74],
    ];
    const tickFn = () => {
      if (!this.ctx) return;
      const horizon = this.ctx.currentTime + 0.15;
      while (i < total) {
        const at = startAt + i * step;
        if (at > horizon) break;
        if (at >= this.ctx.currentTime - 0.02) {
          if (style === "lofi") this.lofiStep(i, at, step);
          else this.musicStep(i, at, step, roots, chords, bars);
        }
        i++;
      }
      if (i >= total) this.stopMusic();
    };
    tickFn();
    this.musicTimer = setInterval(tickFn, 25);
  }

  /** 다림질·가위질·바느질 배경: 잔잔한 로파이. 효과음을 가리지 않게 작게. */
  private lofiStep(i: number, at: number, step: number): void {
    const bar = Math.floor(i / 16);
    const s = i % 16;
    // Fmaj7 - Em7 - Dm7 - Cmaj7
    const chords = [
      [65, 69, 72, 76],
      [64, 67, 71, 74],
      [62, 65, 69, 72],
      [60, 64, 67, 71],
    ];
    const ch = chords[bar % 4];
    if (s === 0 || s === 10) this.tone(110, at, 0.2, "sine", 0.32, 50);
    if (s === 4 || s === 12) this.hiss(at, 0.08, 0.08, 2200, 1);
    if (s % 2 === 0) this.hiss(at, 0.02, 0.03, 9000, 2);
    if (s === 0)
      ch.forEach((c, k) => this.tone(NOTE(c - 12), at + k * 0.02, step * 14, "sine", 0.045));
    if (s === 0 || s === 8) this.tone(NOTE(ch[0] - 24), at, step * 6, "triangle", 0.12);
    // 가끔 반짝이는 멜로디
    const mel = [76, 74, 72, 74, 79, 76][(bar * 3 + s) % 6];
    if ((s === 6 || s === 14) && bar % 2 === 1) this.tone(NOTE(mel), at, step * 3, "sine", 0.05);
  }

  private musicStep(
    i: number,
    at: number,
    step: number,
    roots: number[],
    chords: number[][],
    bars: number,
  ): void {
    const bar = Math.floor(i / 16);
    const s = i % 16;
    const ci = Math.floor(bar / 1) % 4;
    const intro = bar < 1;
    const outro = bar >= bars - 1;
    // 킥: 매 박
    if (s % 4 === 0) this.tone(150, at, 0.16, "sine", outro && s > 0 ? 0.3 : 0.6, 45);
    if (intro) {
      if (s % 4 === 0) this.tone(NOTE(84), at, 0.06, "sine", 0.18);
      return;
    }
    // 박수: 2, 4박
    if (s === 4 || s === 12) this.hiss(at, 0.12, 0.25, 1600, 0.8);
    // 하이햇: 엇박
    if (s % 2 === 1) this.hiss(at, 0.03, 0.08, 9000, 2);
    // 베이스: 8분
    if (s % 2 === 0) this.tone(NOTE(roots[ci] - 12), at, step * 1.8, "triangle", 0.28);
    // 아르페지오: 16분, 화음 구성음
    const ch = chords[ci];
    const n = ch[[0, 1, 2, 1, 2, 0, 1, 2][s % 8]] + (s >= 8 ? 12 : 0);
    if (!outro) this.tone(NOTE(n), at, step * 0.9, "square", 0.035);
    // 패드: 마디 첫 박
    if (s === 0) ch.forEach((c) => this.tone(NOTE(c - 12), at, step * 15, "sine", 0.07));
  }

  stopMusic(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.trackSrc?.stop();
    this.trackSrc = null;
  }
}
