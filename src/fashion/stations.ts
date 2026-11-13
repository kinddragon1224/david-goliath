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
  { id: "scissors", no: "04", title: "가위질 챌린지", line: "옷본 따라 원단을 재단해요" },
  { id: "sewing", no: "05", title: "바느질 챌린지", line: "하트·별·꽃을 수놓아요" },
  { id: "rhythm", no: "06", title: "몽글 드럼", line: "음악에 맞춰 큰 북을 두드려요" },
];

/** 고르는 화면의 칸 그림: 배경(art), 배경에서 보여 줄 자리(at), 앞에 띄우는 소품(prop). */
export const STATION_ART: Record<StationId | "tryon", { art: string; at: string; prop?: string }> = {
  tryon: { art: "/art/rhythm.webp", at: "7% 40%" },
  goliath: { art: "/valley.jpg", at: "70% 78%", prop: "/goliath-idle.png" },
  iron: { art: "/art/iron.webp", at: "16% 40%", prop: "/art/prop-iron.png" },
  scissors: { art: "/art/scissors.webp", at: "76% 30%", prop: "/art/prop-scissors.png" },
  sewing: { art: "/art/sewing.webp", at: "20% 40%", prop: "/art/prop-needle.png" },
  rhythm: { art: "/art/rhythm.webp", at: "50% 40%", prop: "/art/mongle-drum.webp" },
};

/** 01 가상 착장: 사무실 PC에서 따로 도는 프로그램(그래픽카드 필요)을 Cloudflare 터널로 연다. 서버가 켜져 있을 때만 열린다.
 * 부스 PC마다 한 번 잠금 해제 주소(서버 PC의 vton\UNLOCK_URL.txt)를 열어야 사진이 찍힌다. */
export const TRYON = { no: "01", title: "가상 착장", line: "AI가 룩북 옷을 입혀 줘요" };
const TRYON_ORIGIN = "https://studio.therumen.kr";

/** 가상 착장으로 넘어간다. home= 으로 지금 화면 주소를 넘겨, 거기서 이 화면으로 돌아온다. */
export function goTryon(): void {
  // 돌아올 곳은 늘 고르는 화면(메인): 어느 체험에서 넘어갔든 ?game= 을 떼고 넘긴다
  const url = new URL(window.location.href);
  url.searchParams.delete("game");
  const home = encodeURIComponent(url.toString());
  window.location.href = `${TRYON_ORIGIN}/app/?game=ar3d&garment=g00&home=${home}`;
}

/** 가상 착장 프로그램이 켜져 있나. 5초마다 다시 본다. */
export function useTryonReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    // 느린 와이파이에서 한 번 늦었다고 칸이 꺼지지 않게: 넉넉히 기다리고, 세 번 연달아 실패해야 끈다
    let fails = 0;
    const note = (ok: boolean) => {
      if (!alive) return;
      fails = ok ? 0 : fails + 1;
      if (ok) setReady(true);
      else if (fails >= 3) setReady(false);
    };
    const check = () =>
      fetch(`${TRYON_ORIGIN}/health`, { signal: AbortSignal.timeout(6000) })
        .then((r) => note(r.ok))
        .catch(() => note(false));
    void check();
    const id = window.setInterval(check, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);
  return ready;
}

export function stationInfo(id: StationId): StationInfo {
  return STATIONS.find((s) => s.id === id) ?? STATIONS[0];
}

function isStation(v: string | null): v is StationId {
  return !!v && STATIONS.some((s) => s.id === v);
}

/** 지금 체험은 주소의 ?game= 에만 둔다. 없으면 null(고르는 화면).
 * 기기에 저장하지 않는다: 켤 때마다, 가상 착장에서 돌아올 때마다 메인은 고르는 화면이어야 한다. */
export function savedStation(): StationId | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("game");
  return isStation(q) ? q : null;
}

/** 주소에 적어 둔다: 무인 운영 중 새로고침(오류 복구)이 나도 하던 체험으로 돌아온다. */
export function saveStation(id: StationId | null): void {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("game", id);
  else url.searchParams.delete("game");
  window.history.replaceState(null, "", url.toString());
}

/** 체험 바꾸기: 저장을 지우고 주소의 ?game= 도 떼고 다시 연다. */
export function resetStation(): void {
  saveStation(null);
  const url = new URL(window.location.href);
  url.searchParams.delete("game");
  window.location.replace(url.toString());
}
