export const WORLD_W = 1080;
export const WORLD_H = 1920;

export const ROUND_SECONDS = 30;
export const THROW_COOLDOWN = 0.62;
export const MAX_STONES = 6;
export const GRAVITY = 1520;

export const STONE_OX = WORLD_W / 2 + 28;
export const STONE_OY = 1568;
export const GOLIATH_BASE_Y = 70;
export const FOREHEAD_DY = 198;
export const AIM_SPREAD = 170;
export const CRIT_MULT = 2;

export const SCORE_FOREHEAD = 800;
export const SCORE_HEAD = 300;
export const SCORE_BODY = 120;
export const SCORE_SHIELD = 40;
export const SCORE_LIMB = 80;
export const SCORE_STAGGER_BONUS = 1000;

export const LEADERBOARD_KEEP = 30;
export const LEADERBOARD_SHOW = 8;
export const SCORES_KEY = "alllove-david-goliath-scores-v1";

export const CHURCH_NAME = "모두애침례교회";
export const CHURCH_NAME_SHORT = "모두애교회";
export const CHURCH_NAME_EN = "ALL LOVE CHURCH";
export const GAME_TITLE = "다윗과 골리앗";

export function stoneFlight(goliathX: number, bob: number, aimX: number, power: number) {
  const steer = Math.max(-1, Math.min(1, aimX));
  const targetX = goliathX + 8 + steer * AIM_SPREAD;
  const targetY = GOLIATH_BASE_Y + bob + FOREHEAD_DY;
  const t = 0.82 - Math.max(0.25, Math.min(1, power)) * 0.18;
  const vx = (targetX - STONE_OX) / t;
  const vy = (targetY - STONE_OY) / t - 0.5 * GRAVITY * t;
  return { vx, vy, targetX, targetY, t, originX: STONE_OX, originY: STONE_OY };
}
