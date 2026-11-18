// 배경음악 파일은 있으면 쓰고 없으면 건너뛴다(src/assets/audio/bgm.mp3 등). 없어도 게임은 그대로 돈다.
const bgmUrl = Object.values(
  import.meta.glob('../assets/audio/bgm.{mp3,ogg,m4a}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>,
)[0];

const BGM_VOLUME = 0.6; // 효과음이 묻히지 않게 (iOS 는 기기 볼륨만 따르므로 무시된다)

/** 효과음은 Web Audio 로 합성, 배경음악은 src/assets/audio/bgm.mp3 를 반복 재생한다. */
export class Sfx {
  muted = false;
  private ctx?: AudioContext;
  private master?: GainNode;
  private noiseBuf?: AudioBuffer;
  // ponytail: <audio loop> 는 mp3 특성상 반복 지점에 아주 짧은 틈이 생길 수 있다.
  // 거슬리면 decodeAudioData + AudioBufferSourceNode(loop) 로 바꿀 것(메모리 약 50MB).
  private bgm?: HTMLAudioElement;

  /** 첫 사용자 터치 안에서 불러야 한다(자동재생 정책) */
  start(): void {
    if (!this.bgm && bgmUrl) {
      this.bgm = new Audio(bgmUrl);
      this.bgm.loop = true;
      this.bgm.volume = BGM_VOLUME;
      this.bgm.muted = this.muted;
    }
    void this.bgm?.play().catch(() => {}); // 막히면 다음 터치에서 다시 시도된다
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.bgm) this.bgm.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.03);
  }
  suspend(): void {
    this.bgm?.pause();
    void this.ctx?.suspend();
  }
  resume(): void {
    void this.bgm?.play().catch(() => {});
    void this.ctx?.resume();
  }

  pickup() {
    this.tone(880, 0.1, 'triangle', 0.16);
    this.tone(1320, 0.18, 'triangle', 0.16, 0.07);
  }
  hit() {
    this.noise(0.4, 0.5, 900, 80);
    this.tone(120, 0.35, 'sine', 0.5, 0, 40);
  }
  block() {
    this.noise(0.25, 0.3, 2000, 400);
    this.tone(660, 0.2, 'sine', 0.15, 0, 990);
  }
  count(go: boolean) {
    this.tone(go ? 880 : 440, go ? 0.45 : 0.16, 'square', 0.1);
  }
  whoosh() {
    this.noise(0.28, 0.1, 300, 1800, 'bandpass');
  }
  shield() {
    this.tone(300, 0.45, 'sine', 0.16, 0, 900);
  }
  levelUp() {
    this.tone(523, 0.12, 'triangle', 0.1);
    this.tone(784, 0.2, 'triangle', 0.1, 0.1);
  }
  /** 배경음악 빠르기(피버 타임 연출). 음악이 없으면 아무 일도 없다 */
  setMusicRate(rate: number): void {
    if (this.bgm && this.bgm.playbackRate !== rate) this.bgm.playbackRate = rate;
  }
  /** 음식을 먹음 */
  food() {
    [660, 880, 1175].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.16, i * 0.06));
  }
  fever() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, i * 0.05));
  }
  storm() {
    this.noise(0.9, 0.22, 200, 1400, 'bandpass');
    this.tone(196, 0.6, 'sawtooth', 0.1, 0, 110);
  }
  laser() {
    this.tone(1400, 0.35, 'sawtooth', 0.09, 0, 300);
  }
  /** 완주 팡파르 */
  clear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i === 3 ? 0.6 : 0.16, 'triangle', 0.16, i * 0.13));
  }
  over() {
    this.tone(440, 0.9, 'sawtooth', 0.14, 0, 90);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    delay = 0,
    slideTo?: number,
  ) {
    const { ctx, master: out } = this;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(
    dur: number,
    gain: number,
    from: number,
    to: number,
    type: BiquadFilterType = 'lowpass',
  ) {
    const { ctx, noiseBuf, master: out } = this;
    if (!ctx || !out || !noiseBuf) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}
