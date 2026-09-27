import { GameAudio } from "./audio";
import {
  GRAVITY,
  MAX_STONES,
  ROUND_SECONDS,
  THROW_COOLDOWN,
  WORLD_H,
  WORLD_W,
} from "./constants";
import { drawWorld } from "./draw";
import type { PoseFrame, ThrowEvent } from "./pose";
import { hitPoints, stoneFlight, worldFromGoliath, type HitPart } from "./rules";
import { addScore, clearScores, loadScores, type InputVia, type ScoreRecord } from "./scores";
import type { CameraState, Floater, GameSim, ModelState, Particle, Phase, Ring, Stone, UiSnap } from "./types";
import { VERSES, randomVerse, type Verse } from "./verses";

export class Game {
  phase: Phase = "boot";
  time = 0;
  score = 0;
  combo = 0;
  comboTimer = 0;
  timeLeft = ROUND_SECONDS;
  countdown = 3;
  verse: Verse = VERSES[0];
  personPresent = false;
  cameraState: CameraState = "off";
  lastHit: string | null = null;
  resultRank = 0;
  scores: ScoreRecord[] = [];
  confirmReset = false;
  banner: string | null = null;
  bannerLife = 0;
  poseReady = false;
  modelState: ModelState = "off";
  modelError: string | null = null;
  armed = false;
  cameraError: string | null = null;
  foreheadHits = 0;
  awardedStagger = false;
  maxCombo = 0;
  shieldWarn = false;
  downed = false;
  aimX = 0;
  damage = 0;
  rings: Ring[] = [];

  goliathX = WORLD_W / 2;
  goliathBob = 0;
  shieldUp = false;
  hitFlash = 0;
  stagger = 0;
  throwAnim = 0;
  charge = 0;
  shakeX = 0;
  shakeY = 0;
  stones: Stone[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];

  private throwCool = 0;
  private demoAcc = 0;
  private countdownAcc = 0;
  private resultAcc = 0;
  private handsHold = 0;
  private personHold = 0;
  private vacantHold = 0;
  private charging = false;
  private chargeX = 0;
  private chargeY = 0;
  private pointerId: number | null = null;
  private lastUiKey = "";
  private bg: HTMLImageElement | null = null;
  private hitStop = 0;
  private trauma = 0;
  private aiT = 0;
  private aiMode: "open" | "warn" | "guard" = "open";
  private lastUrgentTick = 11;
  private downedLife = 0;
  private playStart = 0;
  private lastNow = 0;
  private roundOpen = false;
  private practiceLeft = 0;
  private freezeLeft = 0;
  private freezeCd = 0;
  private freezeHold = 0;
  freezeFound = false;
  private chestStill = false;
  inputVia: InputVia = "webcam";
  private pointerHolding = false;
  private pointerHold = 0;
  private pointerX = 0;
  private pointerY = 0;
  private pointerX0 = 0;
  private pointerY0 = 0;
  private calm = false;

  constructor(
    private audio: GameAudio,
    private emit: (ui: UiSnap) => void,
  ) {
    this.scores = loadScores();
    this.calm =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pushUi(true);
  }

  setBackground(img: HTMLImageElement | null): void {
    this.bg = img;
  }

  setCameraState(state: CameraState, error: string | null = null): void {
    this.cameraState = state;
    this.cameraError = state === "denied" ? error : null;
    if (state !== "live") {
      this.poseReady = false;
      this.modelState = "off";
      this.modelError = null;
    }
    this.pushUi(true);
  }

  setReadiness(camera: CameraState, cameraError: string | null, model: ModelState, modelError: string | null): void {
    this.cameraState = camera;
    this.cameraError = camera === "denied" ? cameraError : null;
    this.modelState = model;
    this.modelError = model === "failed" ? modelError : null;
    this.poseReady = model === "ready";
    const liveRound = this.phase === "play" || this.phase === "countdown" || this.phase === "practice";
    if (liveRound && (camera !== "live" || model === "failed")) {
      this.abortRound("카메라가 끊겨 이번 경기는 기록하지 않습니다");
      return;
    }
    this.pushUi(true);
  }

