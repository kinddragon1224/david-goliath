import { isTv } from "./kiosk";

/** 약한 PC(4스레드 이하, 예: 2코어 6세대 i3 + HD 520 — 이름만 i9로 바꾼 행사용 미니 PC가 이렇다).
 * 인식이 초당 5~8번·0.2초쯤 늦으므로 인식(pose.ts)은 가볍게, 게임 판정은 넉넉하게 바꾼다. */
export const SLOW_PC =
  typeof navigator !== "undefined" && !isTv() && (navigator.hardwareConcurrency || 8) <= 4;

/** 보통 PC 값과 약한 PC 값 중 하나. 현장에서 맞출 값은 둘째 인자. */
export const slow = <T,>(normal: T, slowPc: T): T => (SLOW_PC ? slowPc : normal);
