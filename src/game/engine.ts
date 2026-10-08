import { GOLIATH_LOCAL, shieldLocal, type DavidPose, type GoliathPose } from "./art";
import { GameAudio } from "./audio";
import {
  GRAVITY,
  MAX_STONES,
  ROUND_SECONDS,
  URGENT_SECONDS,
  WORLD_H,
  WORLD_W,
} from "./constants";
import { drawWorld } from "./draw";
import type { PoseFrame, ThrowEvent } from "./pose";
import {
  AIM_Y_ORIGIN,
  AIM_Y_SPAN,
  aimPoint,
  combatBand,
  goliathAngle,
  hitPoints,
  segmentHitsBox,
  segmentHitsCircle,
  segmentHitsEllipse,
  STONE_R,
  stoneFlight,
  type GoliathAct,
  type HitPart,
} from "./rules";
import { addScore, clearScores, deleteScore, loadScores, qualifiesForName, setScoreName, type InputVia, type ScoreRecord } from "./scores";
import { NAME_ENTRY_SECONDS } from "./constants";
import type { CameraState, Floater, GameSim, ModelState, Particle, Phase, Ring, Stone, UiSnap } from "./types";
import { VERSES, randomVerse, type Verse } from "./verses";

const HANDS_UP_SECONDS = 1;
const PRACTICE_THROWS = 2;
const PRACTICE_MAX_SECONDS = 15;
const AIM_ASSIST_PX = 110;

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
  /** 이달 순위(0이면 기록 안 됨). */
  monthRank = 0;
  /** 이름 입력 중. 이 동안은 자리를 비워도 대기 화면으로 돌아가지 않는다. */
  naming = false;
  private namingLeft = 0;
  private resultAt = 0;
  savedName: string | null = null;
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
  aimY = 0.15;
  lean = 0;
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
  /** 양손 번쩍을 유지한 시간(초). 잠깐 놓쳐도 바로 0이 되지 않는다. */
  private handsHold = 0;
  private handsLost = 0;
  handsUpProgress = 0;
  tooFar = false;
  lowInFrame = false;
  offCenter = false;
  private practiceThrows = 0;
  private practiceIdle = 0;
  private vacantHold = 0;
  private charging = false;
  private chargeX = 0;
  private chargeY = 0;
  private pointerId: number | null = null;
  private lastUiKey = "";
  private hitStop = 0;
  private trauma = 0;
  private aiT = 0;
  private aiPhase: "rest" | "tell" | "act" | "open" = "rest";
  private aiAct: GoliathAct = "idle";
  rngState = 0x51a7;
  aiPhaseName: "rest" | "tell" | "act" | "open" = "rest";
  aiActName: GoliathAct = "idle";
  private interruptStreak = 0;
  private lastInterrupt: GoliathAct | null = null;
  private dodgeFrom = WORLD_W / 2;
  private dodgeTo = WORLD_W / 2;
  private restFrom = WORLD_W / 2;
  private openCritUsed = false;
  private freezeCritUsed = false;
  private wasFrozen = false;
  private releaseLeft = 0;
  private followLeft = 0;
  private recoverLeft = 0;
  private lastUrgentTick = URGENT_SECONDS + 1;
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
  checkMode = false;
  private absentHold = 0;
  private motionTime = 0;
  private queued: { ev: ThrowEvent; demo: boolean } | null = null;
  private combatAcc = 0;
  private stoneAcc = 0;
  hitLog: { part: HitPart; gained: number }[] = [];

  constructor(
    private audio: GameAudio,
    private emit: (ui: UiSnap) => void,
  ) {
    this.scores = loadScores();
    this.calm =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.pushUi(true);
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
    if (liveRound && !this.checkMode && (camera !== "live" || model === "failed")) {
      const why = camera !== "live" ? "카메라가 끊겨" : "모션이 멈춰";
      this.abortRound(`${why} 이번 경기는 기록하지 않습니다`);
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

  /** 첫 화면·대기·준비 화면의 아무 곳이나 누르면 다음으로 간다. */
  pressStart(): void {
    this.audio.unlock();
    if (this.phase === "boot") {
      this.begin();
      return;
    }
    if (this.phase === "result") {
      this.goAttract();
      return;
    }
    if (this.phase !== "attract" && this.phase !== "start") return;
    const cameraReady = this.poseReady && this.cameraState === "live";
    if (!this.checkMode && !cameraReady) {
      this.checkMode = true;
      this.inputVia = "pointer";
    }
    // 현장 요청: 연습 없이 바로 본 게임(3초 카운트다운)으로
    this.goGame();
  }

  /** 대기·준비 화면에서 곧장 카운트다운으로. */
  private goGame(): void {
    if (this.phase === "attract") this.goStart();
    this.goCountdown();
  }

  uiAdvance(): void {
    if (this.phase === "boot") this.begin();
    else if (this.phase === "attract" || this.phase === "start") this.goGame();
    else if (this.phase === "result") this.goAttract();
  }

  setPerson(present: boolean): void {
    this.personPresent = present;
  }

  enterCheckMode(): void {
    this.checkMode = true;
    this.inputVia = "pointer";
    this.banner = "점검 모드";
    this.bannerLife = 2.2;
    if (this.phase === "boot") this.begin();
    if (this.phase === "attract") this.goStart();
    else this.pushUi(true);
  }

  notePose(frame: PoseFrame): void {
    this.personPresent = frame.present;
    this.tooFar = frame.present && frame.tooFar;
    this.lowInFrame = frame.present && frame.lowInFrame;
    this.offCenter = frame.present && frame.offCenter;
    if (!frame.present) {
      this.armed = false;
      this.chestStill = false;
      this.freezeHold = 0;
      const live = this.phase === "play" || this.phase === "countdown" || this.phase === "practice";
      if (live && !this.checkMode && this.cameraState === "live") {
        const t = performance.now();
        if (this.absentHold === 0) this.absentHold = t;
        if (t - this.absentHold > 1500) {
          this.abortRound("사람이 화면에서 벗어나 이번 경기는 기록하지 않습니다");
          return;
        }
      }
      if (this.phase === "result") {
        const now = performance.now();
        if (this.naming) this.vacantHold = 0;
        else {
          if (this.vacantHold === 0) this.vacantHold = now;
          if (now - this.vacantHold > 2500) this.goAttract();
        }
      }
      return;
    }
    this.absentHold = 0;
    this.armed = frame.armed;
    this.chestStill = frame.chestStill;
    if (frame.aim && !this.queued && !this.pointerHolding) {
      this.aimX = frame.aim.aimX;
      this.aimY = frame.aim.aimY;
    }
    if ((this.phase === "play" || this.phase === "practice") && frame.armed) {
      this.charge = Math.max(this.charge, 0.6);
    }
    this.handsUpSeen = frame.handsUp && !frame.tooFar;
    if ((this.phase === "play" || this.phase === "practice") && frame.throwEvent) {
      if (!this.checkMode) this.inputVia = "webcam";
      this.launch(frame.throwEvent);
    }
    if (this.phase === "result") this.vacantHold = 0;
  }

  private handsUpSeen = false;

  /** 시작 동작: 양손을 머리 위로 1초 유지. 0.25초 이내로 놓친 것은 봐준다. */
  private stepHandsUp(dt: number): void {
    const waiting = this.phase === "attract" || this.phase === "start";
    if (!waiting || !this.poseReady || this.cameraState !== "live") {
      this.handsHold = 0;
      this.handsLost = 0;
      this.handsUpProgress = 0;
      return;
    }
    if (this.handsUpSeen && this.personPresent) {
      this.handsHold += dt;
      this.handsLost = 0;
    } else {
      this.handsLost += dt;
      if (this.handsLost > 0.25) this.handsHold = Math.max(0, this.handsHold - dt * 2);
    }
    this.handsUpProgress = Math.min(1, this.handsHold / HANDS_UP_SECONDS);
    if (this.handsHold >= HANDS_UP_SECONDS) {
      this.handsHold = 0;
      this.handsUpProgress = 0;
      this.audio.play("start");
      this.goGame();
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
    if (this.phase === "boot" || this.phase === "attract" || this.phase === "start") {
      this.pointerHolding = false;
      this.pressStart();
      return;
    }
    if (this.phase === "result") this.goAttract();
  }

  pointerMove(x: number, y: number, id: number): void {
    if (id !== this.pointerId) return;
    if (Math.hypot(x - this.pointerX0, y - this.pointerY0) > 36) this.pointerHolding = false;
    this.pointerX = x;
    this.pointerY = y;
    if (this.pointerHolding && (this.phase === "play" || this.phase === "practice")) {
      this.aimX = Math.max(-1, Math.min(1, (x - WORLD_W / 2) / 280));
      this.aimY = Math.max(-1, Math.min(1, (y - AIM_Y_ORIGIN) / AIM_Y_SPAN));
    }
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
      const aimX = Math.max(-1, Math.min(1, (x - WORLD_W / 2) / 280));
      const aimY = Math.max(-1, Math.min(1, (y - AIM_Y_ORIGIN) / AIM_Y_SPAN));
      this.launch({ power: Math.max(0.45, Math.min(1, dy / 520)), aimX, aimY });
    }
  }

  throwStone(power = 0.78, aimX = 0, aimY = 0.2): boolean {
    return this.launch({ power, aimX, aimY }, false, true);
  }

  /** 예전 이름 유지(점검 스크립트용). 연습 없이 바로 게임. */
  startPractice(): void {
    this.goGame();
  }

  skipPractice(): void {
    if (this.phase === "practice") this.goCountdown();
  }

  nextPlayer(): void {
    this.goAttract();
  }

  /** 화면 표시만 다시 계산(소리 상태 등). */
  nudgeUi(): void {
    this.pushUi(true);
  }

  testSound(): void {
    this.audio.test();
    this.pushUi(true);
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

  /** 결과 화면에서 이름 저장. 저장 후 몇 초 보여 주고 평소 흐름으로. */
  saveName(name: string): void {
    if (!this.naming || !this.resultAt) return;
    this.scores = setScoreName(this.resultAt, name);
    this.savedName = name.trim() || null;
    this.naming = false;
    this.resultAcc = 6;
    this.audio.play("combo");
    this.pushUi(true);
  }

  skipName(): void {
    if (!this.naming) return;
    this.naming = false;
    this.resultAcc = 6;
    this.pushUi(true);
  }

  /** 운영자 화면에서 기록 하나 지우기(부적절한 이름 등). */
  removeRecord(at: number): void {
    this.scores = deleteScore(at);
    this.pushUi(true);
  }

  /** 저장된 기록 다시 읽기. */
  refreshScores(): void {
    this.scores = loadScores();
    this.pushUi(true);
  }

  update(now: number): void {
    const real = this.lastNow ? Math.min(0.25, (now - this.lastNow) / 1000) : 0.016;
    this.lastNow = now;
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - real);
    this.time += real;

    if (this.phase === "play" && this.playStart > 0) {
      this.timeLeft = Math.max(0, ROUND_SECONDS - (now - this.playStart) / 1000);
      if (this.timeLeft <= URGENT_SECONDS && this.timeLeft > 0) {
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
    else this.motionTime += real;
    if (this.freezeCd > 0) this.freezeCd = Math.max(0, this.freezeCd - real);
    if (this.phase === "play" && this.freezeCd <= 0 && this.freezeLeft <= 0 && (this.chestStill || this.pointerHolding)) {
      this.freezeHold += real;
      if (this.freezeHold >= 1.2) this.triggerFreeze();
    } else if (!this.pointerHolding) {
      this.freezeHold = 0;
    }

    const STEP = 1 / 60;
    this.combatAcc = Math.min(0.25, this.combatAcc + real);
    this.stoneAcc = Math.min(0.25, this.stoneAcc + (this.hitStop > 0 ? 0 : real));
    while (this.combatAcc >= STEP || this.stoneAcc >= STEP) {
      if (this.combatAcc >= STEP) {
        this.stepGoliath(STEP);
        this.decayThrow(STEP);
        this.releaseQueued(STEP);
        this.combatAcc -= STEP;
      }
      if (this.stoneAcc >= STEP) {
        this.stepStones(STEP);
        this.stoneAcc -= STEP;
      }
    }
    this.hitFlash = Math.max(0, this.hitFlash - real * 4);
    this.stagger = Math.max(0, this.stagger - real);
    this.throwAnim = 0;
    this.comboTimer = Math.max(0, this.comboTimer - real);
    if (this.comboTimer <= 0) this.combo = 0;
    this.bannerLife = Math.max(0, this.bannerLife - real);
    if (this.bannerLife <= 0) this.banner = null;
    this.trauma = Math.max(0, this.trauma - real * 1.8);
    const amp = this.calm ? 0 : this.trauma * this.trauma;
    this.shakeX = (Math.random() - 0.5) * 10 * amp;
    this.shakeY = (Math.random() - 0.5) * 6 * amp;
    const winding = (this.phase === "play" || this.phase === "practice") && (this.armed || this.pointerHolding);
    if (winding) this.charge = Math.min(1, this.charge + real * 2.4);
    else this.charge = Math.max(0, this.charge - real * 2);

    if (this.phase === "attract") {
      this.demoAcc += real;
      if (this.demoAcc > 2.05) {
        this.demoAcc = 0;
        this.launch(
          {
            power: Math.random() > 0.28 ? 0.92 : 0.55 + Math.random() * 0.25,
            aimX: (Math.random() - 0.5) * 0.4,
            aimY: 0.25,
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

    this.stepHandsUp(real);
    if (this.phase === "practice") {
      this.practiceIdle += real;
      if (this.practiceLeft > 0) {
        this.practiceLeft -= real;
        if (this.practiceLeft <= 0) this.goCountdown();
      } else if (this.practiceIdle > PRACTICE_MAX_SECONDS) {
        this.goCountdown();
      }
    }

    if (this.phase === "result") {
      if (this.naming) {
        this.namingLeft -= real;
        if (this.namingLeft <= 0) this.skipName();
      } else {
        this.resultAcc += real;
        if (this.resultAcc > 18) this.goAttract();
      }
    }

    this.stepFx(real);
    this.pushUi();
  }

  render(ctx: CanvasRenderingContext2D): void {
    drawWorld(ctx, this.sim(), this.calm);
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
      aimY: this.aimY,
      lean: this.lean,
      critOpen: this.critOpen(),
      downed: this.downed,
      sightX: this.aimX * 300 + WORLD_W / 2,
      freezeLeft: this.freezeLeft,
      goliathPose: this.goliathPose(),
      davidPose: this.davidPose(),
    };
  }

  private goStart(): void {
    if (this.phase === "start" || this.phase === "practice" || this.phase === "countdown" || this.phase === "play") return;
    if (!this.readyToStart()) return;
    this.phase = "start";
    this.verse = randomVerse(this.verse.ref);
    this.handsHold = 0;
    this.confirmReset = false;
    this.queued = null;
    this.pushUi(true);
  }

  private goCountdown(): void {
    if (this.phase === "countdown" || this.phase === "play") return;
    if (!this.readyToStart()) return;
    this.phase = "countdown";
    this.countdown = 3;
    this.countdownAcc = 0;
    this.stones = [];
    this.queued = null;
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
    this.aiPhase = "rest";
    this.aiAct = "idle";
    this.aiPhaseName = "rest";
    this.aiActName = "idle";
    this.aiT = 0;
    this.rngState = 0x51a7;
    this.interruptStreak = 0;
    this.lastInterrupt = null;
    this.openCritUsed = false;
    this.freezeCritUsed = false;
    this.wasFrozen = false;
    this.goliathX = WORLD_W / 2;
    this.dodgeFrom = WORLD_W / 2;
    this.dodgeTo = WORLD_W / 2;
    this.restFrom = WORLD_W / 2;
    this.lean = 0;
    this.releaseLeft = 0;
    this.followLeft = 0;
    this.recoverLeft = 0;
    this.aimX = 0;
    this.aimY = 0.15;
    this.lastUrgentTick = URGENT_SECONDS + 1;
    this.freezeLeft = 0;
    this.freezeCd = 0;
    this.freezeHold = 0;
    this.freezeFound = false;
    this.inputVia = this.checkMode ? "pointer" : "webcam";
    this.stones = [];
    this.hitLog = [];
    this.queued = null;
    this.throwCool = 0;
    this.hitStop = 0;
    this.absentHold = 0;
    this.audio.play("start");
    this.audio.startBeat();
  }

  private abortRound(message: string): void {
    this.audio.stopBeat();
    this.roundOpen = false;
    this.playStart = 0;
    this.phase = "attract";
    this.stones = [];
    this.combo = 0;
    this.comboTimer = 0;
    this.freezeLeft = 0;
    this.freezeHold = 0;
    this.freezeCd = 0;
    this.absentHold = 0;
    this.handsHold = 0;
    this.handsHold = 0;
    this.throwCool = 0;
    this.hitStop = 0;
    this.armed = false;
    this.queued = null;
    this.banner = message;
    this.bannerLife = 3.2;
    this.pushUi(true);
  }

  private triggerFreeze(): void {
    if (this.phase !== "play" || this.freezeCd > 0 || this.freezeLeft > 0) return;
    this.freezeLeft = 2;
    this.freezeCd = 8;
    this.freezeHold = 0;
    this.freezeCritUsed = false;
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
    if (this.checkMode) return true;
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
    this.audio.stopBeat();
    this.phase = "attract";
    this.handsHold = 0;
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
    this.absentHold = 0;
    this.banner = null;
    this.queued = null;
    this.pushUi(true);
  }

  private finishRound(): void {
    if (this.phase === "result") return;
    this.audio.stopBeat();
    this.phase = "result";
    this.monthRank = 0;
    this.naming = false;
    this.savedName = null;
    this.resultAcc = 0;
    this.vacantHold = 0;
    this.stones = [];
    this.queued = null;
    this.timeLeft = 0;
    if (this.roundOpen) {
      this.roundOpen = false;
      if (this.checkMode) {
        this.resultRank = 0;
      } else {
        const saved = addScore(this.score, "webcam");
        this.scores = saved.list;
        this.resultRank = saved.rank;
        this.monthRank = saved.monthRank;
        this.resultAt = saved.at;
        this.naming = qualifiesForName(saved.monthRank, this.score);
        this.namingLeft = NAME_ENTRY_SECONDS;
      }
    }
    this.audio.play("end");
    this.pushUi(true);
  }

  private launch(ev: ThrowEvent, demo = false, immediate = false): boolean {
    const live = this.phase === "play" || this.phase === "practice";
    if (!demo && !live) return false;
    if (!demo && (this.throwCool > 0 || this.queued || this.followLeft > 0)) return false;
    if (this.stones.length >= MAX_STONES) return false;
    if (!demo) ev = this.assistAim(ev);
    this.aimX = ev.aimX;
    this.aimY = ev.aimY;
    this.charge = 0;
    this.throwCool = demo ? 0.35 : 0.36;
    this.queued = { ev, demo };
    this.releaseLeft = demo || immediate ? 0 : 0.08;
    if (this.releaseLeft <= 0) this.releaseQueued(0);
    if (!demo && this.phase === "practice") {
      this.practiceThrows += 1;
      if (this.practiceThrows >= PRACTICE_THROWS) this.practiceLeft = 1.4;
    }
    return true;
  }

  /** 아이용 보정: 급소가 열렸을 때 이마 근처를 노리면 이마로 붙인다. */
  private assistAim(ev: ThrowEvent): ThrowEvent {
    if (!this.critOpen()) return ev;
    const F = GOLIATH_LOCAL.forehead;
    const fx = this.goliathX + F.x;
    const fy = 70 + this.goliathBob + F.y;
    const p = aimPoint(ev.aimX, ev.aimY);
    if (Math.hypot(p.x - fx, (p.y - fy) * 1.3) > AIM_ASSIST_PX) return ev;
    return {
      ...ev,
      aimX: Math.max(-1, Math.min(1, (fx - WORLD_W / 2) / 280)),
      aimY: Math.max(-1, Math.min(1, (fy - AIM_Y_ORIGIN) / AIM_Y_SPAN)),
    };
  }

  private decayThrow(dt: number): void {
    if (this.followLeft > 0) {
      this.followLeft = Math.max(0, this.followLeft - dt);
      if (this.followLeft === 0) this.recoverLeft = 0.18;
    } else if (this.recoverLeft > 0) {
      this.recoverLeft = Math.max(0, this.recoverLeft - dt);
    }
    this.throwCool = Math.max(0, this.throwCool - dt);
  }

  private releaseQueued(dt: number): void {
    if (!this.queued) return;
    this.releaseLeft -= dt;
    if (this.releaseLeft > 0) return;
    const { ev, demo } = this.queued;
    this.queued = null;
    const flight = stoneFlight(ev.aimX, ev.aimY, ev.power, "throw", 0, this.time);
    this.stones.push({
      x: flight.originX,
      y: flight.originY,
      vx: flight.vx,
      vy: flight.vy,
      rot: 0,
      spin: (Math.random() - 0.5) * 10,
      live: true,
      age: 0,
      flightT: flight.t,
      aimX: ev.aimX,
      aimY: ev.aimY,
    });
    this.followLeft = 0.15;
    this.recoverLeft = 0;
    if (!demo) this.audio.play("throw");
  }

  private breakCombo(): void {
    this.combo = 0;
    this.comboTimer = 0;
  }

  private stepStones(dt: number): void {
    for (const s of this.stones) {
      if (!s.live) continue;
      const x0 = s.x;
      const y0 = s.y;
      const vy0 = s.vy;
      s.vy = vy0 + GRAVITY * dt;
      s.x = x0 + s.vx * dt;
      s.y = y0 + vy0 * dt + 0.5 * GRAVITY * dt * dt;
      s.age += dt;
      s.rot += s.spin * dt;
      if (s.y > WORLD_H + 40 || s.x < -80 || s.x > WORLD_W + 80 || s.y < -120) {
        s.live = false;
        if (this.phase === "play") this.breakCombo();
        continue;
      }
      this.collide(s, x0, y0, dt);
    }
    this.stones = this.stones.filter((s) => s.live);
  }

  /** 화면 좌표를 골리앗 그림과 같은 로컬 좌표로 되돌린다. */
  private worldToLocal(wx: number, wy: number): { x: number; y: number } {
    const angle = goliathAngle(this.stagger, this.downed, this.shieldUp, this.lean);
    const fy = GOLIATH_LOCAL.foot.y;
    const gy = 70 + this.goliathBob;
    const vx = wx - this.goliathX;
    const vy = wy - (gy + fy);
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const px = ca * vx + sa * vy;
    const py = -sa * vx + ca * vy;
    return {
      x: px - (this.downed ? 40 : 0),
      y: py + fy - (this.downed ? 80 : 0),
    };
  }

  private collide(s: Stone, x0: number, y0: number, dt: number): void {
    const a0 = this.worldToLocal(x0, y0);
    const a1 = this.worldToLocal(s.x, s.y);
    const aimW = aimPoint(s.aimX, s.aimY);
    const aim = this.worldToLocal(aimW.x, aimW.y);
    const F = GOLIATH_LOCAL.forehead;
    const H = GOLIATH_LOCAL.helmet;
    const sh = shieldLocal(this.shieldUp, this.shieldWarn);
    const T = GOLIATH_LOCAL.torso;
    const L = GOLIATH_LOCAL.legs;
    const age0 = s.age - dt;
    const inEll = (x: number, y: number, cx: number, cy: number, erx: number, ery: number) => {
      const nx = (x - cx) / erx;
      const ny = (y - cy) / ery;
      return nx * nx + ny * ny <= 1;
    };
    const aimedFore = inEll(aim.x, aim.y, F.x, F.y, F.rx + 16, F.ry + 12);
    const aimedHead = Math.hypot(aim.x - H.x, aim.y - H.y) <= H.r;
    const aimedTorso = Math.abs(aim.x - T.x) <= T.w / 2 && Math.abs(aim.y - T.y) <= T.h / 2;
    const aimedLegs = Math.abs(aim.x - L.x) <= L.w / 2 && Math.abs(aim.y - L.y) <= L.h / 2;
    const aimedShield = Math.hypot(aim.x - sh.x, aim.y - sh.y) <= sh.r + STONE_R;
    const falling = s.vy > 80 && s.age > s.flightT;
    const hits: { t: number; part: HitPart }[] = [];
    const add = (t: number | null, part: HitPart, aimed: boolean) => {
      if (t === null) return;
      const hitAge = age0 + t * dt;
      const raised = part === "방패" && this.shieldUp;
      if (!raised) {
        if (!aimed && !falling) return;
        if (!falling && hitAge < s.flightT * 0.55) return;
      }
      hits.push({ t, part });
    };
    add(segmentHitsCircle(a0.x, a0.y, a1.x, a1.y, sh.x, sh.y, sh.r + STONE_R), "방패", aimedShield);
    add(segmentHitsEllipse(a0.x, a0.y, a1.x, a1.y, F.x, F.y, F.rx + 16, F.ry + 12), "이마", aimedFore || aimedHead);
    add(segmentHitsCircle(a0.x, a0.y, a1.x, a1.y, H.x, H.y, H.r + STONE_R), "투구", aimedFore || aimedHead);
    add(segmentHitsBox(a0.x, a0.y, a1.x, a1.y, T.x, T.y, T.w, T.h, 16, 12), "몸통", aimedTorso);
    add(segmentHitsBox(a0.x, a0.y, a1.x, a1.y, L.x, L.y, L.w, L.h, 16, 12), "몸통", aimedLegs);
    if (hits.length === 0) return;
    hits.sort((a, b) => a.t - b.t);
    const hit = hits[0];
    let part = hit.part;
    if ((part === "투구" || part === "이마") && aimedFore) part = this.critOpen() ? "이마" : "투구";
    else if (part === "이마") part = this.critOpen() ? "이마" : "투구";
    if (part === "이마") {
      if (this.freezeLeft > 0) this.freezeCritUsed = true;
      else this.openCritUsed = true;
    }
    const wx = x0 + (s.x - x0) * hit.t;
    const wy = y0 + (s.y - y0) * hit.t;
    const sfx = part === "방패" ? "hitShield" : part === "몸통" ? "hitSoft" : "hitHead";
    this.registerHit(part, wx, wy, sfx);
    s.live = false;
  }

  private registerHit(part: HitPart, x: number, y: number, sfx: "hitSoft" | "hitShield" | "hitHead"): void {
    const kind = part === "이마" ? "crit" : part === "투구" ? "good" : part === "방패" ? "bad" : "ok";
    const label = part === "이마" ? "크리티컬!" : part === "투구" ? "좋아!" : part === "방패" ? "막힘" : "명중";
    if (this.phase === "practice") {
      this.hitFlash = 0.45;
      this.hitLog.push({ part, gained: 0 });
      this.floaters.push({ x, y, life: 0.8, maxLife: 0.8, text: label, color: "#fff4dc", kind });
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
    this.hitLog.push({ part, gained });
    this.lastHit = part;
    this.hitFlash = 0.65;
    const crit = part === "이마";
    this.stagger = crit ? 0.7 : 0.25;
    this.trauma = Math.min(0.7, this.trauma + (crit ? 0.45 : blocked ? 0.15 : 0.28));
    if (crit) this.hitStop = 0.045;
    this.rings.push({ x, y, life: crit ? 0.45 : 0.32, maxLife: crit ? 0.45 : 0.32, r: crit ? 30 : 16 });
    this.floaters.push({
      x,
      y: y - 30,
      life: crit ? 1.1 : 0.9,
      maxLife: crit ? 1.1 : 0.9,
      text: label,
      sub: `+${gained.toLocaleString("ko-KR")}`,
      color: "#fff4dc",
      kind,
    });
    this.burst(x, y, crit);
    this.audio.play(sfx);
    if (!blocked && this.combo >= 3) this.audio.play("combo");
    if (crit || part === "투구") this.damage = Math.min(3, this.damage + 1);
    if (crit) {
      this.foreheadHits += 1;
    }
  }

  private burst(x: number, y: number, big: boolean): void {
    const n = big ? 28 : 14;
    const colors = big ? ["#ffd23a", "#f24a2a", "#ffffff", "#3fb8d9"] : ["#ffd23a", "#ffffff", "#ff8a1f"];
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
        size: big && i % 4 === 0 ? 6 + Math.random() * 3 : 2 + Math.random() * 3,
        color: colors[i % colors.length],
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
    this.goliathBob = Math.sin(this.time * 1.7) * 6;
    if (this.freezeLeft > 0) {
      this.wasFrozen = true;
      this.shieldUp = false;
      this.shieldWarn = false;
      this.lean = 0;
      return;
    }
    if (this.wasFrozen) {
      this.wasFrozen = false;
      this.aiPhase = "rest";
      this.aiT = 0;
      this.restFrom = this.goliathX;
      this.shieldUp = false;
      this.shieldWarn = false;
      this.openCritUsed = true;
    }
    if (this.downed) {
      this.downedLife = Math.max(0, this.downedLife - dt);
      if (this.downedLife <= 0) this.downed = false;
      this.shieldUp = false;
      this.shieldWarn = false;
      return;
    }
    if (this.phase !== "play" && this.phase !== "practice") {
      this.shieldUp = false;
      this.shieldWarn = false;
      this.lean = Math.sin(this.time * 0.6) * 0.02;
      return;
    }
    const elapsed = this.phase === "practice" ? 4 : Math.max(0, ROUND_SECONDS - this.timeLeft);
    let left = dt;
    let guard = 0;
    while (left > 0.0001 && guard < 6) {
      guard += 1;
      const need = Math.max(0.0001, this.phaseSeconds(elapsed) - this.aiT);
      const step = Math.min(left, need);
      this.aiT += step;
      left -= step;
      if (this.aiT >= this.phaseSeconds(elapsed) - 0.0001) {
        this.advanceAct(elapsed);
        this.aiT = 0;
      }
    }
    this.applyActPose(elapsed);
    this.aiPhaseName = this.aiPhase;
    this.aiActName = this.aiAct;
  }

  private phaseSeconds(elapsed: number): number {
    const band = combatBand(elapsed);
    if (this.aiPhase === "rest") return 0.35;
    if (this.aiPhase === "tell") return band.tell;
    if (this.aiPhase === "act") {
      if (this.aiAct === "guard") return 0.85;
      if (this.aiAct === "left" || this.aiAct === "right") return 0.35;
      return 0.75;
    }
    return band.open;
  }

  private advanceAct(elapsed: number): void {
    if (this.aiPhase === "rest") {
      this.aiAct = this.pickAct(elapsed);
      this.aiPhase = "tell";
      this.dodgeFrom = this.goliathX;
      const band = combatBand(elapsed);
      const dir = this.aiAct === "left" ? -1 : this.aiAct === "right" ? 1 : 0;
      this.dodgeTo = Math.max(180, Math.min(WORLD_W - 180, this.goliathX + dir * band.dodgeDist));
      return;
    }
    if (this.aiPhase === "tell") {
      this.aiPhase = "act";
      return;
    }
    if (this.aiPhase === "act") {
      if (this.aiAct === "left" || this.aiAct === "right") this.goliathX = this.dodgeTo;
      if (this.aiAct === "idle") {
        this.aiPhase = "rest";
        this.restFrom = this.goliathX;
        return;
      }
      this.aiPhase = "open";
      this.openCritUsed = false;
      return;
    }
    this.aiPhase = "rest";
    this.restFrom = this.goliathX;
    this.shieldUp = false;
    this.shieldWarn = false;
  }

  private pickAct(elapsed: number): GoliathAct {
    if (this.phase === "play" && elapsed < 2) return "idle";
    const band = combatBand(elapsed);
    let idle = band.idle;
    let guard = band.guard;
    let left = band.dodge / 2;
    let right = band.dodge / 2;
    if (this.goliathX - band.dodgeDist < 180) {
      idle += left;
      left = 0;
    }
    if (this.goliathX + band.dodgeDist > WORLD_W - 180) {
      idle += right;
      right = 0;
    }
    if (this.interruptStreak >= 2 && this.lastInterrupt === "guard") {
      idle += guard;
      guard = 0;
    }
    if (this.interruptStreak >= 2 && this.lastInterrupt === "left") {
      idle += left;
      left = 0;
    }
    if (this.interruptStreak >= 2 && this.lastInterrupt === "right") {
      idle += right;
      right = 0;
    }
    const bag: [GoliathAct, number][] = [
      ["idle", idle],
      ["guard", guard],
      ["left", left],
      ["right", right],
    ];
    const sum = bag.reduce((acc, [, w]) => acc + Math.max(0, w), 0);
    let r = this.nextRand() * Math.max(0.0001, sum);
    let act: GoliathAct = "idle";
    for (const [name, w] of bag) {
      if (w <= 0) continue;
      r -= w;
      if (r < 0) {
        act = name;
        break;
      }
    }
    if (act === "idle") this.interruptStreak = 0;
    else if (act === this.lastInterrupt) this.interruptStreak += 1;
    else this.interruptStreak = 1;
    if (act !== "idle") this.lastInterrupt = act;
    return act;
  }

  private applyActPose(elapsed: number): void {
    const u = Math.max(0, Math.min(1, this.aiT / Math.max(0.01, this.phaseSeconds(elapsed))));
    this.shieldUp = false;
    this.shieldWarn = false;
    this.lean = 0;
    if (this.aiAct === "guard" && this.aiPhase === "tell") {
      this.shieldWarn = true;
      this.lean = -0.03 * u;
    }
    if (this.aiAct === "guard" && this.aiPhase === "act") {
      this.shieldUp = true;
      this.lean = -0.04;
    }
    if (this.aiAct === "left" || this.aiAct === "right") {
      const dir = this.aiAct === "left" ? -1 : 1;
      if (this.aiPhase === "tell") {
        this.lean = dir * 0.045 * u;
        this.goliathX = this.dodgeFrom + dir * 18 * u;
      } else if (this.aiPhase === "act") {
        this.lean = dir * 0.03;
        this.goliathX = this.dodgeFrom + (this.dodgeTo - this.dodgeFrom) * u;
      } else if (this.aiPhase === "open") {
        this.lean = dir * 0.015;
        this.goliathX = this.dodgeTo;
      }
    }
    if (this.aiPhase === "rest") {
      this.goliathX = this.restFrom + (WORLD_W / 2 - this.restFrom) * u;
    }
    if (this.aiPhase === "open") this.shieldUp = false;
  }

  private nextRand(): number {
    let s = this.rngState | 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    this.rngState = s;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private critOpen(): boolean {
    if (this.freezeLeft > 0) return !this.freezeCritUsed;
    return this.aiPhase === "open" && !this.openCritUsed;
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
      snap.sound,
      snap.confirmReset ? 1 : 0,
      snap.banner ?? "",
      snap.motionHint,
      snap.poseReady ? 1 : 0,
      snap.modelState,
      snap.modelError ?? "",
      snap.armed ? 1 : 0,
      snap.cameraError ?? "",
      snap.freezeFound ? 1 : 0,
      snap.checkMode ? 1 : 0,
      Math.ceil(snap.freezeLeft * 5),
      snap.inputVia,
      snap.verse.ref,
      snap.scores.length,
      snap.naming ? 1 : 0,
      snap.savedName ?? "",
      Math.round(snap.handsUpProgress * 20),
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
      monthRank: this.monthRank,
      naming: this.naming,
      savedName: this.savedName,
      scores: this.scores,
      muted: this.audio.muted,
      sound: this.audio.state,
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
      checkMode: this.checkMode,
      handsUpProgress: this.handsUpProgress,
    };
  }

  private goliathPose(): GoliathPose {
    if (this.hitFlash > 0.05 || this.stagger > 0.15) return "hit";
    if (this.shieldUp) return "guard";
    if (this.shieldWarn) return "warn";
    return "idle";
  }

  private davidPose(): DavidPose {
    if (this.freezeLeft > 0 && (this.phase === "play" || this.phase === "practice")) return "focus";
    if (this.followLeft > 0 || this.queued) return "throw";
    if (this.recoverLeft > 0) return "recover";
    if ((this.armed || this.pointerHolding) && this.charge > 0.55) return "spin";
    if (this.armed || this.pointerHolding || this.charge > 0.18) return "ready";
    return "idle";
  }

  private motionHint(): string {
    if (this.checkMode && this.cameraState !== "live") {
      if (this.phase === "practice") return "화면을 위로 밀어 던지세요";
      if (this.phase === "play") {
        if (this.freezeLeft > 0) return "골리앗이 멈췄습니다";
        return "위로 밀어 던지고, 길게 누르면 집중";
      }
      if (this.phase === "start") return "연습 던지기를 누르세요";
      if (this.phase === "countdown") return "";
    }
    if (this.cameraState === "loading") return "카메라를 켜는 중";
    if (this.cameraState === "denied") return this.cameraError || "카메라 권한을 허용해 주세요";
    if (this.cameraState !== "live") return "카메라를 켜 주세요";
    if (this.modelState === "loading") return "카메라는 켜졌습니다. 모션을 준비하는 중";
    if (this.modelState === "failed") return this.modelError || "모션을 다시 준비해 주세요";
    if (!this.poseReady) return "모션이 준비되면 시작할 수 있습니다";
    if (!this.personPresent) return "카메라 앞에 상반신이 나오게 서 주세요";
    if (this.tooFar) return "조금 더 앞으로 와 주세요";
    if (this.lowInFrame && this.phase !== "play") return "한 걸음 뒤로 서 주세요. 몸이 화면 아래로 잘려요";
    if (this.offCenter && this.phase !== "play") return "화면 가운데로 와 주세요";
    if (this.phase === "start" || this.phase === "attract") return "양손을 머리 위로 번쩍! 1초 유지하면 시작";
    if (this.phase === "practice") {
      if (this.armed) return "좋아요! 이제 앞으로 힘껏 던지세요";
      return `손을 머리 위로 들었다가 앞으로 던지세요 (${this.practiceThrows}/${PRACTICE_THROWS})`;
    }
    if (this.phase === "play") {
      if (this.freezeLeft > 0) return "골리앗이 멈췄습니다";
      if (this.critOpen()) return "금빛이 보일 때 이마를 노려요";
      if (this.shieldWarn) return "방패가 올라옵니다";
      if (this.shieldUp) return "방패를 피하세요";
      if (this.aiAct === "left") return "왼쪽으로 피합니다";
      if (this.aiAct === "right") return "오른쪽으로 피합니다";
      if (this.armed) return "던지세요!";
      return "손을 든 높이로 돌이 날아갑니다";
    }
    return "";
  }
}
