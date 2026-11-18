import type { World } from '../world';

/**
 * 게임 진행 상태. 규칙(World)의 값에서 계산하므로 따로 어긋날 일이 없다.
 *   PLAYING    — 평소 진행
 *   EVENT      — 대전 피버나 운석 폭풍 같은 돌발 이벤트 중(경고 시간 포함)
 *   BOSS       — 보스 스테이지
 *   TRANSITION — 스테이지가 바뀐 직후의 숨 고르기(새 운석이 나오지 않는다)
 *   GAME_OVER  — 목숨이 다했거나 완주해서 끝남
 */
export type Phase = 'PLAYING' | 'EVENT' | 'BOSS' | 'TRANSITION' | 'GAME_OVER';

export function phaseOf(w: World): Phase {
  if (w.over) return 'GAME_OVER';
  if (w.transition > 0) return 'TRANSITION';
  if (w.stageDef.boss) return 'BOSS';
  if (w.event) return 'EVENT';
  return 'PLAYING';
}
