/** 난이도 곡선: 스테이지(단계)가 오를 때마다 속도·간격·밀도가 어떻게 변하는지 */
export interface Curve {
  speedBase: number;
  speedStep: number;
  speedMax: number;
  /** 운석 웨이브 생성 간격(초) */
  gapBase: number;
  /** 단계마다 간격에 곱함 */
  gapDecay: number;
  gapMin: number;
  /** 웨이브에서 막히는 레인 비율 */
  densityBase: number;
  densityStep: number;
  densityMax: number;
  /** 사람이 1초에 옮겨갈 수 있다고 보는 레인 수(피할 길 보장의 기준). 클수록 더 빠른 반응을 요구한다 */
  lanesPerSec: number;
}

export interface Preset extends Curve {
  name: string;
  /** 선택 화면에 보이는 한 줄 설명 */
  note: string;
  lives: number;
  /** 운석 판정 크기 배율(작을수록 너그러움) */
  hitScale: number;
  /** 튜토리얼 스테이지의 운석 간격 배율 */
  tutorialGap: number;
  /** 웨이브에 별 조각이 놓일 확률. 별은 안전한 줄에 놓이므로 낮을수록 길을 스스로 읽어야 한다 */
  starChance: number;
  /** 음식이 나오는 간격 배율(클수록 드물게) */
  foodEvery: number;
  /** 손들기 보호막의 쿨다운(초) */
  shieldCooldownSec: number;
  // ── 랜덤 요소 ──
  /** 예고 없이 돌발 이벤트가 터지는 평균 간격(초). 0 이면 스테이지에 예정된 것만 */
  randomEventSec: number;
  /** 이벤트가 없을 때에도 웨이브가 휘어 올 확률 */
  bendChance: number;
  /** 웨이브 간격이 들쭉날쭉한 정도(0.3 이면 ±30%) */
  spacingJitter: number;
}

export type DifficultyId = 'easy' | 'normal' | 'hard';

/**
 * 난이도 3종. 하트 수는 모두 같고, 빠르기·운석의 양·랜덤 요소로 차이를 둔다.
 * 스테이지 12개(단계 0~11)를 기준으로 마지막 스테이지에서 한계값에 닿도록 잡았다.
 * 스테이지 수를 바꾸면 speedStep·gapDecay·densityStep 도 함께 조정할 것(테스트가 확인한다).
 */
export const PRESETS: Record<DifficultyId, Preset> = {
  easy: {
    name: '이지', note: '천천히 · 규칙적으로', lives: 3, hitScale: 0.85, tutorialGap: 1.5,
    speedBase: 24, speedStep: 1.6, speedMax: 41,
    gapBase: 1.1, gapDecay: 0.965, gapMin: 0.75,
    densityBase: 0.2, densityStep: 0.037, densityMax: 0.6,
    lanesPerSec: 2.2, starChance: 0.6, foodEvery: 1, shieldCooldownSec: 10,
    randomEventSec: 0, bendChance: 0, spacingJitter: 0,
  },
  normal: {
    name: '노멀', note: '빠르게 · 돌발 이벤트', lives: 3, hitScale: 0.95, tutorialGap: 1.3,
    speedBase: 32, speedStep: 2.8, speedMax: 62,
    gapBase: 0.9, gapDecay: 0.948, gapMin: 0.5,
    densityBase: 0.3, densityStep: 0.046, densityMax: 0.8,
    lanesPerSec: 2.6, starChance: 0.4, foodEvery: 1.3, shieldCooldownSec: 16,
    randomEventSec: 15, bendChance: 0.15, spacingJitter: 0.25,
  },
  hard: {
    name: '하드', note: '아주 빠르게 · 예측 불가', lives: 3, hitScale: 1, tutorialGap: 1.55,
    speedBase: 38, speedStep: 3.2, speedMax: 72,
    gapBase: 0.8, gapDecay: 0.945, gapMin: 0.43,
    densityBase: 0.4, densityStep: 0.037, densityMax: 0.8,
    lanesPerSec: 3.2, starChance: 0.25, foodEvery: 1.7, shieldCooldownSec: 24,
    randomEventSec: 9, bendChance: 0.3, spacingJitter: 0.4,
  },
};