  begin(): void {
    this.audio.unlock();
    this.phase = "attract";
    this.verse = randomVerse();
    this.pushUi(true);
  }

  uiAdvance(): void {
    if (this.phase === "boot") this.begin();
    else if (this.phase === "attract") this.goStart();
    else if (this.phase === "start") this.goPractice();
    else if (this.phase === "result") this.goAttract();
  }

  setPerson(present: boolean): void {
    this.personPresent = present;
  }

  notePose(frame: PoseFrame): void {
    this.personPresent = frame.present;
    this.armed = frame.armed;
    this.chestStill = frame.present && frame.chestStill;
    if (frame.skeleton && frame.skeleton.length > 6) {
      const lw = frame.skeleton[5];
      const rw = frame.skeleton[6];
      const hand = lw && rw ? (lw.y < rw.y ? lw : rw) : lw ?? rw;
      if (hand) this.aimX += ((hand.x - 0.5) * 2 - this.aimX) * 0.28;
    }
    if ((this.phase === "play" || this.phase === "practice") && frame.armed) {
      this.charge = Math.max(this.charge, 0.82);
    }
    const now = performance.now();
    if (this.phase === "attract") {
      if (frame.present && frame.handsUp && this.poseReady) {
        if (this.personHold === 0) this.personHold = now;
        if (now - this.personHold > 700) this.goStart();
      } else this.personHold = 0;
    }
    if (this.phase === "start" && frame.handsUp && frame.present) {
      if (this.handsHold === 0) this.handsHold = now;
      if (now - this.handsHold > 700) this.goPractice();
    } else if (this.phase === "start") {
      this.handsHold = 0;
    }
    if ((this.phase === "play" || this.phase === "practice") && frame.throwEvent) {
      if (this.launch(frame.throwEvent)) {
        this.banner = "던짐!";
        this.bannerLife = 0.45;
      }
    }
    if (this.phase === "result" && !frame.present) {
      if (this.vacantHold === 0) this.vacantHold = now;
      if (now - this.vacantHold > 2500) this.goAttract();
    } else if (this.phase === "result" && frame.present) {
      this.vacantHold = 0;
    }
  }

  pointerDown(x: number, y: number, id: number): void {
    this.pointerId = id;
    this.pointerHolding = true;
    this.pointerHold = 0;
    this.pointerX = x;
    this.pointerY = y;
    this.pointerX0 = x;
    this.pointerY0 = y;
    if (this.phase === "boot") {
      this.begin();
      return;
    }
    if (this.phase === "attract") {
      if (this.cameraState === "live") this.goStart();
      return;
    }
    if (this.phase === "result") this.goAttract();
  }

  pointerMove(x: number, y: number, id: number): void {
    if (id !== this.pointerId) return;
    if (Math.hypot(x - this.pointerX0, y - this.pointerY0) > 36) this.pointerHolding = false;
    this.pointerX = x;
    this.pointerY = y;
  }

  pointerUp(x: number, y: number, id: number): void {
    if (id !== this.pointerId && this.pointerId !== null) return;
    const dy = this.pointerY0 - y;
    const dx = x - this.pointerX0;
    this.pointerId = null;
    this.pointerHolding = false;
    this.pointerHold = 0;
    this.charging = false;
    this.charge = 0;
    if ((this.phase === "play" || this.phase === "practice") && dy > 90 && Math.abs(dx) < 460) {
      this.inputVia = "pointer";
      const aim = Math.max(-1, Math.min(1, (x - WORLD_W / 2) / 280));
      if (this.launch({ power: Math.max(0.45, Math.min(1, dy / 520)), aimX: aim })) {
        this.banner = "던짐!";
        this.bannerLife = 0.45;
      }
    }
  }

