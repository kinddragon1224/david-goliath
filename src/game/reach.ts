import type { Landmark } from "./motion";

export type ReachHand = { x: number; y: number };

/** 어깨 폭 단위로 팔 닿는 범위를 화면에 펼친다. 아이든 어른이든, 멀리 서든 가까이 서든
 * 팔을 쭉 뻗으면 화면 끝에 닿는다. 가로 ±2.3, 세로 머리 위 2.4 ~ 허리 1.4 (어깨 폭 배수). */
export const REACH = { halfX: 2.3, top: -2.4, bottom: 1.4 };

export function reachHands(img: Landmark[], aspect: number): (ReachHand | null)[] {
  const ls = img[11];
  const rs = img[12];
  if (!ls || !rs || ls.v < 0.3 || rs.v < 0.3) return [null, null];
  const sx = ((ls.x + rs.x) / 2) * aspect;
  const sy = (ls.y + rs.y) / 2;
  const sw = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y);
  if (sw < 0.02) return [null, null];
  const side = (ids: number[]): ReachHand | null => {
    const wrist = img[ids[0]];
    if (!wrist || wrist.v < 0.3) return null;
    // 손목·새끼·검지 평균 = 손바닥 가운데
    const pts = ids.map((i) => img[i]).filter((p) => p && p.v > 0.15);
    const px = pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const py = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const u = (px * aspect - sx) / sw;
    const v = (py - sy) / sw;
    return { x: 0.5 + u / (2 * REACH.halfX), y: (v - REACH.top) / (REACH.bottom - REACH.top) };
  };
  const a = side([15, 17, 19]);
  const b = side([16, 18, 20]);
  // 화면 왼쪽 손이 먼저
  if (a && b && a.x > b.x) return [b, a];
  if (!a && b) return b.x < 0.5 ? [b, null] : [null, b];
  if (a && !b) return a.x < 0.5 ? [a, null] : [null, a];
  return [a, b];
}
