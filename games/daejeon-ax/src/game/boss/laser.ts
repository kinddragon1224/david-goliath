import { CONFIG } from '../../config';
import type { World } from '../world';

const B = CONFIG.boss;

/**
 * 보스의 레이저 한 줄. 운석 웨이브와 똑같이 플레이어 쪽으로 "다가오는" 것으로 다룬다:
 * 멀리 있을 때는 그 레인에 경고 띠만 보이고(최소 1초 이상), 닿기 직전(fireSec 동안)에만 실제로 켜진다.
 * 웨이브 구조를 그대로 쓰므로 안전 구역(피할 길) 보장도 운석과 같은 방식으로 지켜진다.
 */
export interface Laser {
  id: number;
  x: number;
  z: number;
  /** 이 웨이브에서 보장된 빈 레인의 x */
  safeX: number;
  /** 켜졌다는 이벤트를 이미 보냈는지 */
  fired?: boolean;
}

/** 한 번에 쏘는 레이저 수: 레인의 절반쯤 */
export const laserCount = (lanes: number) => Math.max(1, Math.ceil((lanes - 1) / 2));

/**
 * 엑스포 우주운석의 좌우 반복 공격: 한 번은 왼쪽 절반, 다음은 오른쪽 절반을 쓴다.
 * 안전 레인은 그쪽에 있더라도 건드리지 않고, 반대쪽은 통째로 안전 구역이 된다.
 * @param side -1 왼쪽, 1 오른쪽
 */
export function sideLanes(lanes: number, safeLane: number, side: number): number[] {
  const mid = (lanes - 1) / 2;
  const picked: number[] = [];
  for (let l = 0; l < lanes; l++) if (l !== safeLane && Math.sign(l - mid) === side) picked.push(l);
  if (picked.length) return picked;
  // 그쪽에 쏠 수 있는 줄이 없으면(안전 레인뿐이면) 안전 레인 바로 옆 한 줄
  return [safeLane > 0 ? safeLane - 1 : safeLane + 1].filter((l) => l < lanes);
}

/** 레이저가 켜지기 시작하는 거리(이 거리 안으로 들어오면 발사) */
export const fireDistance = (speed: number) => B.fireSec * speed;

export const isFiring = (l: Laser, speed: number) => l.z >= -fireDistance(speed) && l.z <= 0;

/** 레이저를 전진시키고, 켜져 있는 동안 그 줄에 있으면 피해를 준다 */
export function advanceLasers(w: World, dz: number): void {
  const speed = w.speed;
  for (let i = w.lasers.length - 1; i >= 0; i--) {
    const l = w.lasers[i];
    l.z += dz;
    if (isFiring(l, speed)) {
      if (!l.fired) {
        l.fired = true;
        w.events.push({ type: 'laser', x: l.x });
      }
      if (Math.abs(l.x - w.player.x) < B.beamHalf) w.hurt(w.player.x);
    }
    if (l.z > 2) w.lasers.splice(i, 1);
  }
}
