import { WORLD_W } from "./constants";

/** 태고의 달인풍 2등신 캐릭터. 그림은 전부 draw.ts에서 코드로 그린다.
 * 이 파일은 그림과 판정이 함께 쓰는 좌표만 둔다.
 */

export type GoliathPose = "idle" | "warn" | "guard" | "hit";
export type DavidPose = "idle" | "ready" | "spin" | "throw" | "recover" | "focus";

/** 골리앗 로컬 좌표. 원점 (goliathX, 70+bob), 발은 y=1320.
 * 머리가 몸만큼 큰 2등신이다. 머리 중심 (0,430) 반지름 190.
 */
export const GOLIATH_LOCAL = {
  head: { x: 0, y: 430, r: 190 },
  /** 투구 챙 아래로 드러난 이마 띠. 열렸을 때만 크리티컬. */
  forehead: { x: 0, y: 360, rx: 72, ry: 28 },
  helmet: { x: 0, y: 410, r: 205 },
  shieldX: 250,
  shieldOpenY: 850,
  shieldR: 140,
  torso: { x: 0, y: 820, w: 400, h: 360 },
  legs: { x: 0, y: 1170, w: 270, h: 280 },
  foot: { x: 0, y: 1320 },
};

/** 방어 중에는 방패가 얼굴 앞으로 올라온다. 경고 중에는 가슴 높이까지 든다. */
export function shieldLocal(up: boolean, warn: boolean): { x: number; y: number; r: number } {
  if (up) return { x: 0, y: GOLIATH_LOCAL.forehead.y + 70, r: 215 };
  if (warn) return { x: 170, y: 640, r: 150 };
  return { x: GOLIATH_LOCAL.shieldX, y: GOLIATH_LOCAL.shieldOpenY, r: GOLIATH_LOCAL.shieldR };
}

/** 다윗 발 위치와 크기. 로컬 단위에 DAVID_SCALE을 곱해 월드에 놓는다. */
export const DAVID_FOOT_WORLD = { x: WORLD_W / 2, y: 1720 };
export const DAVID_SCALE = 1.3;

/** 다윗 로컬 좌표(축척 전). 발이 원점, 위가 음수. */
export const DAVID_LOCAL = {
  head: { x: 0, y: -205, r: 92 },
  shoulder: { x: 46, y: -118 },
};

/** 자세별 물매 손 위치(로컬, 축척 전). */
function slingHand(pose: DavidPose, charge: number, time: number): { x: number; y: number } {
  if (pose === "spin") {
    const a = time * 18;
    return { x: 70 + Math.cos(a) * 20, y: -300 + Math.sin(a) * 10 };
  }
  if (pose === "ready") return { x: 92, y: -150 - charge * 90 };
  if (pose === "throw") return { x: 40, y: -310 };
  if (pose === "recover") return { x: 96, y: -200 };
  if (pose === "focus") return { x: 30, y: -110 };
  return { x: 98, y: -86 };
}

export function davidHandLocal(pose: DavidPose, charge: number, time: number): { x: number; y: number } {
  return slingHand(pose, charge, time);
}

export function davidMotion(pose: DavidPose, aimX: number, charge: number, time: number): { x: number; y: number; rot: number } {
  const aim = Math.max(-1, Math.min(1, aimX)) * 0.05;
  if (pose === "ready") return { x: 0, y: 0, rot: aim - 0.06 - charge * 0.05 };
  if (pose === "spin") return { x: -4, y: 0, rot: aim - 0.1 };
  if (pose === "throw") return { x: 10, y: -8, rot: aim + 0.1 };
  if (pose === "recover") return { x: 4, y: 0, rot: aim + 0.04 };
  if (pose === "focus") return { x: 0, y: 0, rot: 0 };
  return { x: 0, y: -Math.abs(Math.sin(time * Math.PI * 2.2)) * 10, rot: aim };
}

/** 돌이 떠나는 월드 좌표. 물매 손 위치를 몸 회전과 축척에 맞춰 옮긴다. */
export function davidSlingWorld(pose: DavidPose, aimX: number, charge: number, time: number): { x: number; y: number } {
  const motion = davidMotion(pose, aimX, charge, time);
  const hand = slingHand(pose, charge, time);
  const lx = hand.x * DAVID_SCALE;
  const ly = hand.y * DAVID_SCALE;
  const c = Math.cos(motion.rot);
  const s = Math.sin(motion.rot);
  return {
    x: DAVID_FOOT_WORLD.x + motion.x + c * lx - s * ly,
    y: DAVID_FOOT_WORLD.y + motion.y + s * lx + c * ly,
  };
}
