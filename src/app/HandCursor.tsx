import { useEffect, useRef } from "react";
import { stepDwell, type Dwell } from "./dwell";

type Pt = { x: number; y: number };

/** 사람 손 위치(화면 px). 게임 루프가 매 프레임 넣고, 게임 중에는 비운다. */
let hands: Pt[] = [];
export function setMenuHands(pts: Pt[]): void {
  hands = pts;
}

/** 양손 번쩍(바로 고르기). 고르는 화면과 체험 고르는 판이 매 프레임 넣는다. 대기 화면에서는 양손 번쩍이 게임 시작이라 넣지 않는다. */
let confirm = false;
export function setMenuConfirm(on: boolean): void {
  confirm = on;
}

/** 체험 고르는 판이 열려 있나. 열려 있으면 양손 번쩍을 시작 동작으로 읽지 않는다. */
let menuOpen = false;
export const isMenuOpen = () => menuOpen;
export function setMenuOpen(open: boolean): void {
  menuOpen = open;
}

/** 손을 이만큼(초) 올려 두면 누른다. 버튼에 data-hold="1.5" 를 적으면 그 버튼만 그만큼 기다린다(잘못 눌리면 곤란한 버튼용). */
const HOLD = 1;
/** 누른 뒤 이만큼(초)은 쉰다. 판이 바뀌자마자 그 자리의 버튼이 눌리지 않게. */
const COOL = 0.6;
/** 게이지가 차는 버튼은 이만큼(px) 벗어나도 붙들어 둔다. 손이 떨려 옆 버튼으로 넘어가 처음부터 차는 것을 막는다. */
const STICK = 40;
/** 손 인식이 떨려도 커서는 부드럽게(초당 따라붙는 빠르기). 화면이 뜸해도 같은 시간에 따라붙는다. */
const SMOOTH = 14;
/** 11/19: 두 손이 다 커서가 되어 고르기 어렵다는 지적으로, 더 높이 든 손 하나만 커서로 쓴다.
 * 다른 손이 화면 높이의 이만큼 더 높아져야 커서가 그 손으로 넘어간다(두 손 높이가 비슷할 때 왔다 갔다 하지 않게). */
const SWITCH = 0.08;
/** 커서가 버튼 위에 이만큼(초) 머물면 그 버튼이 '고른 것'이 된다(테두리가 켜진다). 양손을 드는 길에 스친 버튼으로 바뀌지 않게 조금 기다린다. */
const FOCUS_SEC = 0.45;
/** 커서가 떠나도 고른 것을 이만큼(초) 붙들어 둔다: 양손을 번쩍 드는 동안 커서는 위로 떠난다. */
const FOCUS_KEEP = 2.5;
/** 고른 것이 있을 때 양손 번쩍을 이만큼(초) 하면 바로 누른다. */
const CONFIRM_SEC = 0.35;
const CLICKABLE = "button:not([disabled]):not([data-no-hand])";

function buttonAt(p: Pt): HTMLElement | null {
  return document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>(CLICKABLE) ?? null;
}

function nearButton(p: Pt, el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return (
    p.x > r.left - STICK && p.x < r.right + STICK && p.y > r.top - STICK && p.y < r.bottom + STICK
  );
}

/** 터치 없는 TV용 마우스: 손이 커서가 되고, 버튼 위에 머물면 게이지가 차서 눌린다. 모든 화면 공용. */
export function HandCursor() {
  const dots = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let dwell: Dwell<HTMLElement> = { target: null, k: 0, spent: null };
    let shown: (Pt | null)[] = [null, null];
    let cool = 0;
    let filling: HTMLElement | null = null;
    let active = 0;
    let cand: HTMLElement | null = null;
    let candT = 0;
    let focus: HTMLElement | null = null;
    let focusLeft = 0;
    let confirmT = 0;
    const setFocus = (el: HTMLElement | null) => {
      if (focus === el) return;
      focus?.removeAttribute("data-hand-focus");
      focus = el;
      focus?.setAttribute("data-hand-focus", "");
    };
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
      // 더 높이 든 손 하나만 커서
      const other = 1 - active;
      if (!shown[active] || (shown[other] && shown[other]!.y < shown[active]!.y - window.innerHeight * SWITCH)) {
        if (shown[other]) active = other;
      }
      shown = shown.map((p, i) => (i === active ? p : null));
      const on = shown.filter((p): p is Pt => !!p);
      const hits = on.map(buttonAt);
      const held = dwell.target;
      cool = Math.max(0, cool - dt);
      const over =
        cool > 0
          ? null
          : held && on.some((p) => nearButton(p, held))
            ? held
            : (hits.find(Boolean) ?? null);
      const { next, fired } = stepDwell(dwell, over, dt, Number(over?.dataset.hold) || HOLD);
      dwell = next;
      if (fired) {
        cool = COOL;
        fired.click();
      }
      // 고른 것(테두리)과 양손 번쩍으로 바로 누르기
      const hit = cool > 0 ? null : (hits.find(Boolean) ?? null);
      if (!confirm) {
        candT = hit && hit === cand ? candT + dt : 0;
        cand = hit;
        if (cand && candT >= FOCUS_SEC) setFocus(cand);
        focusLeft = hit && hit === focus ? FOCUS_KEEP : focusLeft - dt;
        if (focusLeft <= 0 || (focus && !focus.isConnected)) setFocus(null);
      }
      confirmT = confirm && focus && cool <= 0 ? confirmT + dt : 0;
      if (focus && confirmT >= CONFIRM_SEC) {
        const el = focus;
        setFocus(null);
        confirmT = 0;
        cool = COOL;
        if (el.isConnected) el.click();
      }
      // 버튼 자체에 게이지를 채운다. 손 끝의 작은 원보다 멀리서 잘 보인다
      if (filling !== dwell.target) filling?.style.removeProperty("--dwell");
      filling = dwell.target;
      filling?.style.setProperty("--dwell", String(dwell.k));
      shown.forEach((p, i) => {
        const el = dots.current[i];
        if (!el) return;
        el.style.display = p ? "block" : "none";
        if (!p) return;
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        const k = dwell.target && nearButton(p, dwell.target) ? dwell.k : 0;
        el.style.background = `conic-gradient(#ffd34d ${k * 360}deg, rgba(255,255,255,0.3) 0)`;
      });
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setFocus(null);
    };
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