  throwStone(power = 0.78, aimX?: number): void {
    const x = aimX ?? Math.max(-1, Math.min(1, (this.goliathX - WORLD_W / 2) / 220));
    this.launch({ power, aimX: x });
  }

  startPractice(): void {
    this.goPractice();
  }

  skipPractice(): void {
    if (this.phase === "practice") this.goCountdown();
  }

  nextPlayer(): void {
    this.goAttract();
  }

  toggleMute(): void {
    this.audio.setMuted(!this.audio.muted);
    this.pushUi(true);
  }

  askReset(): void {
    this.confirmReset = true;
    this.pushUi(true);
  }

  confirmClear(): void {
    this.scores = clearScores();
    this.confirmReset = false;
    this.pushUi(true);
  }

  cancelClear(): void {
    this.confirmReset = false;
    this.pushUi(true);
  }

  update(now: number): void {
    const real = this.lastNow ? Math.min(0.25, (now - this.lastNow) / 1000) : 0.016;
    this.lastNow = now;
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - real);
    this.time += real;

    if (this.phase === "play" && this.playStart > 0) {
      this.timeLeft = Math.max(0, ROUND_SECONDS - (now - this.playStart) / 1000);
      if (this.timeLeft <= 10 && this.timeLeft > 0) {
        const sec = Math.ceil(this.timeLeft);
        if (sec < this.lastUrgentTick) {
          this.lastUrgentTick = sec;
          this.audio.play("tick");
        }
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.finishRound();
        this.pushUi(true);
        return;
      }
    }

    if (this.freezeLeft > 0) this.freezeLeft = Math.max(0, this.freezeLeft - real);
    if (this.freezeCd > 0) this.freezeCd = Math.max(0, this.freezeCd - real);
    if (this.phase === "play" && this.freezeCd <= 0 && this.freezeLeft <= 0 && (this.chestStill || this.pointerHolding)) {
      this.freezeHold += real;
      if (this.freezeHold >= 1.2) this.triggerFreeze();
    } else if (!this.pointerHolding) {
      this.freezeHold = 0;
    }

    const phys = this.hitStop > 0 ? 0 : real;
    this.stepGoliath(phys || 0.0001);
    this.hitFlash = Math.max(0, this.hitFlash - real * 4);
    this.stagger = Math.max(0, this.stagger - real);
    this.throwAnim = Math.max(0, this.throwAnim - real * 3.2);
    this.throwCool = Math.max(0, this.throwCool - real);
    this.comboTimer = Math.max(0, this.comboTimer - real);
    if (this.comboTimer <= 0) this.combo = 0;
    this.bannerLife = Math.max(0, this.bannerLife - real);
    if (this.bannerLife <= 0) this.banner = null;
    this.trauma = Math.max(0, this.trauma - real * 1.8);
    const amp = this.calm ? 0 : this.trauma * this.trauma;
    this.shakeX = (Math.random() - 0.5) * 10 * amp;
    this.shakeY = (Math.random() - 0.5) * 6 * amp;
    if ((this.phase === "play" || this.phase === "practice") && this.armed) {
      this.charge = Math.min(1, this.charge + real * 2.4);
    } else {
      this.charge = Math.max(0, this.charge - real * 2);
    }

    if (this.phase === "attract") {
      this.demoAcc += real;
      if (this.demoAcc > 2.05) {
        this.demoAcc = 0;
        this.launch(
          {
            power: Math.random() > 0.28 ? 0.92 : 0.55 + Math.random() * 0.25,
            aimX: (Math.random() - 0.5) * 0.35,
          },
          true,
        );
      }
    }

    if (this.phase === "countdown") {
      this.countdownAcc += real;
      if (this.countdownAcc >= 1) {
        this.countdownAcc = 0;
        this.countdown -= 1;
        this.audio.play("tick");
        if (this.countdown <= 0) this.beginPlay(now);
        this.pushUi(true);
      }
    }

