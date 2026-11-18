import { useEffect, useState } from "react";
import { setMenuOpen } from "@/app/HandCursor";
import {
  METEOR,
  STATIONS,
  STATION_ART,
  TRYON,
  goMeteor,
  goTryon,
  saveStation,
  useMeteorReady,
  useTryonReady,
  type StationId,
} from "./stations";

/** 아무것도 안 고르면 판이 이만큼(ms) 뒤 닫힌다. 스쳐서 열린 채 사람이 떠나면 시작 동작이 막혀 있게 된다. */
const AUTO_CLOSE_MS = 12000;

function go(id: StationId): void {
  saveStation(id);
  // 주소의 ?game= 이 저장보다 먼저라 같이 바꾼다
  const url = new URL(window.location.href);
  url.searchParams.set("game", id);
  window.location.replace(url.toString());
}

/** 화면 양옆 탭: 팔을 옆으로 쭉 뻗으면 손이 닿는다(어깨 높이가 무대 63%). 위쪽 구석은 팔이 안 닿고 손이 카메라 밖으로 나간다. */
const TAB =
  "hand-fill pointer-events-auto absolute top-[48%] z-40 flex h-[40%] w-[12%] items-center justify-center overflow-hidden border-2 border-[#eadfc6]/70 bg-[#0f1630]/85 text-2xl font-bold text-white shadow-xl";

/** 칸 바탕 그림: 고르는 화면과 같은 그림을 어둡게 깔고, 오른쪽에 소품을 둔다. 글자가 먼저 읽히게 흐리게. */
function Art({ id }: { id: StationId | "tryon" | "meteor" }) {
  const a = STATION_ART[id];
  return (
    <>
      <img
        src={a.art}
        alt=""
        className="absolute inset-0 size-full object-cover opacity-35"
        style={{ objectPosition: a.at }}
      />
      {a.prop && (
        <img
          src={a.prop}
          alt=""
          className="absolute top-[8%] right-[3%] h-[84%] w-[38%] object-contain drop-shadow-[0_0.4rem_0.6rem_rgba(0,0,0,0.7)]"
        />
      )}
    </>
  );
}

/** '다른 체험' 탭을 누르면(손을 올려 두기 또는 터치, HandCursor) 체험 고르는 판이 열린다.
 * 지금 체험을 고르면 처음 화면으로. */
export function StationMenu({
  current,
  onSame,
  tabs = true,
}: {
  current: StationId;
  onSame?: () => void;
  /** 게임 중에는 탭을 숨긴다. */
  tabs?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tryon = useTryonReady();
  const meteor = useMeteorReady();
  // 맨 윗줄: 이 앱 밖에서 도는 두 체험(가상 착장·꿈돌이). 켜져 있는 것만 보이고, 하나뿐이면 한 줄을 다 쓴다
  const outside = [
    ...(tryon ? [{ key: "tryon" as const, ...TRYON, go: goTryon }] : []),
    ...(meteor ? [{ key: "meteor" as const, ...METEOR, go: goMeteor }] : []),
  ];
  const pick = (id: StationId) => {
    if (id === current) {
      setOpen(false);
      onSame?.();
    } else go(id);
  };

  useEffect(() => {
    setMenuOpen(open);
    if (!open) return;
    const id = window.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
    return () => {
      window.clearTimeout(id);
      setMenuOpen(false);
    };
  }, [open]);

  return (
    <div>
      {!open &&
        tabs &&
        ["left-0 rounded-r-3xl", "right-0 rounded-l-3xl"].map((side) => (
          <button
            key={side}
            type="button"
            onClick={() => setOpen(true)}
            className={`${TAB} ${side}`}
          >
            <span className="relative [writing-mode:vertical-rl]">팔을 쭉! 다른 체험</span>
          </button>
        ))}
      {open && (
        // 손이 닿는 곳(게임 무대)을 덮는다: 부모가 무대 상자.
        // 양옆을 비운다: 탭을 누른 손이 그 자리에 있어도 다른 칸이 눌리지 않고, 가운데는 팔을 조금만 움직여도 닿는다
        <div className="pointer-events-auto absolute inset-0 z-[60] flex flex-col gap-3 overflow-hidden rounded-[2rem] bg-[#0c1226]/92 px-[18%] pt-[3%] pb-[2%] text-white">
          <p className="text-center text-2xl font-bold">손을 올려 1초 기다리면 바뀌어요</p>
          <div
            className={`grid min-h-0 w-full flex-1 grid-cols-2 gap-3 ${outside.length ? "grid-rows-4" : "grid-rows-3"}`}
          >
            {/* 꺼져 있는 체험은 칸을 숨긴다: 손으로 못 누르는 칸이 자리만 차지한다 */}
            {outside.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={o.go}
                className={`hand-fill relative overflow-hidden rounded-3xl border-4 border-[#ffc93c]/60 bg-white/5 p-3 text-left ${outside.length === 1 ? "col-span-2" : ""}`}
              >
                <Art id={o.key} />
                <span className="relative block text-3xl font-bold">{o.no}</span>
                <span className="relative mt-1 block text-2xl font-bold">{o.title}</span>
                <span className="relative mt-1 block text-base text-white/70">{o.line}</span>
              </button>
            ))}
            {STATIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className={`hand-fill relative overflow-hidden rounded-3xl border-4 p-3 text-left ${
                  s.id === current ? "border-[#ffd34d] bg-white/15" : "border-white/30 bg-white/5"
                }`}
              >
                <Art id={s.id} />
                <span className="relative block text-3xl font-bold">{s.no}</span>
                <span className="relative mt-1 block text-2xl font-bold">{s.title}</span>
                <span className="relative mt-1 block text-base text-white/70">
                  {s.id === current ? "지금 체험 · 처음부터 다시" : s.line}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hand-fill relative overflow-hidden rounded-3xl border-4 border-white/30 bg-white/5 p-3 text-left"
            >
              <span className="relative block text-3xl font-bold">←</span>
              <span className="relative mt-1 block text-2xl font-bold">돌아가기</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
