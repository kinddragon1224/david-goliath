import { CONFIG } from '../config';

export interface Player {
  x: number;
  vx: number;
}

/** 목표 x를 부드럽게 따라간다. 포즈 추론 사이 구간의 보간도 이 추종이 맡는다. */
export function movePlayer(p: Player, targetX: number, dt: number): void {
  if (dt <= 0) return;
  const { follow, maxSpeed } = CONFIG.player;
  const want = (targetX - p.x) * (1 - Math.exp(-follow * dt));
  const step = Math.max(-maxSpeed * dt, Math.min(maxSpeed * dt, want));
  p.x += step;
  p.vx = step / dt;
}
