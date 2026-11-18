/**
 * 대전 맛집 음식 아이템. 캐릭터가 닿으면 먹고, 바로 능력이 생긴다.
 *
 * effect
 *   double    — 모든 점수 2배
 *   starpower — 무적이 되고 운석이 별로 바뀐다
 *   slow      — 운석이 느려진다
 *   guard     — 충돌을 한 번 막아 준다(쓸 때까지 유지, 1회분만 저장)
 *   heal      — 하트 한 칸 회복(최대 체력을 넘지 않는다)
 *   tough     — 맞은 뒤의 무적 시간이 길어진다
 *   magnet    — 주변 아이템을 저절로 먹는다
 *   bomb      — 화면의 일반 운석을 모두 없앤다
 *   charge    — 피버 게이지를 채운다
 */
export type FoodEffect = 'double' | 'starpower' | 'slow' | 'guard' | 'heal' | 'tough' | 'magnet' | 'bomb' | 'charge';
export type Rarity = 'common' | 'rare' | 'legendary';

export interface FoodDef {
  /** 가게 이름(안내에 작게 표시). 없으면 빈 문자열 */
  shop: string;
  name: string;
  /** 먹었을 때 크게 뜨는 능력 이름 */
  power: string;
  /** 능력 설명 한 줄 */
  hint: string;
  effect: FoodEffect;
  /** 지속 시간(초). 즉시 효과이거나 쓸 때까지 유지되면 0 */
  sec: number;
  rarity: Rarity;
}

export const FOODS = {
  soboro: { shop: '성심당', name: '튀김소보로', power: '점수 2배', hint: '8초 동안 모든 점수가 2배', effect: 'double', sec: 8, rarity: 'common' },
  strawberry: { shop: '성심당', name: '딸기시루', power: '무적 별 잔치', hint: '6초 동안 무적, 운석이 별로 바뀌어요', effect: 'starpower', sec: 6, rarity: 'rare' },
  kalguksu: { shop: '오씨칼국수', name: '물총칼국수', power: '슬로모션', hint: '6초 동안 운석이 35% 느려져요', effect: 'slow', sec: 6, rarity: 'common' },
  dubu: { shop: '진로집', name: '두부두루치기', power: '든든 방어', hint: '충돌을 한 번 막아 줘요', effect: 'guard', sec: 0, rarity: 'rare' },
  gukbap: { shop: '원조태평소국밥', name: '소국밥', power: '하트 회복', hint: '하트 한 칸을 되찾았어요', effect: 'heal', sec: 0, rarity: 'common' },
  sundae: { shop: '오문창순대국밥', name: '순대국밥', power: '오뚝이', hint: '8초 동안 맞아도 무적 시간이 길어져요', effect: 'tough', sec: 8, rarity: 'rare' },
  buchu: { shop: '성심당', name: '판타롱부추빵', power: '자석', hint: '7초 동안 주변 아이템이 저절로 모여요', effect: 'magnet', sec: 7, rarity: 'rare' },
  squid: { shop: '광천식당', name: '오징어두루치기', power: '매운맛 폭발', hint: '화면의 운석을 모두 날려 버렸어요', effect: 'bomb', sec: 0, rarity: 'legendary' },
  ramen: { shop: '', name: '꿈돌이 라면', power: '피버 충전', hint: '피버 게이지가 절반 찼어요', effect: 'charge', sec: 0, rarity: 'common' },
} satisfies Record<string, FoodDef>;

export type FoodId = keyof typeof FOODS;
export const FOOD_IDS = Object.keys(FOODS) as FoodId[];
/** 빵지순례 이벤트 때 쏟아지는 빵 */
export const BREADS: FoodId[] = ['soboro', 'buchu', 'strawberry'];

/** 희귀도별 등장 가중치. 같은 스테이지에서 나올 수 있는 음식들끼리 이 비율로 뽑힌다 */
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 25, legendary: 5 };

export const ITEM_RULES = {
  /** 음식이 나오는 평균 간격(초). 스테이지가 따로 정하면 그 값을 쓴다 */
  everySec: 15,
  /** 음식을 먹은 것만으로 받는 점수 */
  score: 100,
  /** 슬로모션 중 운석 속도 배율(35% 감소) */
  slowFactor: 0.65,
  /** 점수 2배 능력·대전 피버의 배율. 둘이 겹쳐도 더 커지지 않는다 */
  doubleMultiplier: 2,
  /** 오뚝이 중 피격 후 무적 시간 배율 */
  toughFactor: 2,
  /** 자석이 끌어오는 좌우 거리 */
  magnetReach: 4.6,
  /** 폭발·별 변환으로 없앤 운석 하나당 점수 */
  bombScore: 50,
  /** 하트가 가득 찼을 때 회복 음식을 먹으면 대신 받는 점수 */
  fullHealScore: 200,
  /** 꿈돌이 라면이 채우는 피버 게이지(%) */
  chargeAmount: 50,
} as const;
