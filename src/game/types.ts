import type { DavidPose, GoliathPose } from "./art";
import type { Verse } from "./verses";
import type { ScoreRecord } from "./scores";

export type Phase =
  "boot" | "attract" | "start" | "practice" | "countdown" | "play" | "ko" | "result";
export type CameraState = "off" | "loading" | "live" | "denied";
export type ModelState = "off" | "loading" | "ready" | "failed";

export type Stone = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  spin: number;
  live: boolean;
  age: number;
  flightT: number;
  aimX: number;
  aimY: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
};

export type Floater = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  /** 판정 글자 종류. 없으면 안내 글자. */
  kind?: "crit" | "good" | "ok" | "bad" | "info";
  sub?: string;
};

export type Ring = {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  r: number;
};

export type GameSim = {
  phase: Phase;
  time: number;
  goliathX: number;
  goliathBob: number;
  shieldUp: boolean;
  shieldWarn: boolean;
  hitFlash: number;
  stagger: number;
  throwAnim: number;
  charge: number;
  shakeX: number;
  shakeY: number;
  stones: Stone[];
  particles: Particle[];
  floaters: Floater[];
  rings: Ring[];
  damage: number;
  armed: boolean;
  aimX: number;
  aimY: number;
  lean: number;
  critOpen: boolean;
  downed: boolean;
  sightX: number;
  freezeLeft: number;
  goliathPose: GoliathPose;
  davidPose: DavidPose;
  /** 골리앗 체력 비율 0~1. */
  hpRatio: number;
  fever: boolean;
  /** 쓰러지는 연출이 시작된 뒤 지난 초. KO가 아니면 -1. */
  koT: number;
  /** 다윗 좌우 위치(월드 px, 가운데 0). 플레이어 몸을 따라 움직인다. */
  davidShift: number;
  /** 날아오는 창. 없으면 null. */
  spear: SpearSim | null;
};

export type SpearSim = {
  stage: "tell" | "fly" | "stuck";
  /** 이 단계에서 지난 비율 0~1. */
  k: number;
  /** 창이 떨어질 땅 x(월드). */
  targetX: number;
  /** 피했는지(stuck 단계에서만 의미). */
  dodged: boolean;
};

export type UiSnap = {
  phase: Phase;
  score: number;
  combo: number;
  maxCombo: number;
  timeLeft: number;
  countdown: number;
  verse: Verse;
  personPresent: boolean;
  cameraState: CameraState;
  lastHit: string | null;
  resultRank: number;
  monthRank: number;
  naming: boolean;
  savedName: string | null;
  scores: ScoreRecord[];
  muted: boolean;
  /** 브라우저 소리 상태. blocked면 화면을 한 번 눌러야 들린다. */
  sound: "none" | "running" | "blocked";
  confirmReset: boolean;
  banner: string | null;
  motionHint: string;
  poseReady: boolean;
  modelState: ModelState;
  modelError: string | null;
  armed: boolean;
  cameraError: string | null;
  foreheadHits: number;
  comboLeft: number;
  bestScore: number;
  freezeLeft: number;
  freezeCd: number;
  freezeFound: boolean;
  inputVia: "webcam" | "pointer";
  checkMode: boolean;
  /** 양손 번쩍 유지 정도 0..1. */
  handsUpProgress: number;
  /** 처음 화면으로 돌아가기 동작 진행(0~1). */
  homeProgress: number;
  /** 카운트다운 중인데 카메라에 사람이 안 보여 기다리는 중. */
  waitingForPlayer: boolean;
  /** 골리앗 체력 비율 0~1. */
  hpRatio: number;
  fever: boolean;
  /** 이번 판에 골리앗을 쓰러뜨렸나(KO 연출 중·결과 화면). */
  won: boolean;
  koBonus: number;
  /** 창 예고 중(피하라는 안내). */
  spearWarn: boolean;
  dodges: number;
  giant: { hp: number; max: number; plays: number; defeated: number };
  /** 이번 판 점수가 거대 골리앗에게 준 피해, 이번 판으로 쓰러뜨렸는지. */
  giantHit: number;
  giantKoNow: boolean;
};
