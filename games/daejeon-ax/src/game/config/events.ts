/**
 * 돌발 이벤트 정의. 시작 조건·경고·지속 시간·쿨다운·해제 조건을 모두 데이터로 둔다.
 * 한 번에 한 종류만 켜지고(events/director.ts), 보스전에서는 inBoss 가 아닌 이벤트가 중단된다.
 */
export type EventId = 'fever' | 'storm' | 'bread' | 'gravity' | 'wave' | 'fog' | 'jackpot' | 'starpower';

export interface EventDef {
  name: string;
  /** 시작할 때 뜨는 한 줄 설명 */
  hint: string;
  /**
   * 시작 조건
   *   gauge     — 피버 게이지가 가득 찼을 때
   *   schedule  — 스테이지 설정(stages.ts 의 events)에 적힌 시각
   *   bossClear — 그 이벤트가 걸린 보스 스테이지를 넘겼을 때
   */
  start: 'gauge' | 'schedule' | 'bossClear';
  /** 효과가 시작되기 전 경고 시간(초) */
  warnSec: number;
  /** 지속 시간(초). 0 이면 한 번 터지고 끝나는 즉시 이벤트 */
  sec: number;
  /** 끝난 뒤 다시 시작할 수 있을 때까지(초) */
  cooldownSec: number;
  /** 보스전에서도 계속되는지. false 면 보스 스테이지에 들어가는 순간 해제된다 */
  inBoss: boolean;
  /** 예고 없이 터지는 랜덤 이벤트로 뽑힐 가중치(노멀·하드). 0 이면 랜덤으로는 나오지 않는다 */
  random: number;
}

export const EVENTS: Record<EventId, EventDef> = {
  fever: { name: '대전 피버', hint: '8초 동안 모든 점수가 2배', start: 'gauge', warnSec: 0, sec: 8, cooldownSec: 0, inBoss: true, random: 0 },
  storm: { name: '운석 폭풍', hint: '열린 줄을 따라 좌우로 움직이세요', start: 'schedule', warnSec: 1.5, sec: 7, cooldownSec: 20, inBoss: false, random: 3 },
  bread: { name: '빵지순례', hint: '10초 동안 빵이 쏟아져요', start: 'schedule', warnSec: 0, sec: 10, cooldownSec: 30, inBoss: false, random: 1 },
  gravity: { name: '중력 이상', hint: '운석이 휘어서 날아와요 · 끝까지 보고 피하세요', start: 'schedule', warnSec: 1.2, sec: 8, cooldownSec: 20, inBoss: false, random: 3 },
  wave: { name: '갑천 파도', hint: '운석이 비스듬히 밀려와요 · 끝까지 보고 피하세요', start: 'schedule', warnSec: 1.2, sec: 8, cooldownSec: 20, inBoss: false, random: 3 },
  fog: { name: '유성온천 안개', hint: '따뜻한 김이 피어올라요', start: 'schedule', warnSec: 0, sec: 10, cooldownSec: 20, inBoss: false, random: 0 },
  jackpot: { name: '별똥별 잭팟', hint: '8초 동안 별 조각 점수 3배', start: 'schedule', warnSec: 0, sec: 8, cooldownSec: 30, inBoss: false, random: 1 },
  starpower: { name: '한빛탑 스타파워', hint: '남은 운석이 모두 별이 됐어요', start: 'bossClear', warnSec: 0, sec: 0, cooldownSec: 0, inBoss: true, random: 0 },
};

export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

export const EVENT_RULES = {
  /** 별똥별 잭팟 중 별 조각 점수 배율 */
  jackpotMultiplier: 3,
  /** 중력 이상: 운석이 출발할 때 옆으로 벗어나 있는 최대 거리(다가오면서 제 줄로 휘어 들어온다) */
  gravityBend: 3.2,
  /** 갑천 파도: 운석이 출발할 때 옆으로 밀려나 있는 거리(일정한 기울기로 제 줄에 닿는다) */
  waveDrift: 3.6,
  /** 피버 게이지가 차는 양(%) */
  gauge: { dodge: 0.8, star: 5, food: 4 },
} as const;
