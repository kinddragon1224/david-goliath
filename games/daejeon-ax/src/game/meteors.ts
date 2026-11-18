export interface Meteor {
  id: number;
  x: number;
  z: number;
  r: number;
  /** 이 웨이브에서 보장된 빈 레인의 x (테스트의 봇과 디버그용) */
  safeX: number;
  /**
   * 휘어 오는 운석(중력 이상·갑천 파도·보스): 닿을 때의 진짜 자리와, 출발할 때 옆으로 벗어난 거리.
   * 멀리서는 벗어나 보여도 닿는 순간에는 반드시 baseX 에 온다(피할 길 보장을 깨지 않는다).
   */
  baseX?: number;
  bend?: number;
  /** gravity: 곡선으로 휘어 들어옴 / wave: 일정한 기울기로 비스듬히 들어옴 */
  curve?: 'gravity' | 'wave';
  /** 무적 중인 플레이어를 뚫고 지나갔다(피한 것으로 치지 않는다) */
  through?: boolean;
}

export interface Wave {
  safeLane: number;
  blocked: number[];
}

/**
 * 다음 웨이브 패턴. "피할 길 보장"은 이 함수 하나가 책임진다.
 * - safeLane 은 직전 safeLane 에서 maxShift 레인 이내 → 사람이 옮겨갈 시간이 있다.
 * - safeLane 은 절대 막지 않는다.
 * - avoid 에 든 레인은 막지 않는다(초반 쉬운 구간에서 같은 자리 연속 피격 방지).
 * - forceSafe 를 주면 그 레인을 안전 레인으로 쓴다(운석 폭풍의 무늬). 닿을 수 없는 레인이면 무시한다.
 */
export function nextWave(
  lanes: number,
  prevSafe: number,
  maxShift: number,
  count: number,
  rand: () => number,
  avoid: readonly number[] = [],
  forceSafe?: number,
): Wave {
  const all = Array.from({ length: lanes }, (_, i) => i);
  const open = all.filter((l) => !avoid.includes(l));
  let reach = all.filter((l) => Math.abs(l - prevSafe) <= Math.max(0, maxShift));
  if (open.length === 1) {
    // 막을 수 있는 레인이 하나뿐이면 그 레인을 안전 레인으로 뽑지 않는다
    const alt = reach.filter((l) => l !== open[0]);
    if (alt.length) reach = alt;
  }
  const safeLane = forceSafe !== undefined && reach.includes(forceSafe) ? forceSafe : reach[Math.floor(rand() * reach.length)];
  const pool = open.filter((l) => l !== safeLane);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return { safeLane, blocked: pool.slice(0, Math.max(1, Math.min(lanes - 1, count))) };
}
