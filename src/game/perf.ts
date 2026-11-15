import { isTv } from "./kiosk";

/** 약한 PC(4스레드 이하, 예: 2코어 6세대 i3 + HD 520 — 이름만 i9로 바꾼 행사용 미니 PC가 이렇다).
 * 인식이 초당 5~8번·0.2초쯤 늦으므로 인식(pose.ts)은 가볍게, 게임 판정은 넉넉하게 바꾼다. */
// 주소에 ?lite=1 이면 강제로 켜고 ?lite=0 이면 끈다(현장 조정·시험용)
const forced = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("lite");
export const SLOW_PC =
  forced === "1" ||
  (forced !== "0" &&
    typeof navigator !== "undefined" &&
    !isTv() &&
    (navigator.hardwareConcurrency || 8) <= 4);

// 화면 글자·버튼의 움직임·그림자·필터를 CSS에서 끈다(styles.css의 .lite)
if (SLOW_PC && typeof document !== "undefined") document.documentElement.classList.add("lite");

/** 보통 PC 값과 약한 PC 값 중 하나. 현장에서 맞출 값은 둘째 인자. */
export const slow = <T,>(normal: T, slowPc: T): T => (SLOW_PC ? slowPc : normal);
