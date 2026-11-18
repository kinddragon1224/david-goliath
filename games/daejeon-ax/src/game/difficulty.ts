import { CONFIG } from '../config';
import { PRESETS, type Curve } from './config/presets';

const D = CONFIG.difficulty;
// 판정 반지름은 가장 엄격한 값으로 잡는다(난이도에 따라 더 너그러울 수는 있어도 더 엄격하지는 않다)
const MAX_HIT_RADIUS = CONFIG.meteor.radiusMax * CONFIG.meteor.hitScale + CONFIG.player.radius;

/** 스테이지(단계): 스테이지 길이마다 하나씩 오른다 */
export const levelAt = (t: number) => Math.floor(Math.max(0, t) / D.stepSec);

/** 난이도 곡선 하나에 대한 계산 함수 묶음 */
export function curveOf(c: Curve) {
  const speedAt = (level: number) => Math.min(c.speedMax, c.speedBase + c.speedStep * level);
  const gapAt = (level: number) => Math.max(c.gapMin, c.gapBase * c.gapDecay ** level);
  const densityAt = (level: number) => Math.min(c.densityMax, c.densityBase + c.densityStep * level);
  /** 다음 웨이브까지의 거리. 모든 운석이 같은 속도로 움직이므로 순서와 간격이 유지된다. */
  const spacingAt = (level: number) => speedAt(level) * gapAt(level);
  /**
   * 앞 웨이브가 지나간 뒤 다음 웨이브가 닿기 전까지 옮겨갈 수 있는 레인 수.
   * 그 사이 단계가 올라 속도가 빨라지는 최악의 경우(level + 1)로 계산한다.
   */
  const maxShiftFor = (spacing: number, level: number) =>
    Math.max(0, Math.floor((c.lanesPerSec * (spacing - 2 * MAX_HIT_RADIUS)) / speedAt(level + 1)));
  return { speedAt, gapAt, densityAt, spacingAt, maxShiftFor };
}

export type CurveFns = ReturnType<typeof curveOf>;

/** 기본 난이도의 곡선 */
export const { speedAt, gapAt, densityAt, spacingAt, maxShiftFor } = curveOf(PRESETS[D.default]);
