type SfxName = "throw" | "hitSoft" | "hitShield" | "hitHead" | "stagger" | "tick" | "start" | "end" | "combo" | "freeze";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  unlock = (): void => {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  };

  setMuted(next: boolean): void {
    this.muted = next;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(next ? 0 : 0.22, this.ctx.currentTime, 0.03);
    }
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (name) {
      case "throw":
        this.noiseSweep(t, 0.18, 900, 240, 0.35);
        break;
      case "hitSoft":
        this.thump(t, 90, 0.28);
        break;
      case "hitShield":
        this.clang(t);
        break;
      case "hitHead":
        this.chime(t, 740, 0.4);
        this.thump(t, 70, 0.22);
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
      case "combo":
        this.chime(t, 660, 0.18);
        this.chime(t + 0.05, 880, 0.16);
        break;
      case "freeze":
        this.chime(t, 311, 0.35);
        this.chime(t + 0.08, 247, 0.4);
        break;
    }
  }

  private osc(freq: number, type: OscillatorType, t: number, dur: number, gain: number, freqEnd?: number): void {
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
