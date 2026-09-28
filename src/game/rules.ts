import { davidSlingWorld, GOLIATH_LOCAL, type DavidPose } from "./art";
import { AIM_SPREAD, GOLIATH_BASE_Y, GRAVITY } from "./constants";

export type HitPart = "이마" | "투구" | "몸통" | "방패";

const BASE: Record<HitPart, number> = {
  이마: 500,
  투구: 250,
  몸통: 100,
  방패: 20,
};

export function comboMultiplier(combo: number): number {
  if (combo >= 6) return 2;
  if (combo >= 3) return 1.5;
  return 1;
}

export function hitPoints(part: HitPart, combo: number): number {
  const crit = part === "이마" ? 2 : 1;
  return Math.round(BASE[part] * crit * comboMultiplier(combo));
}

export function goliathAngle(stagger: number, downed: boolean, guard = false): number {
  const down = downed ? 1 : 0;
  const hit = -0.16 * Math.min(1, Math.max(0, stagger)) - 0.22 * down;
  const brace = guard ? 0.06 : 0;
  if (hit === 0 && !brace) return 0;
  return hit + brace;
}

export function worldFromGoliath(
  gx: number,
  gy: number,
  stagger: number,
  downed: boolean,
  lx: number,
  ly: number,
  guard = false,
): { x: number; y: number } {
  const a = goliathAngle(stagger, downed, guard);
  const ox = GOLIATH_LOCAL.foot.x;
  const oy = GOLIATH_LOCAL.foot.y;
  const px = lx - ox + (downed ? 40 : 0);
  const py = ly - oy + (downed ? 80 : 0);
  return {
    x: gx + ox + Math.cos(a) * px - Math.sin(a) * py,
    y: gy + oy + Math.sin(a) * px + Math.cos(a) * py,
  };
}

export function stoneFlight(
  goliathX: number,
  bob: number,
  aimX: number,
  power: number,
  stagger = 0,
  downed = false,
  pose: DavidPose = "idle",
  charge = 0,
  time = 0,
  guard = false,
) {
  const face = worldFromGoliath(
    goliathX,
    GOLIATH_BASE_Y + bob,
    stagger,
    downed,
    GOLIATH_LOCAL.forehead.x,
    GOLIATH_LOCAL.forehead.y,
    guard,
  );
  const steer = Math.max(-1, Math.min(1, aimX));
  const targetX = face.x + steer * AIM_SPREAD;
  const targetY = face.y;
  const origin = davidSlingWorld(pose, aimX, charge, time);
  const t = 0.78 - Math.max(0.25, Math.min(1, power)) * 0.16;
  const vx = (targetX - origin.x) / t;
  const vy = (targetY - origin.y) / t - 0.5 * GRAVITY * t;
  return { vx, vy, targetX, targetY, t, originX: origin.x, originY: origin.y };
}
