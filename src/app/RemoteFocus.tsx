import { useEffect } from "react";
import { isTv } from "@/game/kiosk";

/** 지금 화면에서 실제로 누를 수 있는 버튼(다른 판에 가려진 것은 뺀다). */
function buttons(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("button:not([disabled])")].filter((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!top && el.contains(top);
  });
}

/** 터치 없는 TV: 리모컨 위·아래로 버튼을 차례로 고르고 확인으로 누른다.
 * 왼쪽·오른쪽은 3번 누르면 화면이 도는 키라 쓰지 않는다. 세운 TV에서도 방향이 헷갈리지 않게 순서로만 옮긴다. */
export function RemoteFocus() {
  useEffect(() => {
    if (!isTv()) return;
    const style = document.createElement("style");
    style.textContent = "button:focus{outline:0.4rem solid #ffd34d;outline-offset:0.15rem}";
    document.head.append(style);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      e.preventDefault();
      const list = buttons();
      if (!list.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const at = list.indexOf(document.activeElement as HTMLElement);
      const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : at + step;
      list[(next + list.length) % list.length].focus();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
      style.remove();
    };
  }, []);
  return null;
}
