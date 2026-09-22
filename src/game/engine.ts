import { GameAudio } from "./audio";
import {
  GRAVITY,
  MAX_STONES,
  ROUND_SECONDS,
  SCORE_BODY,
  SCORE_FOREHEAD,
  SCORE_HEAD,
  SCORE_LIMB,
  SCORE_SHIELD,
  SCORE_STAGGER_BONUS,
  THROW_COOLDOWN,
  WORLD_H,
  WORLD_W,
  CRIT_MULT,
  stoneFlight,
} from "./constants";
import { drawWorld } from "./draw";
import type { CameraState, Floater, GameSim, Particle, Phase, Ring, Stone, UiSnap } from "./types";
import type { PoseFrame, ThrowEvent } from "./pose";
import { addScore, clearScores, loadScores, type ScoreRecord } from "./scores";
import { randomVerse, type Verse } from "./verses";

export class Game {
  phase: Phase = "boot";
  time = 0;
  score = 0;
  combo = 0;
  comboTimer = 0;
  timeLeft = ROUND_SECONDS;
  countdown = 3;
  verse: Verse = randomVerse();
  personPresent = false;
  cameraState: CameraState = "off";
  lastHit: string | null = null;
  resultRank = 0;
  scores: ScoreRecord[] = [];
  confirmReset = false;
  banner: string | null = null;
  bannerLife = 0;
  poseReady = false;
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

  constructor(
    private audio: GameAudio,
    private emit: (ui: UiSnap) => void,
  ) {
    this.scores = loadScores();
    this.pushUi(true);
  }

  setBackground(img: HTMLImageElement | null): void {
    this.bg = img;
  }

  setCameraState(state: CameraState, error: string | null = null): void {
    this.cameraState = state;
    this.cameraError = state === "denied" ? error : null;
    this.pushUi(true);
  }

  setPoseReady(ready: boolean): void {
    this.poseReady = ready;
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
    else if (this.phase === "start") this.goCountdown();
    else if (this.phase === "result") this.goAttract();
  }

  setPerson(present: boolean): void {
    this.personPresent = present;
  }

  notePose(frame: PoseFrame): void {
    this.personPresent = frame.present;
    this.armed = frame.armed;
    this.poseReady = true;
    if (frame.skeleton && frame.skeleton.length > 6) {
      const lw = frame.skeleton[5];
      const rw = frame.skeleton[6];
      const hand = lw && rw ? (lw.y < rw.y ? lw : rw) : lw ?? rw;
      if (hand) this.aimX += ((hand.x - 0.5) * 2 - this.aimX) * 0.28;
    }
    if (this.phase === "play" && frame.armed) this.charge = Math.max(this.charge, 0.82);
    if (this.phase === "attract") {
      if (frame.present) {
        this.personHold += 1;
        if (this.personHold > 10) this.goStart();
      } else this.personHold = 0;
    }
    if (this.phase === "start" && frame.handsUp) {
      this.handsHold += 1;
      if (this.handsHold > 8) this.goCountdown();
    } else if (this.phase === "start") {
      this.handsHold = 0;
    }
    if (this.phase === "play" && frame.throwEvent) {
      this.launch(frame.throwEvent);
      this.banner = "던짐!";
      this.bannerLife = 0.55;
    }
    if (this.phase === "result" && !frame.present) {
      this.vacantHold += 1;
      if (this.vacantHold > 45) this.goAttract();
    } else if (this.phase === "result" && frame.present) {
      this.vacantHold = 0;
    }
  }

  pointerDown(x: number, y: number, id: number): void {
    this.pointerId = id;
    if (this.phase === "boot") {
      this.begin();
      return;
    }
    if (this.phase === "attract") {
      if (this.cameraState === "live") this.goStart();
      return;
    }
    if (this.phase === "result") {
      this.goAttract();
    }
  }

  pointerMove(_x: number, _y: number, _id: number): void {}

  pointerUp(_x: number, _y: number, _id: number): void {
    this.pointerId = null;
    this.charging = false;
    this.charge = 0;
  }

