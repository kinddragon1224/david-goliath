import { useState } from "react";
import { STATIONS, saveStation, type StationId } from "./stations";

function go(id: StationId): void {
  saveStation(id);
  // 주소의 ?game= 이 저장보다 먼저라 같이 바꾼다
  const url = new URL(window.location.href);
  url.searchParams.set("game", id);
  window.location.replace(url.toString());
}

/** '다른 체험' 탭을 누르면(손을 올려 두기 또는 터치, HandCursor) 체험 고르는 판이 열린다.
 * 지금 체험을 고르면 처음 화면으로. */
export function StationMenu({
  current,
  onSame,
  className = "absolute top-3 left-3",
}: {
  current: StationId;
  onSame?: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pick = (id: StationId) => {
    if (id === current) {
      setOpen(false);
      onSame?.();
    } else go(id);
  };

  return (
    <div>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${className} pointer-events-auto z-40 overflow-hidden rounded-2xl border-2 border-white/60 bg-black/60 px-6 py-3 text-xl font-bold text-white shadow-xl`}
        >
          ☰ 다른 체험
        </button>
      )}
      {open && (
        // 손이 닿는 곳(게임 무대)을 덮는다: 부모가 무대 상자
        <div className="pointer-events-auto absolute inset-0 z-[60] flex flex-col items-center justify-center gap-4 overflow-auto rounded-[2rem] bg-[#0d0b14]/90 p-4 text-white">
          <p className="text-center text-2xl font-bold">손을 올려 1초 기다리면 바뀌어요</p>
          <div className="grid w-full max-w-4xl grid-cols-2 gap-3">
            {STATIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className={`relative overflow-hidden rounded-3xl border-4 p-4 text-left ${
                  s.id === current ? "border-[#ffd34d] bg-white/15" : "border-white/30 bg-white/5"
                }`}
              >
                <span className="relative block text-4xl font-bold">{s.no}</span>
                <span className="relative mt-1 block text-2xl font-bold">{s.title}</span>
                <span className="relative mt-1 block text-base text-white/70">
                  {s.id === current ? "지금 체험 · 처음부터 다시" : s.line}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="relative overflow-hidden rounded-3xl border-4 border-white/30 bg-white/5 p-4 text-left"
            >
              <span className="relative block text-4xl font-bold">←</span>
              <span className="relative mt-1 block text-2xl font-bold">돌아가기</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
