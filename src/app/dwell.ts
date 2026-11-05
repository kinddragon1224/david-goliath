/** 손을 버튼 위에 머물게 해서 누르기(마우스 딸깍 대신). 손이 살짝 떨려 잠깐 벗어나도 게이지가 바로 사라지지 않는다. */
export type Dwell<T> = {
  target: T | null;
  /** 0~1 게이지. */
  k: number;
  /** 방금 누른 곳. 손이 떠나기 전엔 다시 누르지 않는다. */
  spent: T | null;
};

export function stepDwell<T>(
  d: Dwell<T>,
  over: T | null,
  dt: number,
  hold: number,
): { next: Dwell<T>; fired: T | null } {
  if (over === null) {
    const k = Math.max(0, d.k - (dt / hold) * 2);
    return { next: { target: k > 0 ? d.target : null, k, spent: null }, fired: null };
  }
  if (over === d.spent) return { next: { target: null, k: 0, spent: over }, fired: null };
  const k = (over === d.target ? d.k : 0) + dt / hold;
  if (k >= 1) return { next: { target: null, k: 0, spent: over }, fired: over };
  return { next: { target: over, k, spent: null }, fired: null };
}
