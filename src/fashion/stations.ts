import { useEffect, useState } from "react";

/** 위브온페스티벌 AX 체험 목록. 01 가상 착장은 따로 도는 프로그램이라 아래 TRYON으로 잇는다. */
export type StationId = "goliath" | "iron" | "scissors" | "sewing" | "rhythm";

export type StationInfo = {
  id: StationId;
  no: string;
  title: string;
  line: string;
};

export const STATIONS: StationInfo[] = [
  { id: "goliath", no: "02", title: "다윗과 골리앗", line: "큰 목표를 향해 공을 던져요" },
  { id: "iron", no: "03", title: "다리미 챌린지", line: "세탁소 손님 옷의 주름을 펴요" },
  { id: "scissors", no: "04", title: "가위질 챌린지", line: "천을 잘라 조각보를 만들어요" },
  { id: "sewing", no: "05", title: "바느질 챌린지", line: "하트·별·꽃을 수놓아요" },
  { id: "rhythm", no: "06", title: "몽글 드럼", line: "음악에 맞춰 큰 북을 두드려요" },
];

/** 01 가상 착장: 같은 PC에서 따로 도는 프로그램(C:\Users\sunyo\weaveon\vton, 그래픽카드 필요). 켜져 있을 때만 열린다.
 * ponytail: 주소를 이 PC(127.0.0.1)로 박아 뒀다. 다른 PC의 가상 착장을 열어야 하면 설정으로 뺀다. */
export const TRYON = { no: "01", title: "가상 착장", line: "AI가 룩북 옷을 입혀 줘요" };
const TRYON_ORIGIN = "http://127.0.0.1:8765";

/** 가상 착장으로 넘어간다. home= 으로 지금 화면 주소를 넘겨, 거기서 이 화면으로 돌아온다. */
export function goTryon(): void {
  const home = encodeURIComponent(window.location.href);
  window.location.href = `${TRYON_ORIGIN}/app/?game=ar3d&garment=g00&home=${home}`;
}

/** 가상 착장 프로그램이 켜져 있나. 5초마다 다시 본다. */
export function useTryonReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = () =>
      fetch(`${TRYON_ORIGIN}/health`, { signal: AbortSignal.timeout(2500) })
        .then((r) => alive && setReady(r.ok))
        .catch(() => alive && setReady(false));
    void check();
    const id = window.setInterval(check, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  return ready;
}

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
