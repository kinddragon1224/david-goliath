import { davidSlingWorld, GOLIATH_LOCAL, type DavidPose } from "./art";
import { GRAVITY, WORLD_W } from "./constants";

export const RULESET_VERSION = 2;
export const STONE_R = 14;

export type HitPart = "이마" | "투구" | "몸통" | "방패";
export type GoliathAct = "idle" | "guard" | "left" | "right";

const BASE: Record<HitPart, number> = {
  이마: 1000,
  투구: 250,
  몸통: 100,
  방패: 20,
};

export function comboMultiplier(combo: number): number {
  if (combo >= 6) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

/** 이마는 열린 급소 명중 1,000점. 투구는 일반 머리 250점. */
export function hitPoints(part: HitPart, combo: number): number {
  return Math.round(BASE[part] * comboMultiplier(combo));
}

export type CombatBand = {
  idle: number;
  guard: number;
  dodge: number;
  tell: number;
  dodgeDist: number;
  open: number;
};

export function combatBand(elapsed: number): CombatBand {
  if (elapsed < 8) return { idle: 0.45, guard: 0.35, dodge: 0.2, tell: 0.55, dodgeDist: 80, open: 1.2 };
  if (elapsed < 20) return { idle: 0.25, guard: 0.4, dodge: 0.35, tell: 0.45, dodgeDist: 110, open: 1.0 };
  return { idle: 0.15, guard: 0.4, dodge: 0.45, tell: 0.35, dodgeDist: 140, open: 0.9 };
}

export function goliathAngle(stagger: number, downed: boolean, guard = false, lean = 0): number {
  const down = downed ? 1 : 0;
  const hit = -0.12 * Math.min(1, Math.max(0, stagger)) - 0.18 * down;
  const brace = guard ? -0.03 : 0;
  return hit + brace + lean;
}

export function worldFromGoliath(
  gx: number,
  gy: number,
  stagger: number,
  downed: boolean,
  lx: number,
  ly: number,
  guard = false,
  lean = 0,
): { x: number; y: number } {
  const a = goliathAngle(stagger, downed, guard, lean);
  const ox = GOLIATH_LOCAL.foot.x;
  const oy = GOLIATH_LOCAL.foot.y;
  const px = lx - ox + (downed ? 40 : 0);
  const py = ly - oy + (downed ? 80 : 0);
  return {
    x: gx + ox + Math.cos(a) * px - Math.sin(a) * py,
    y: gy + oy + Math.sin(a) * px + Math.cos(a) * py,
  };
}

const AIM_X_SPAN = 280;
/** aimY 0은 몸통, aimY -1은 이마. 골리앗 좌표를 더하지 않는다. */
export const AIM_Y_ORIGIN = 670;
export const AIM_Y_SPAN = 340;

export function aimPoint(aimX: number, aimY: number): { x: number; y: number } {
  const x = Math.max(-1, Math.min(1, aimX));
  const y = Math.max(-1, Math.min(1, aimY));
  return { x: WORLD_W / 2 + x * AIM_X_SPAN, y: AIM_Y_ORIGIN + y * AIM_Y_SPAN };
}

/** 조준점은 플레이어가 정한 자리만 본다. 골리앗 위치는 넣지 않는다. */
export function stoneFlight(
  aimX: number,
  aimY: number,
  power: number,
  pose: DavidPose = "idle",
  charge = 0,
  time = 0,
) {
  const target = aimPoint(aimX, aimY);
  const origin = davidSlingWorld(pose, aimX, charge, time);
  const t = 0.62 - Math.max(0.25, Math.min(1, power)) * 0.08;
  const vx = (target.x - origin.x) / t;
  const vy = (target.y - origin.y) / t - 0.5 * GRAVITY * t;
  return { vx, vy, targetX: target.x, targetY: target.y, t, originX: origin.x, originY: origin.y };
}

export function segmentHitsCircle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  r: number,
): number | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (a < 1e-6) return c <= 0 ? 0 : null;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  if (t1 >= 0 && t1 <= 1) return t1;
  const t2 = (-b + s) / (2 * a);
  if (t2 >= 0 && t2 <= 1) return t2;
  return null;
}

export function segmentHitsEllipse(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): number | null {
  const sy = rx / Math.max(1, ry);
  return segmentHitsCircle(x0, y0 * sy, x1, y1 * sy, cx, cy * sy, rx);
}

export function segmentHitsBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  padX: number,
  padY = padX,
): number | null {
  const left = cx - w / 2 - padX;
  const right = cx + w / 2 + padX;
  const top = cy - h / 2 - padY;
  const bottom = cy + h / 2 + padY;
  const dx = x1 - x0;
  const dy = y1 - y0;
  let t0 = 0;
  let t1 = 1;
  const slabs: [number, number][] = [
    [-dx, x0 - left],
    [dx, right - x0],
    [-dy, y0 - top],
    [dy, bottom - y0],
  ];
  for (const [p, q] of slabs) {
    if (Math.abs(p) < 1e-8) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  if (t0 > t1) return null;
  return t0;
}
