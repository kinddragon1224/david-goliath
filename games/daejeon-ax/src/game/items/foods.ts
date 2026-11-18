import { EVENT_RULES } from '../config/events';
import { FOOD_IDS, FOODS, ITEM_RULES, RARITY_WEIGHT, type FoodId } from '../config/items';
import type { StageDef } from '../config/stages';
import type { World } from '../world';

/**
 * 다음 음식이 나올 때까지의 시간(초): 평균 간격을 중심으로 ±30%.
 * @param scale 난이도별 배율(클수록 드물게)
 */
export function nextFoodDelay(stage: StageDef, rand: () => number, scale = 1): number {
  return (stage.foodEverySec ?? ITEM_RULES.everySec) * scale * (0.7 + rand() * 0.6);
}

/**
 * 나올 음식 하나를 희귀도 가중치로 뽑는다. 음식이 없는 스테이지면 null.
 * 지금 먹어도 소용없는 것(가득 찬 하트의 회복, 이미 있는 방어, 피버 중의 충전)은 다른 선택지가 있으면 뺀다.
 */
export function pickFood(w: World, rand: () => number, from?: readonly FoodId[]): FoodId | null {
  const pool: readonly FoodId[] = from ?? w.stageDef.foods ?? FOOD_IDS;
  const useless = (id: FoodId) => {
    const effect = FOODS[id].effect;
    return (effect === 'heal' && w.lives >= w.maxLives) || (effect === 'guard' && w.guard > 0) || (effect === 'charge' && w.fever > 0);
  };
  const useful = pool.filter((id) => !useless(id));
  const list = useful.length ? useful : pool;
  let roll = rand() * list.reduce((sum, id) => sum + RARITY_WEIGHT[FOODS[id].rarity], 0);
  for (const id of list) {
    roll -= RARITY_WEIGHT[FOODS[id].rarity];
    if (roll < 0) return id;
  }
  return list[list.length - 1] ?? null;
}

/**
 * 음식을 먹었을 때의 효과. 모든 입력 방식(카메라·키보드·터치)이 같은 경로를 탄다.
 * 같은 종류를 또 먹으면 시간이 다시 채워질 뿐 효과가 겹쳐 커지지 않는다.
 */
export function eatFood(w: World, id: FoodId): void {
  const { effect, sec } = FOODS[id];
  w.foods++;
  w.addScore(ITEM_RULES.score);
  w.addGauge(EVENT_RULES.gauge.food);
  if (effect === 'double') w.double = Math.max(w.double, sec);
  else if (effect === 'slow') w.slow = Math.max(w.slow, sec);
  else if (effect === 'tough') w.tough = Math.max(w.tough, sec);
  else if (effect === 'magnet') w.magnet = Math.max(w.magnet, sec);
  else if (effect === 'guard') w.guard = 1; // 1회분만 저장
  else if (effect === 'charge') w.addGauge(ITEM_RULES.chargeAmount);
  else if (effect === 'bomb') w.clearMeteors();
  else if (effect === 'starpower') {
    w.starpower = Math.max(w.starpower, sec);
    w.meteorsToStars();
  } else if (w.lives < w.maxLives) w.lives++; // heal: 최대 체력을 넘지 않는다
  else w.addScore(ITEM_RULES.fullHealScore);
  w.events.push({ type: 'food', x: w.player.x, food: id });
}
