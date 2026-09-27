import { AIM_SPREAD, FOREHEAD_DY, GOLIATH_BASE_Y, GRAVITY, STONE_OX, STONE_OY } from "./constants";

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

export function goliathAngle(stagger: number, downed: boolean): number {
  const down = downed ? 1 : 0;
  if (stagger <= 0 && !downed) return 0;
  return -0.08 * Math.min(1, stagger) - 0.12 * down;
}

export function worldFromGoliath(
  gx: number,
  gy: number,
  stagger: number,
  downed: boolean,
  lx: number,
  ly: number,
): { x: number; y: number } {
  const a = goliathAngle(stagger, downed);
  const px = lx + (downed ? 40 : 0);
  const py = ly + (downed ? 80 : 0);
  return {
    x: gx + Math.cos(a) * px - Math.sin(a) * py,
    y: gy + Math.sin(a) * px + Math.cos(a) * py,
  };
}

export function stoneFlight(
  goliathX: number,
  bob: number,
  aimX: number,
  power: number,
  stagger = 0,
  downed = false,
) {
  const face = worldFromGoliath(goliathX, GOLIATH_BASE_Y + bob, stagger, downed, 8, FOREHEAD_DY);
  const steer = Math.max(-1, Math.min(1, aimX));
  const targetX = face.x + steer * AIM_SPREAD;
  const targetY = face.y;
  const t = 0.82 - Math.max(0.25, Math.min(1, power)) * 0.18;
  const vx = (targetX - STONE_OX) / t;
  const vy = (targetY - STONE_OY) / t - 0.5 * GRAVITY * t;
  return { vx, vy, targetX, targetY, t, originX: STONE_OX, originY: STONE_OY };
}
