import { useEffect, useRef } from "react";
import { stepDwell, type Dwell } from "./dwell";

type Pt = { x: number; y: number };

/** 사람 손 위치(화면 px). 게임 루프가 매 프레임 넣고, 게임 중에는 비운다. */
let hands: Pt[] = [];
export function setMenuHands(pts: Pt[]): void {
  hands = pts;
}

/** 손을 이만큼(초) 올려 두면 누른다. */
const HOLD = 1.2;
/** 손 인식이 떨려도 커서는 부드럽게(초당 따라붙는 빠르기). 화면이 뜸해도 같은 시간에 따라붙는다. */
const SMOOTH = 14;
const CLICKABLE = "button:not([disabled]):not([data-no-hand])";

function buttonAt(p: Pt): HTMLElement | null {
  return document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>(CLICKABLE) ?? null;
}

/** 터치 없는 TV용 마우스: 손이 커서가 되고, 버튼 위에 머물면 게이지가 차서 눌린다. 모든 화면 공용. */
export function HandCursor() {
  const dots = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let dwell: Dwell<HTMLElement> = { target: null, k: 0, spent: null };
    let shown: (Pt | null)[] = [null, null];
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // TV가 느려 프레임이 뜸해도 머무는 시간은 같게
      const dt = Math.min(0.3, (now - last) / 1000);
      last = now;
      const follow = 1 - Math.exp(-SMOOTH * dt);
      shown = [0, 1].map((i) => {
        const h = hands[i];
        const s = shown[i];
        if (!h) return null;
        return s ? { x: s.x + (h.x - s.x) * follow, y: s.y + (h.y - s.y) * follow } : h;
      });
      const on = shown.filter((p): p is Pt => !!p);
      const hits = on.map(buttonAt);
      const over = hits.find((el) => el === dwell.target) ?? hits.find(Boolean) ?? null;
      const { next, fired } = stepDwell(dwell, over, dt, HOLD);
      dwell = next;
      fired?.click();
      shown.forEach((p, i) => {
        const el = dots.current[i];
        if (!el) return;
        el.style.display = p ? "block" : "none";
        if (!p) return;
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        const k = hits[on.indexOf(p)] === dwell.target ? dwell.k : 0;
        el.style.background = `conic-gradient(#ffd34d ${k * 360}deg, rgba(255,255,255,0.3) 0)`;
      });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {[0, 1].map((i) => (
        <div
          key={i}
          ref={(el) => {
            dots.current[i] = el;
          }}
          className="pointer-events-none fixed top-0 left-0 z-[80] hidden size-14 rounded-full border-4 border-white shadow-[0_0_1rem_rgba(0,0,0,0.6)]"
        />
      ))}
    </>
  );
}
