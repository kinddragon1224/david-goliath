import type { PlanetType } from '../../config';
import type { EventId } from './events';
import type { FoodId } from './items';

/**
 * 보스 유형. 모두 공격 버튼 없이 좌우 회피만으로 넘길 수 있다.
 *   vortex — 소용돌이 운석: 열린 줄이 한 칸씩 돌아가는 나선 무늬, 운석이 휘어 들어온다
 *   expo   — 엑스포 우주운석: 왼쪽·오른쪽을 번갈아 쓰는 레이저와 안전 구역
 *   king   — 우주대왕운석(최종): 소용돌이·곡선 이동·레이저를 섞는다
 */
export type BossId = 'vortex' | 'expo' | 'king';

export const BOSS_NAMES: Record<BossId, string> = { vortex: '소용돌이 운석', expo: '엑스포 우주운석', king: '우주대왕운석' };

export interface StageDef {
  name: string;
  /** 이 스테이지의 배경 행성. 스테이지가 진행되는 동안 이 행성 하나만 다가왔다가 지나간다 */
  planet: PlanetType;
  /** 스테이지 이름 아래에 뜨는 한 줄 안내 */
  hint: string;
  /** 튜토리얼: 운석이 하나씩 느슨하게 */
  tutorial?: boolean;
  /** 보스 스테이지면 그 유형 */
  boss?: BossId;
  /** 보스를 넘긴 순간 터지는 이벤트(한빛탑 스타파워) */
  onClear?: EventId;
  /** 스테이지 시작 뒤 at 초에 시작하는 돌발 이벤트 */
  events?: { at: number; id: EventId }[];
  /** 옆바람 세기(단위/초). 좌우로 번갈아 분다 */
  wind?: number;
  /** 이 스테이지에 나오는 음식. 빈 배열이면 안 나오고, 생략하면 전부 나온다 */
  foods?: FoodId[];
  /** 음식이 나오는 평균 간격(초). 생략하면 ITEM_RULES.everySec */
  foodEverySec?: number;
  /** 본 여행이 끝난 뒤의 보너스 스테이지(행사 콘셉트용). 결과 화면에서 따로 표시한다 */
  bonus?: boolean;
}

/**
 * 대전역에서 출발해 대전 관광지를 도는 여행 경로. 순서가 곧 스테이지 순서다.
 * 여행지를 넣거나 빼려면 이 목록만 고치면 된다(스테이지 길이는 config.ts 의 difficulty.stepSec).
 */
export const STAGES: readonly StageDef[] = [
  { name: '대전역', planet: 'station', tutorial: true, foods: [], hint: '몸을 좌우로 움직여 운석을 피하세요' },
  { name: '으능정이 스카이로드', planet: 'skyroad', events: [{ at: 3, id: 'fever' }], foods: ['soboro', 'ramen'], foodEverySec: 8, hint: '네온 피버! 지금은 점수가 2배' },
  { name: '성심당', planet: 'bakery', events: [{ at: 3, id: 'bread' }], foods: ['soboro', 'buchu', 'strawberry'], hint: '빵지순례: 음식을 먹으면 능력이 생겨요' },
  { name: '대흥동', planet: 'daeheung', boss: 'vortex', foods: ['dubu', 'kalguksu'], foodEverySec: 7, hint: '보스 · 소용돌이 운석! 열린 줄을 따라가세요' },
  { name: '엑스포다리 · 갑천', planet: 'expoBridge', events: [{ at: 4, id: 'wave' }], foods: ['gukbap', 'squid', 'kalguksu'], hint: '갑천을 건너 과학공원으로' },
  { name: '한밭수목원', planet: 'arboretum', wind: 3.5, foods: ['gukbap', 'sundae'], foodEverySec: 8, hint: '낙엽바람에 밀려요 · 국밥으로 회복' },
  { name: '한빛탑', planet: 'hanbit', boss: 'expo', onClear: 'starpower', foods: ['dubu', 'soboro'], foodEverySec: 8, hint: '보스 · 엑스포 우주운석! 빨간 줄을 피하세요' },
  { name: '유성온천', planet: 'onsen', events: [{ at: 2, id: 'fog' }], foods: ['gukbap', 'kalguksu', 'sundae'], foodEverySec: 7, hint: '온천에서 한숨 돌려요 · 회복 음식이 나와요' },
  { name: '장태산', planet: 'forest', events: [{ at: 5, id: 'storm' }], hint: '운석 폭풍이 몰려와요' },
  { name: '계족산 황톳길', planet: 'gyejok', wind: 4, events: [{ at: 5, id: 'gravity' }], hint: '산바람과 휘어 오는 운석을 조심하세요' },
  { name: '대청호', planet: 'lake', events: [{ at: 3, id: 'jackpot' }], hint: '별똥별 잭팟! 별 조각을 모으세요' },
  {
    name: '중촌동 위브온 페스티벌', planet: 'festival', boss: 'king', bonus: true, foods: ['dubu', 'strawberry', 'gukbap'], foodEverySec: 6,
    hint: '최종 보스 · 우주대왕운석! 끝까지 버티면 축제가 시작돼요',
  },
];
