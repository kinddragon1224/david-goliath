/**
 * 플레이어(z=0)와, 한 프레임 동안 z0→z1(z0 ≤ z1)로 다가온 물체의 원-원 판정.
 * 구간에서 플레이어에 가장 가까운 z를 쓰므로 프레임이 느려도 통과하지 않는다.
 */
export function sweptHit(dx: number, z0: number, z1: number, radius: number): boolean {
  const z = Math.min(Math.max(0, z0), z1);
  return dx * dx + z * z < radius * radius;
}
