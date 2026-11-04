import { useEffect, useRef, useState } from "react";
import { STATIONS, saveStation, type StationId } from "./stations";

type Pt = { x: number; y: number };

/** 사람 손 위치(화면 px). 게임 루프가 매 프레임 넣는다. */
let hands: Pt[] = [];
export function setMenuHands(pts: Pt[]): void {
  hands = pts;
}

/** 손을 이만큼(초) 올려 두면 고른다. */
const HOLD = 1.2;

function go(id: StationId): void {
  saveStation(id);
  // 주소의 ?game= 이 저장보다 먼저라 같이 바꾼다
  const url = new URL(window.location.href);
  url.searchParams.set("game", id);
  window.location.replace(url.toString());
}

/** 현장엔 마우스·키보드가 없다: '다른 체험' 탭에 손을 1초 남짓 올려 두면(또는 터치) 체험 고르는 판이 열린다.
 * 판에서도 손을 올려 두면 그 체험으로 바뀐다. 지금 체험을 고르면 처음 화면으로. */
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
  const [hover, setHover] = useState<{ id: string; k: number } | null>(null);
  const [dots, setDots] = useState<Pt[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const act = useRef<(id: string) => void>(() => {});
  act.current = (id) => {
    if (id === "open") setOpen(true);
    else if (id === "back") setOpen(false);
    else if (id === current) {
      setOpen(false);
      onSame?.();
    } else go(id as StationId);
  };
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let cur: { id: string; k: number } | null = null;
    let shown = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      let over: string | null = null;
      for (const el of root.current?.querySelectorAll<HTMLElement>("[data-pick]") ?? []) {
        const r = el.getBoundingClientRect();
        if (hands.some((h) => h.x >= r.left && h.x <= r.right && h.y >= r.top && h.y <= r.bottom)) {
          over = el.dataset.pick ?? null;
          break;
        }
      }
      if (!over) {
        if (cur) setHover(null);
        cur = null;
      } else {
        cur = { id: over, k: (cur?.id === over ? cur.k : 0) + dt / HOLD };
        if (cur.k >= 1) {
          cur = null;
          setHover(null);
          act.current(over);
        } else setHover(cur);
      }
      // 판이 열려 있을 때만 손 점을 그린다(게임 화면엔 게임이 손을 그린다)
      if (openRef.current) setDots(hands.slice());
      else if (shown) setDots([]);
      shown = openRef.current ? hands.length : 0;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fill = (id: string) =>
    hover?.id === id ? (
      <span
        className="absolute inset-y-0 left-0 bg-[#ffd34d]/45"
        style={{ width: `${hover.k * 100}%` }}
      />
    ) : null;

  return (
    <div ref={root}>
      {!open && (
        <button
          type="button"
          data-pick="open"
          onClick={() => setOpen(true)}
          className={`${className} pointer-events-auto z-40 overflow-hidden rounded-2xl border-2 border-white/60 bg-black/60 px-6 py-3 text-xl font-bold text-white shadow-xl`}
        >
          {fill("open")}
          <span className="relative">☰ 다른 체험</span>
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
                data-pick={s.id}
                onClick={() => act.current(s.id)}
                className={`relative overflow-hidden rounded-3xl border-4 p-4 text-left ${
                  s.id === current ? "border-[#ffd34d] bg-white/15" : "border-white/30 bg-white/5"
                }`}
              >
                {fill(s.id)}
                <span className="relative block text-4xl font-bold">{s.no}</span>
                <span className="relative mt-1 block text-2xl font-bold">{s.title}</span>
                <span className="relative mt-1 block text-base text-white/70">
                  {s.id === current ? "지금 체험 · 처음부터 다시" : s.line}
                </span>
              </button>
            ))}
            <button
              type="button"
              data-pick="back"
              onClick={() => setOpen(false)}
              className="relative overflow-hidden rounded-3xl border-4 border-white/30 bg-white/5 p-4 text-left"
            >
              {fill("back")}
              <span className="relative block text-4xl font-bold">←</span>
              <span className="relative mt-1 block text-2xl font-bold">돌아가기</span>
            </button>
          </div>
          {dots.map((d, i) => (
            <span
              key={i}
              className="pointer-events-none fixed size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-[#ffd34d]/80 shadow-lg"
              style={{ left: d.x, top: d.y }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
