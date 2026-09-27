import type { Verse } from "./verses";
import type { ScoreRecord } from "./scores";

export type Phase = "boot" | "attract" | "start" | "practice" | "countdown" | "play" | "result";
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
  downed: boolean;
  sightX: number;
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
  scores: ScoreRecord[];
  muted: boolean;
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
};
