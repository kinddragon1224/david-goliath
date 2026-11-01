/** "오늘의 거대 골리앗": 행사장 참가자 모두의 점수가 한 마리 거대 골리앗의 체력을 깎는다.
 * 쓰러지면 바로 다음 거대 골리앗이 나타나고, 쓰러뜨린 수가 쌓인다.
 * 날짜가 바뀌면 그날 기록으로 새로 시작한다(최대 체력 설정은 유지).
 * 순수 함수만 둔다. 저장은 engine 쪽에서 localStorage로.
 */

export type GiantState = {
  /** "2026-11-01" 같은 기록 날짜. */
  day: string;
  max: number;
  hp: number;
  plays: number;
  defeated: number;
  /** 가장 최근에 거대 골리앗을 쓰러뜨린 판의 기록 시각(이름을 찾을 때 쓴다). */
  lastKoAt: number | null;
};

/** 운영자가 고르는 거대 골리앗 체력. 한 판 평균 3천~5천 점 기준.
 * 10만 ≈ 25판, 30만 ≈ 75판, 50만 ≈ 120판, 100만 ≈ 250판. */
export const GIANT_PRESETS = [100_000, 300_000, 500_000, 1_000_000];
export const GIANT_DEFAULT_MAX = 300_000;

export function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function freshGiant(day: string, max = GIANT_DEFAULT_MAX): GiantState {
  return { day, max, hp: max, plays: 0, defeated: 0, lastKoAt: null };
}

/** 저장값을 믿지 않고 고친다. 날짜가 다르면 새 날로. */
export function normalizeGiant(raw: unknown, today: string): GiantState {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<GiantState>;
  const max = typeof r.max === "number" && r.max > 0 ? Math.round(r.max) : GIANT_DEFAULT_MAX;
  if (r.day !== today) return freshGiant(today, max);
  const hp = typeof r.hp === "number" ? Math.max(0, Math.min(max, Math.round(r.hp))) : max;
  return {
    day: today,
    max,
    hp: hp > 0 ? hp : max,
    plays: typeof r.plays === "number" && r.plays >= 0 ? Math.floor(r.plays) : 0,
    defeated: typeof r.defeated === "number" && r.defeated >= 0 ? Math.floor(r.defeated) : 0,
    lastKoAt: typeof r.lastKoAt === "number" ? r.lastKoAt : null,
  };
}

/** 한 판의 점수를 거대 골리앗에게 준다. 체력이 0이 되면 쓰러뜨림 +1, 새 거대 골리앗(남는 피해는 버림). */
export function contribute(
  state: GiantState,
  points: number,
  at: number,
): { state: GiantState; defeatedNow: boolean } {
  const hit = Math.max(0, Math.round(points));
  const plays = state.plays + 1;
  if (hit >= state.hp) {
    return {
      state: { ...state, hp: state.max, plays, defeated: state.defeated + 1, lastKoAt: at },
      defeatedNow: true,
    };
  }
  return { state: { ...state, hp: state.hp - hit, plays }, defeatedNow: false };
}

export function resetGiant(state: GiantState, max: number): GiantState {
  return freshGiant(state.day, max);
}