  throwStone(power = 0.78, aimX?: number): void {
    const x =
      aimX ?? Math.max(-1, Math.min(1, (this.goliathX - WORLD_W / 2) / 220));
    this.launch({ power, aimX: x });
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

  update(dt: number): void {
    const raw = Math.min(dt, 0.1);
    if (this.hitStop > 0) {
      this.hitStop -= raw;
      this.stepFx(raw);
      this.hitFlash = Math.max(0, this.hitFlash - raw * 4);
      this.pushUi();
      return;
    }
    const capped = raw;
    this.time += capped;
    this.stepGoliath(capped);
    this.hitFlash = Math.max(0, this.hitFlash - capped * 4);
    this.stagger = Math.max(0, this.stagger - capped);
    this.throwAnim = Math.max(0, this.throwAnim - capped * 3.2);
    this.throwCool = Math.max(0, this.throwCool - capped);
    this.comboTimer = Math.max(0, this.comboTimer - capped);
    if (this.comboTimer <= 0) this.combo = 0;
    this.bannerLife = Math.max(0, this.bannerLife - capped);
    if (this.bannerLife <= 0) this.banner = null;
    this.trauma = Math.max(0, this.trauma - capped * 1.8);
    const shake = this.trauma * this.trauma;
    this.shakeX = (Math.random() - 0.5) * 22 * shake;
    this.shakeY = (Math.random() - 0.5) * 14 * shake;
    if (this.phase === "play" && this.armed) {
      this.charge = Math.min(1, this.charge + capped * 2.4);
    } else {
      this.charge = Math.max(0, this.charge - capped * 2);
    }

    if (this.phase === "attract") {
      this.demoAcc += capped;
      if (this.demoAcc > 2.05) {
        this.demoAcc = 0;
        const toHead = Math.random() > 0.28;
        this.launch(
          {
            power: toHead ? 0.92 : 0.55 + Math.random() * 0.25,
            aimX: toHead ? (Math.random() - 0.5) * 0.2 : (Math.random() - 0.5) * 0.9,
          },
          true,
        );
      }
    }

    if (this.phase === "countdown") {
      this.countdownAcc += capped;
      if (this.countdownAcc >= 1) {
        this.countdownAcc = 0;
        this.countdown -= 1;
        this.audio.play("tick");
        if (this.countdown <= 0) {
          this.phase = "play";
          this.timeLeft = ROUND_SECONDS;
          this.score = 0;
          this.combo = 0;
          this.maxCombo = 0;
          this.foreheadHits = 0;
          this.awardedStagger = false;
          this.downed = false;
          this.damage = 0;
          this.lastHit = null;
          this.aiMode = "open";
          this.aiT = 0;
          this.lastUrgentTick = 11;
          this.audio.play("start");
        }
        this.pushUi(true);
      }
    }

    if (this.phase === "play") {
      this.timeLeft -= capped;
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
      }
    }

    if (this.phase === "result") {
      this.resultAcc += capped;
      if (this.resultAcc > 16) this.goAttract();
    }

    this.stepStones(capped);
    this.stepFx(capped);
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
    if (this.phase === "start" || this.phase === "countdown" || this.phase === "play") return;
    this.phase = "start";
    this.verse = randomVerse(this.verse.ref);
    this.handsHold = 0;
    this.confirmReset = false;
    this.pushUi(true);
  }

  private goCountdown(): void {
    if (this.cameraState !== "live") {
      this.banner = "카메라가 켜져야 시작할 수 있습니다";
      this.bannerLife = 2;
      this.pushUi(true);
      return;
    }
    this.phase = "countdown";
    this.countdown = 3;
    this.countdownAcc = 0;
    this.stones = [];
    this.audio.play("tick");
    this.pushUi(true);
  }

  private goAttract(): void {
    this.phase = "attract";
    this.personHold = 0;
    this.vacantHold = 0;
    this.resultAcc = 0;
    this.confirmReset = false;
    this.banner = null;
    this.pushUi(true);
  }

  private finishRound(): void {
    this.phase = "result";
    this.resultAcc = 0;
    this.vacantHold = 0;
    const saved = addScore(this.score);
    this.scores = saved.list;
    this.resultRank = saved.rank;
    this.audio.play("end");
    this.pushUi(true);
  }

