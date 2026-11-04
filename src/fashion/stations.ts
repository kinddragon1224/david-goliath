/** 위브온페스티벌 AX 체험 목록. 01 가상 착장은 따로 만든다. */
export type StationId = "goliath" | "iron" | "scissors" | "sewing" | "rhythm";

export type StationInfo = {
  id: StationId;
  no: string;
  title: string;
  line: string;
};

export const STATIONS: StationInfo[] = [
  { id: "goliath", no: "02", title: "다윗과 골리앗", line: "큰 목표를 향해 공을 던져요" },
  { id: "iron", no: "03", title: "다리미 챌린지", line: "바르고 정확하게 주름을 펴요" },
  { id: "scissors", no: "04", title: "가위질 챌린지", line: "가위로 패턴을 잘라요" },
  { id: "sewing", no: "05", title: "바느질 챌린지", line: "바느질로 멋지게 완성해요" },
  { id: "rhythm", no: "06", title: "몽글 드럼", line: "음악에 맞춰 큰 북을 두드려요" },
];

const KEY = "weaveon-station";

export function stationInfo(id: StationId): StationInfo {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}

function isStation(v: string | null): v is StationId {
  return !!v && STATIONS.some((s) => s.id === v);
}

/** 주소의 ?game= 이 먼저, 없으면 이 기기에 저장된 체험. 처음이면 null(고르는 화면). */
export function savedStation(): StationId | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("game");
  if (isStation(q)) return q;
  try {
    const v = localStorage.getItem(KEY);
    return isStation(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveStation(id: StationId | null): void {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* 저장이 막히면 매번 고른다 */
  }
}

/** 체험 바꾸기: 저장을 지우고 주소의 ?game= 도 떼고 다시 연다. */
export function resetStation(): void {
  saveStation(null);
  const url = new URL(window.location.href);
  url.searchParams.delete("game");
  window.location.replace(url.toString());
}
