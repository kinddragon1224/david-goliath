import { WORLD_W } from "./constants";

/** 골리앗 대기 원화는 public/goliath-idle.png, 다윗 대기 원화는 public/david-idle.png.
 * 둘 다 1024×1536 원본 알파. 창·방패·물매는 몸에 붙어 있다.
 * 다윗 투척 프레임은 아직 없다.
 */

export type GoliathPose = "idle" | "warn" | "guard" | "hit";
export type DavidPose = "idle" | "ready" | "spin" | "throw" | "recover" | "focus";

export type SpriteSlot = {
  src: string | null;
  imageW: number;
  imageH: number;
  displayW: number;
  displayH: number;
  /** 이미지 픽셀 기준 발 위치. 이 점이 월드 발 앵커에 붙는다. */
  foot: { x: number; y: number };
};

/** 골리앗 로컬 좌표. 원점 (goliathX, 70+bob), 발은 y=1320.
 * 이미지 발 (506,1493), 표시 높이 1240 → 축척 1240/1536.
 */
export const GOLIATH_LOCAL = {
  forehead: { x: -15, y: 213, r: 46 },
  helmet: { x: -19, y: 253, r: 74 },
  shieldX: 249,
  shieldOpenY: 704,
  shieldWarnY: 704,
  shieldGuardY: 704,
  shieldR: 141,
  torso: { x: -29, y: 648, w: 226, h: 339 },
  legs: { x: -5, y: 1092, w: 210, h: 291 },
  foot: { x: 0, y: 1320 },
};

/** 방패는 그림에 고정되어 있다. 올라가는 별도 방패는 그리지 않는다. */
export function shieldLocal(_up: boolean, _warn: boolean): { x: number; y: number; r: number } {
  return {
    x: GOLIATH_LOCAL.shieldX,
    y: GOLIATH_LOCAL.shieldOpenY,
    r: GOLIATH_LOCAL.shieldR,
  };
}

const goliathSlot = (): SpriteSlot => ({
  src: "/goliath-idle.png",
  imageW: 1024,
  imageH: 1536,
  displayW: 827,
  displayH: 1240,
  foot: { x: 506, y: 1493 },
});

export const GOLIATH_SPRITES: Record<GoliathPose, SpriteSlot> = {
  idle: goliathSlot(),
  warn: goliathSlot(),
  guard: goliathSlot(),
  hit: goliathSlot(),
};

const DAVID_DISPLAY_H = 680;
const DAVID_DISPLAY_W = (1024 * DAVID_DISPLAY_H) / 1536;

export const DAVID_FOOT_PX = { x: 487, y: 1483 };
export const DAVID_FOOT_WORLD = { x: WORLD_W / 2, y: 1720 };
export const DAVID_SLING_PX = { x: 861, y: 1446 };
export const DAVID_CHEST_PX = { x: 500, y: 520 };

export function davidWorld(px: number, py: number): { x: number; y: number } {
  const s = DAVID_DISPLAY_H / 1536;
  return {
    x: DAVID_FOOT_WORLD.x + (px - DAVID_FOOT_PX.x) * s,
    y: DAVID_FOOT_WORLD.y + (py - DAVID_FOOT_PX.y) * s,
  };
}

const davidIdle = (): SpriteSlot => ({
  src: "/david-idle.png",
  imageW: 1024,
  imageH: 1536,
  displayW: DAVID_DISPLAY_W,
  displayH: DAVID_DISPLAY_H,
  foot: { x: DAVID_FOOT_PX.x, y: DAVID_FOOT_PX.y },
});

const davidEmpty = (): SpriteSlot => ({
  src: null,
  imageW: 1024,
  imageH: 1536,
  displayW: DAVID_DISPLAY_W,
  displayH: DAVID_DISPLAY_H,
  foot: { x: DAVID_FOOT_PX.x, y: DAVID_FOOT_PX.y },
});

export const DAVID_SPRITES: Record<DavidPose, SpriteSlot> = {
  idle: davidIdle(),
  ready: davidEmpty(),
  spin: davidEmpty(),
  throw: davidEmpty(),
  recover: davidEmpty(),
  focus: davidEmpty(),
};

/** 동작 그림이 없으면 대기 원화를 그대로 두고, 몸 전체만 기울인다. */
export function davidSprite(pose: DavidPose): SpriteSlot {
  const slot = DAVID_SPRITES[pose];
  return slot.src ? slot : DAVID_SPRITES.idle;
}

export function davidMotion(pose: DavidPose, aimX: number, charge: number, time: number): { x: number; y: number; rot: number } {
  const aim = Math.max(-1, Math.min(1, aimX)) * 0.14;
  if (pose === "ready") return { x: -8, y: -8 - charge * 10, rot: aim - 0.22 - charge * 0.1 };
  if (pose === "spin") return { x: -18, y: -30, rot: aim - 0.58 };
  if (pose === "throw") return { x: 26, y: 8, rot: aim + 0.36 };
  if (pose === "recover") return { x: 12, y: 14, rot: aim + 0.08 };
  if (pose === "focus") return { x: 0, y: 8, rot: aim * 0.2 };
  return { x: 0, y: Math.sin(time * 2.4) * 5, rot: aim };
}

export function davidSlingWorld(pose: DavidPose, aimX: number, charge: number, time: number): { x: number; y: number } {
  const motion = davidMotion(pose, aimX, charge, time);
  const rest = davidWorld(DAVID_SLING_PX.x, DAVID_SLING_PX.y);
  const lx = rest.x - DAVID_FOOT_WORLD.x;
  const ly = rest.y - DAVID_FOOT_WORLD.y;
  const c = Math.cos(motion.rot);
  const s = Math.sin(motion.rot);
  return {
    x: DAVID_FOOT_WORLD.x + motion.x + c * lx - s * ly,
    y: DAVID_FOOT_WORLD.y + motion.y + s * lx + c * ly,
  };
}

const cache = new Map<string, HTMLImageElement>();

export function spriteImage(slot: SpriteSlot): HTMLImageElement | null {
  if (!slot.src || typeof Image === "undefined") return null;
  let img = cache.get(slot.src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = slot.src;
    cache.set(slot.src, img);
  }
  if (!img.complete || img.naturalWidth === 0) return null;
  return img;
}

/** 현재 변환의 (anchorX, anchorY)에 발 앵커를 맞춘다. 이미지가 없으면 false. */
export function drawSprite(ctx: CanvasRenderingContext2D, slot: SpriteSlot, anchorX: number, anchorY: number): boolean {
  const img = spriteImage(slot);
  if (!img) return false;
  const sx = slot.displayW / slot.imageW;
  const sy = slot.displayH / slot.imageH;
  ctx.drawImage(
    img,
    anchorX - slot.foot.x * sx,
    anchorY - slot.foot.y * sy,
    slot.displayW,
    slot.displayH,
  );
  return true;
}
