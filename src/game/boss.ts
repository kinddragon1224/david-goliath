/** 골리앗 쓰러뜨리기(KO)·피버 타임·창 피하기 규칙. 숫자만 다루는 순수 함수라 시험할 수 있다.
 * 현장에서 너무 쉽거나 어려우면 이 파일의 숫자만 고치면 된다.
 */

export type BossPart = "이마" | "투구" | "몸통" | "방패";

/** 골리앗 체력. 잘하는 사람이 피버 타임(마지막 5초)에 겨우 쓰러뜨리는 정도. 10명 중 2~3명 KO 목표. */
export const GOLIATH_HP = 170;

/** 부위별 피해. 방패는 막힘. */
export const PART_DAMAGE: Record<BossPart, number> = {
  이마: 24,
  투구: 9,
  몸통: 4,
  방패: 0,
};

/** 마지막 몇 초가 피버 타임인가. 피해·점수 2배. */
export const FEVER_SECONDS = 5;
export const FEVER_MULT = 2;

/** 쓰러뜨렸을 때 남은 1초마다 보너스 점수. 빨리 쓰러뜨릴수록 높은 점수. */
export const KO_BONUS_PER_SEC = 200;
/** 쓰러지는 연출 길이(초). */
export const KO_SECONDS = 2.8;

/** 창 던지기: 판 시작 후 이 시각(초)에 예고. 20초 판에 두 번. */
export const SPEAR_AT = [6, 12.5];
/** 예고 후 창이 떨어지기까지(초). 아이가 보고 움직일 시간. */
export const SPEAR_TELL = 1.5;
export const SPEAR_FLIGHT = 0.45;
/** 다윗이 처음 자리에서 이만큼(월드 px) 옮겨 가 있으면 피한 것. 몸을 옆으로 기울여도 닿는 거리. */
export const DODGE_DIST = 110;
export const DODGE_BONUS = 300;
/** 창에 맞으면 잠깐 못 던진다(초). */
export const STUN_SECONDS = 1.1;

/** 다윗이 몸을 따라 움직이는 범위(월드 px, 좌우). */
export const DAVID_SHIFT_MAX = 280;

export function partDamage(part: BossPart, fever: boolean): number {
  return PART_DAMAGE[part] * (fever ? FEVER_MULT : 1);
}

export function isFever(timeLeft: number, playing: boolean): boolean {
  return playing && timeLeft > 0 && timeLeft <= FEVER_SECONDS;
}

export function koBonus(timeLeft: number): number {
  return Math.max(0, Math.ceil(timeLeft)) * KO_BONUS_PER_SEC;
}

export function dodged(targetShift: number, shiftNow: number): boolean {
  return Math.abs(shiftNow - targetShift) >= DODGE_DIST;
}

/** 카메라 속 몸의 가로 위치(0~1, 거울) → 다윗의 좌우 위치. 화면 가운데가 0. */
export function shiftFromBody(bodyX: number): number {
  return Math.max(-DAVID_SHIFT_MAX, Math.min(DAVID_SHIFT_MAX, (bodyX - 0.5) * 1100));
}

/** 체력 비율 → 투구 반창고·금 같은 상처 단계(0~3). */
export function woundStage(hpRatio: number): number {
  if (hpRatio <= 0.15) return 3;
  if (hpRatio <= 0.4) return 2;
  if (hpRatio <= 0.7) return 1;
  return 0;
}