    if (this.phase === "practice" && this.practiceLeft > 0) {
      this.practiceLeft -= real;
      if (this.practiceLeft <= 0) this.goCountdown();
    }

    if (this.phase === "result") {
      this.resultAcc += real;
      if (this.resultAcc > 18) this.goAttract();
    }

    if (phys > 0) this.stepStones(phys);
    this.stepFx(real);
    this.pushUi();
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawWorld(ctx, this.sim(), this.bg);
  }

  sim(): GameSim {
    return {
      phase: this.phase,
      time: this.time,
      goliathX: this.goliathX,
      goliathBob: this.goliathBob,
      shieldUp: this.shieldUp,
      shieldWarn: this.shieldWarn,
      hitFlash: this.hitFlash,
      stagger: this.stagger,
      throwAnim: this.throwAnim,
      charge: this.charge,
      shakeX: this.shakeX,
      shakeY: this.shakeY,
      stones: this.stones,
      particles: this.particles,
      floaters: this.floaters,
      rings: this.rings,
      damage: this.damage,
      armed: this.armed,
      aimX: this.aimX,
      downed: this.downed,
      sightX: this.goliathX + 8 + Math.max(-1, Math.min(1, this.aimX)) * 170,
    };
  }

  private goStart(): void {
    if (this.phase === "start" || this.phase === "practice" || this.phase === "countdown" || this.phase === "play") return;
    if (!this.readyToStart()) return;
    this.phase = "start";
    this.verse = randomVerse(this.verse.ref);
    this.handsHold = 0;
    this.confirmReset = false;
    this.pushUi(true);
  }

  private goPractice(): void {
    if (this.phase === "practice" || this.phase === "countdown" || this.phase === "play") return;
    if (!this.readyToStart()) return;
    this.phase = "practice";
    this.stones = [];
    this.practiceLeft = 0;
    this.score = 0;
    this.combo = 0;
    this.banner = "한 번 던져 보세요";
    this.bannerLife = 2;
    this.pushUi(true);
  }

  private goCountdown(): void {
    if (this.phase === "countdown" || this.phase === "play") return;
    if (!this.readyToStart()) return;
    this.phase = "countdown";
    this.countdown = 3;
    this.countdownAcc = 0;
    this.stones = [];
    this.practiceLeft = 0;
    this.audio.play("tick");
    this.pushUi(true);
  }

  private beginPlay(now: number): void {
    this.phase = "play";
    this.playStart = now;
    this.roundOpen = true;
    this.timeLeft = ROUND_SECONDS;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.foreheadHits = 0;
    this.downed = false;
    this.downedLife = 0;
    this.damage = 0;
    this.lastHit = null;
    this.aiMode = "open";
    this.aiT = 0;
    this.lastUrgentTick = 11;
    this.freezeLeft = 0;
    this.freezeCd = 0;
    this.freezeHold = 0;
    this.freezeFound = false;
    this.inputVia = "webcam";
    this.stones = [];
    this.throwCool = 0;
    this.hitStop = 0;
    this.audio.play("start");
  }

  private abortRound(message: string): void {
    this.roundOpen = false;
    this.playStart = 0;
    this.stones = [];
    this.phase = "attract";
    this.personHold = 0;
    this.banner = message;
    this.bannerLife = 3.2;
    this.pushUi(true);
  }

  private triggerFreeze(): void {
    if (this.phase !== "play" || this.freezeCd > 0 || this.freezeLeft > 0) return;
    this.freezeLeft = 2;
    this.freezeCd = 8;
    this.freezeHold = 0;
    this.pointerHold = 0;
    this.shieldUp = false;
    this.shieldWarn = false;
    const first = !this.freezeFound;
    this.freezeFound = true;
    this.banner = first ? "다윗의 프리징" : "집중";
    this.bannerLife = 1.3;
    this.audio.play("freeze");
  }

  private readyToStart(): boolean {
    if (this.cameraState === "live" && this.poseReady) return true;
    this.banner = this.readinessHint();
    this.bannerLife = 2.4;
    this.pushUi(true);
    return false;
  }

  private readinessHint(): string {
    if (this.cameraState === "loading") return "카메라를 켜는 중입니다";
    if (this.cameraState === "denied") return this.cameraError || "카메라 권한을 허용해 주세요";
    if (this.cameraState !== "live") return "카메라를 켜 주세요";
    if (this.modelState === "loading") return "모션을 준비하는 중입니다";
    if (this.modelState === "failed") return this.modelError || "모션을 다시 준비해 주세요";
    return "모션이 준비되면 시작할 수 있습니다";
  }

  private goAttract(): void {
    this.phase = "attract";
    this.personHold = 0;
    this.vacantHold = 0;
    this.resultAcc = 0;
    this.confirmReset = false;
    this.stones = [];
    this.roundOpen = false;
    this.playStart = 0;
    this.practiceLeft = 0;
    this.throwCool = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.banner = null;
    this.pushUi(true);
  }

  private finishRound(): void {
    if (this.phase === "result") return;
    this.phase = "result";
    this.resultAcc = 0;
    this.vacantHold = 0;
    this.stones = [];
    this.timeLeft = 0;
    if (this.roundOpen) {
      this.roundOpen = false;
      const saved = addScore(this.score, this.inputVia);
      this.scores = saved.list;
      this.resultRank = saved.rank;
    }
    this.audio.play("end");
    this.pushUi(true);
  }

  private launch(ev: ThrowEvent, demo = false): boolean {
    const live = this.phase === "play" || this.phase === "practice";
    if (!demo && !live) return false;
    if (!demo && this.throwCool > 0) return false;
    if (this.stones.length >= MAX_STONES) return false;
    const flight = stoneFlight(this.goliathX, this.goliathBob, ev.aimX, ev.power, this.stagger, this.downed);
    this.stones.push({
      x: flight.originX,
      y: flight.originY,
      vx: flight.vx,
      vy: flight.vy,
      rot: 0,
      spin: (Math.random() - 0.5) * 10,
      live: true,
    });
    this.aimX = ev.aimX;
    this.throwAnim = 1;
    this.charge = 0;
    this.throwCool = demo ? 0.2 : THROW_COOLDOWN;
    if (!demo) this.audio.play("throw");
    if (!demo && this.phase === "practice") this.practiceLeft = 0.9;
    return true;
  }

  private breakCombo(): void {
    this.combo = 0;
    this.comboTimer = 0;
  }

  private stepStones(dt: number): void {
    for (const s of this.stones) {
      if (!s.live) continue;
      s.vy += GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.rot += s.spin * dt;
      if (s.y > WORLD_H + 40 || s.x < -80 || s.x > WORLD_W + 80 || s.y < -120) {
        s.live = false;
        if (this.phase === "play") this.breakCombo();
        continue;
      }
      this.collide(s);
    }
    this.stones = this.stones.filter((s) => s.live);
  }

  private collide(s: Stone): void {
    const gy = 70 + this.goliathBob;
    const at = (lx: number, ly: number) => worldFromGoliath(this.goliathX, gy, this.stagger, this.downed, lx, ly);
    const forehead = { ...at(8, 198), r: 72 };
    const head = { ...at(8, 278), r: 54 };
    const shield = { ...at(-150, this.shieldUp ? 390 : 560), r: 112 };
    const torso = at(0, 560);
    const legs = at(0, 1080);
    const hitCirc = (c: { x: number; y: number; r: number }) => Math.hypot(s.x - c.x, s.y - c.y) < c.r + 14;
    const hitBox = (c: { x: number; y: number }, w: number, h: number) =>
      s.x > c.x - w / 2 && s.x < c.x + w / 2 && s.y > c.y - h / 2 && s.y < c.y + h / 2;
    const rising = s.vy < 0;
    if (hitCirc(forehead)) {
      this.registerHit("이마", s.x, s.y, "hitHead");
      s.live = false;
      return;
    }
    if (!rising && hitCirc(head)) {
      this.registerHit("투구", s.x, s.y, "hitHead");
      s.live = false;
      return;
    }
    if (s.x < torso.x - 40 && hitCirc(shield)) {
      this.registerHit("방패", s.x, s.y, "hitShield");
      s.live = false;
      return;
    }
    if (!rising && (hitBox(torso, 240, 320) || hitBox(legs, 190, 260))) {
      this.registerHit("몸통", s.x, s.y, "hitSoft");
      s.live = false;
    }
  }

  private registerHit(part: HitPart, x: number, y: number, sfx: "hitSoft" | "hitShield" | "hitHead"): void {
    if (this.phase === "practice") {
      this.hitFlash = 0.45;
      this.floaters.push({ x, y, life: 0.8, maxLife: 0.8, text: part, color: "#efe8dc" });
      this.audio.play(sfx);
      return;
    }
    if (this.phase !== "play") {
      this.hitFlash = 0.35;
      return;
    }
    const blocked = part === "방패";
    if (blocked) this.breakCombo();
    else {
      this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
      this.comboTimer = 2;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }
    const gained = hitPoints(part, blocked ? 1 : this.combo);
    this.score += gained;
    this.lastHit = part;
    this.hitFlash = 0.65;
    const crit = part === "이마";
    this.stagger = crit ? 0.7 : 0.25;
    this.trauma = Math.min(0.7, this.trauma + (crit ? 0.45 : blocked ? 0.15 : 0.28));
    if (crit) this.hitStop = 0.045;
    this.rings.push({ x, y, life: 0.35, maxLife: 0.35, r: 16 });
    this.floaters.push({
      x,
      y,
      life: 0.9,
      maxLife: 0.9,
      text: crit ? `크리티컬 ${gained}` : blocked ? `막힘 ${gained}` : this.combo > 1 ? `${gained} 연속${this.combo}` : `${gained}`,
      color: crit ? "#efe8dc" : blocked ? "#8a8074" : "#d7cbb8",
    });
    this.burst(x, y, crit ? "#efe8dc" : "#c4b49a");
    this.audio.play(sfx);
    if (!blocked && this.combo >= 3) this.audio.play("combo");
    if (crit || part === "투구") this.damage = Math.min(3, this.damage + 1);
    if (crit) {
      this.foreheadHits += 1;
      this.banner = "크리티컬";
      this.bannerLife = 0.8;
    }
  }

  private burst(x: number, y: number, color: string): void {
    const n = color === "#efe8dc" ? 22 : 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 280;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 4,
        color,
      });
    }
    if (this.particles.length > 90) this.particles.splice(0, this.particles.length - 90);
  }

  private stepFx(dt: number): void {
    for (const p of this.particles) {
      p.vy += 420 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) {
      f.y -= 50 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private stepGoliath(dt: number): void {
    if (this.freezeLeft > 0) {
      this.shieldUp = false;
      this.shieldWarn = false;
      this.aiMode = "open";
      return;
    }
    const haste = this.phase === "play" && this.timeLeft < 10 ? 1.35 : 1;
    const sway = this.downed ? 28 : 108;
    this.goliathX = WORLD_W / 2 + Math.sin(this.time * 0.55 * haste) * sway;
    this.goliathBob = Math.sin(this.time * (this.downed ? 2.4 : 1.7)) * (this.downed ? 14 : 8);
    if (this.downed) {
      this.downedLife = Math.max(0, this.downedLife - dt);
      if (this.downedLife <= 0) this.downed = false;
      this.shieldUp = false;
      this.shieldWarn = false;
      this.aiMode = "open";
      return;
    }
    if (this.phase !== "play") {
      this.shieldUp = Math.sin(this.time * 0.55) > 0.55;
      this.shieldWarn = false;
      return;
    }
    if (this.stagger > 0.55) {
      this.shieldUp = false;
      this.shieldWarn = false;
      this.aiMode = "open";
      return;
    }
    this.aiT += dt;
    if (this.aiMode === "open" && this.aiT > 1.55 / haste) {
      this.aiMode = "warn";
      this.aiT = 0;
    } else if (this.aiMode === "warn" && this.aiT > 0.42) {
      this.aiMode = "guard";
      this.aiT = 0;
    } else if (this.aiMode === "guard" && this.aiT > 1.15 / haste) {
      this.aiMode = "open";
      this.aiT = 0;
    }
    this.shieldWarn = this.aiMode === "warn";
    this.shieldUp = this.aiMode === "guard";
  }

  private pushUi(force = false): void {
    const snap = this.ui();
    const key = [
      snap.phase,
      snap.score,
      Math.ceil(snap.timeLeft),
      snap.countdown,
      snap.combo,
      snap.maxCombo,
      snap.foreheadHits,
      Math.round(snap.comboLeft * 10),
      snap.personPresent ? 1 : 0,
      snap.cameraState,
      snap.muted ? 1 : 0,
      snap.confirmReset ? 1 : 0,
      snap.banner ?? "",
      snap.motionHint,
      snap.poseReady ? 1 : 0,
      snap.modelState,
      snap.modelError ?? "",
      snap.armed ? 1 : 0,
      snap.cameraError ?? "",
      snap.verse.ref,
      snap.scores.length,
    ].join("|");
    if (!force && key === this.lastUiKey) return;
    this.lastUiKey = key;
    this.emit(snap);
  }

  ui(): UiSnap {
    return {
      phase: this.phase,
      score: this.score,
      combo: this.combo,
      maxCombo: this.maxCombo,
      timeLeft: this.timeLeft,
      countdown: this.countdown,
      verse: this.verse,
      personPresent: this.personPresent,
      cameraState: this.cameraState,
      lastHit: this.lastHit,
      resultRank: this.resultRank,
      scores: this.scores,
      muted: this.audio.muted,
      confirmReset: this.confirmReset,
      banner: this.banner,
      motionHint: this.motionHint(),
      poseReady: this.poseReady,
      modelState: this.modelState,
      modelError: this.modelError,
      armed: this.armed,
      cameraError: this.cameraError,
      foreheadHits: this.foreheadHits,
      comboLeft: this.comboTimer / 1.8,
      bestScore: this.scores[0]?.score ?? 0,
      freezeLeft: this.freezeLeft,
      freezeCd: this.freezeCd,
      freezeFound: this.freezeFound,
      inputVia: this.inputVia,
    };
  }

  private motionHint(): string {
    if (this.cameraState === "loading") return "카메라를 켜는 중";
    if (this.cameraState === "denied") return this.cameraError || "카메라 권한을 허용해 주세요";
    if (this.cameraState !== "live") return "카메라를 켜 주세요";
    if (this.modelState === "loading") return "카메라는 켜졌습니다. 모션을 준비하는 중";
    if (this.modelState === "failed") return this.modelError || "모션을 다시 준비해 주세요";
    if (!this.poseReady) return "모션이 준비되면 시작할 수 있습니다";
    if (!this.personPresent) return "카메라 앞에 상반신이 나오게 서 주세요";
    if (this.phase === "start") return "양손을 머리 위로 들어 시작";
    if (this.phase === "practice") return "팔을 뒤로 젖혔다가 앞으로 휘두르세요";
    if (this.phase === "play") {
      if (this.freezeLeft > 0) return "골리앗이 멈췄습니다";
      if (this.shieldWarn) return "방패가 올라옵니다";
      if (this.shieldUp) return "방패를 피하세요";
      const side = this.goliathX < WORLD_W / 2 - 36 ? "왼쪽으로" : this.goliathX > WORLD_W / 2 + 36 ? "오른쪽으로" : "정면으로";
      return `${side} 휘두르세요`;
    }
    if (this.phase === "attract") return "카메라 앞에 서면 시작합니다";
    return "";
  }
}
