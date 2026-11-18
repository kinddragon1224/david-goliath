import type { FoodId } from './config/items';

export interface Pickup {
  id: number;
  x: number;
  z: number;
  /** 별 조각이거나 음식. 생략하면 별 조각 */
  kind?: 'star' | FoodId;
}

/** 별 조각과 음식은 넉넉하게 먹힌다 */
export const PICKUP_RADIUS = 1.1;
