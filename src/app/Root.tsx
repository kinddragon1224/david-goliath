import { useEffect, useState } from "react";
import { GameApp } from "@/game/GameApp";
import { EDITION_ID } from "@/game/edition";
import { FashionApp } from "@/fashion/FashionApp";
import { StationPicker } from "@/fashion/StationPicker";
import { savedStation, type StationId } from "@/fashion/stations";

/** 첫 화면. 위브온페스티벌판은 기기마다 체험 하나를 골라 돌린다(?game= 으로도 고정).
 * 다른 판은 돌 던지기만. 단, 주소에 ?game= 을 붙이면 패션 체험을 미리 볼 수 있다. */
export function Root() {
  const [station, setStation] = useState<StationId | null | undefined>(undefined);
  useEffect(() => {
    const s = savedStation();
    const fromQuery = new URLSearchParams(window.location.search).has("game");
    setStation(EDITION_ID === "weaveon" || fromQuery ? s : "goliath");
  }, []);
  if (station === undefined) return <div className="fixed inset-0 bg-[#0d0b14]" />;
  if (station === null) return <StationPicker onPick={setStation} />;
  if (station === "goliath") return <GameApp />;
  return <FashionApp station={station} />;
}
