import { useEffect, useState } from "react";
import { HandCursor } from "@/app/HandCursor";
import { RemoteFocus } from "@/app/RemoteFocus";
import { PRODUCER } from "@/game/constants";
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
  return (
    <>
      {station === null ? (
        <StationPicker onPick={setStation} />
      ) : station === "goliath" ? (
        <GameApp />
      ) : (
        <FashionApp station={station} />
      )}
      <ProducerMark />
      <HandCursor />
      <RemoteFocus />
    </>
  );
}

/** 모든 화면 구석의 제작사 표기. 로고가 남색이라 어두운 화면에서도 보이게 흰 바탕에 얹는다. */
function ProducerMark() {
  return (
    <div className="pointer-events-none fixed right-2 bottom-2 z-40 flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#14306b]">
      <span>제작</span>
      <img src={PRODUCER.logo} alt={PRODUCER.name} className="h-4 w-auto" />
    </div>
  );
}