  private launch(ev: ThrowEvent, demo = false): void {
    if (!demo && this.phase !== "play") return;
    if (!demo && this.throwCool > 0) return;
    if (this.stones.filter((s) => s.live).length >= MAX_STONES) return;
    const power = ev.power;
    const flight = stoneFlight(this.goliathX, this.goliathBob, ev.aimX, power);
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
        continue;
      }
      this.collide(s);
    }
    this.stones = this.stones.filter((s) => s.live || s.y < WORLD_H + 80);
  }

  private collide(s: Stone): void {
    const gx = this.goliathX;
    const gy = 70 + this.goliathBob;
    const shield = { x: gx - 150, y: gy + (this.shieldUp ? 390 : 560), r: 118 };
    const forehead = { x: gx + 8, y: gy + 198, r: 78 };
    const head = { x: gx + 8, y: gy + 278, r: 58 };
    const torso = { x: gx, y: gy + 560, w: 240, h: 320 };
    const legs = { x: gx, y: gy + 1080, w: 190, h: 260 };

    const hitCirc = (c: { x: number; y: number; r: number }) => Math.hypot(s.x - c.x, s.y - c.y) < c.r + 16;
    const hitBox = (b: { x: number; y: number; w: number; h: number }) =>
      s.x > b.x - b.w / 2 && s.x < b.x + b.w / 2 && s.y > b.y - b.h / 2 && s.y < b.y + b.h / 2;
    const rising = s.vy < 0;

    if (hitCirc(forehead)) {
      this.registerHit("이마", SCORE_FOREHEAD, s.x, s.y, "hitHead");
      s.live = false;
      return;
    }
    if (!rising && hitCirc(head)) {
      this.registerHit("투구", SCORE_HEAD, s.x, s.y, "hitHead");
      s.live = false;
      return;
    }
    if (s.x < gx - 48 && hitCirc(shield)) {
      this.registerHit("방패", SCORE_SHIELD, s.x, s.y, "hitShield");
      s.live = false;
      return;
    }
    if (!rising && hitBox(torso)) {
      this.registerHit("갑옷", SCORE_BODY, s.x, s.y, "hitSoft");
      s.live = false;
      return;
    }
    if (!rising && hitBox(legs)) {
      this.registerHit("다리", SCORE_LIMB, s.x, s.y, "hitSoft");
      s.live = false;
    }
  }

  private registerHit(label: string, base: number, x: number, y: number, sfx: "hitSoft" | "hitShield" | "hitHead"): void {
    if (this.phase !== "play") {
      this.burst(x, y, sfx === "hitHead" ? "#efe8dc" : "#c4b49a");
      this.hitFlash = 0.4;
      return;
    }
    if (this.comboTimer > 0) this.combo += 1;
    else this.combo = 1;
    this.comboTimer = 1.8;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    const crit = label === "이마";
    const mult = Math.min(3, 1 + (this.combo - 1) * 0.25) * (crit ? CRIT_MULT : 1);
    const gained = Math.round(base * mult);
    this.score += gained;
    this.lastHit = label;
    this.hitFlash = 1;
    this.stagger = crit ? 1.15 : 0.35;
    this.trauma = Math.min(1, this.trauma + (crit ? 0.85 : label === "방패" ? 0.25 : 0.4));
    if (crit) this.hitStop = 0.08;
    this.rings.push({ x, y, life: 0.45, maxLife: 0.45, r: 18 });
    this.floaters.push({
      x,
      y,
      life: 0.95,
      maxLife: 0.95,
      text: crit ? `CRIT x2  ${gained}` : this.combo > 1 ? `${gained}  ×${this.combo}` : `${gained}`,
      color: crit ? "#efe8dc" : "#d7cbb8",
    });
    this.burst(x, y, crit ? "#efe8dc" : "#c4b49a");
    this.audio.play(sfx);
    if (this.combo > 1 && this.combo % 2 === 0) this.audio.play("combo");
    if (crit || label === "투구") this.damage = Math.min(3, this.damage + 1);
    if (crit) {
      this.foreheadHits += 1;
      this.banner = "크리티컬 x2";
      this.bannerLife = 1.15;
      this.audio.play("combo");
      if (this.foreheadHits > 0 && this.foreheadHits % 3 === 0) {
        this.downed = true;
        this.downedLife = 2.2;
        this.score += SCORE_STAGGER_BONUS;
        this.banner = "골리앗이 무릎을 꿇습니다";
        this.bannerLife = 1.8;
        this.hitStop = 0.12;
        this.trauma = 1;
        this.audio.play("stagger");
        this.floaters.push({
          x: this.goliathX,
          y: 360,
          life: 1.4,
          maxLife: 1.4,
          text: `+${SCORE_STAGGER_BONUS}`,
          color: "#efe8dc",
        });
      }
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
      armed: this.armed,
      cameraError: this.cameraError,
      foreheadHits: this.foreheadHits,
      comboLeft: this.comboTimer / 1.8,
      bestScore: this.scores[0]?.score ?? 0,
    };
  }

  private motionHint(): string {
    if (this.cameraState === "loading") return "카메라를 켜는 중";
    if (this.cameraState === "denied") {
      return this.cameraError || "카메라 권한을 허용해 주세요";
    }
    if (this.cameraState !== "live") return "카메라를 켜 주세요";
    if (!this.personPresent) return "카메라 앞에 상반신이 나오게 서 주세요";
    if (this.phase === "start") return "양손을 머리 위로 들어 시작";
    if (this.phase === "play") {
      if (this.downed) return "쓰러진 사이 계속 던지세요";
      if (this.shieldWarn) return "방패가 올라옵니다 · 지금 급소를 노리세요";
      if (this.shieldUp) return "방패가 가립니다 · 골리앗이 열리는 순간";
      const side = this.goliathX < WORLD_W / 2 - 36 ? "왼쪽으로 휘두르세요" : this.goliathX > WORLD_W / 2 + 36 ? "오른쪽으로 휘두르세요" : "정면으로 휘두르세요";
      return this.armed ? `장전 · ${side}` : `골리앗 쪽으로 휘두르세요 · ${side}`;
    }
    if (this.phase === "attract") return "카메라 앞에 서면 시작합니다";
    return "";
  }
}
