import { useEffect, useState } from "react";
import { calibratePlayZone, clearPlayZone, playZone } from "@/game/pose";

const WAIT_S = 5;

/** 운영자 화면: 놀이 자리 맞추기. 누르고 5초 안에 어른 한 명이 바닥 표시 위에 서면,
 * 그보다 한참 뒤(줄)나 옆(구경꾼)에 선 사람은 이 PC의 모든 게임에서 인식하지 않는다. */
export function PlayZoneButton({ className }: { className: string }) {
  const [left, setLeft] = useState(0);
  const [note, setNote] = useState(() => (playZone() ? "맞춰져 있음" : "아직 안 맞춤"));
  useEffect(() => {
    if (left <= 0) return;
    const id = window.setTimeout(() => {
      if (left > 1) return setLeft(left - 1);
      setLeft(0);
      setNote(calibratePlayZone() ? "맞췄어요" : "사람이 안 보여요 · 다시 눌러 주세요");
    }, 1000);
    return () => window.clearTimeout(id);
  }, [left]);
  return (
    <div className="space-y-1">
      <button type="button" onClick={() => setLeft(WAIT_S)} className={className}>
        {left > 0 ? `${left}초 뒤 맞춥니다 · 어른 한 명이 놀이 자리에 서 주세요` : "놀이 자리 맞추기 (뒤에 줄 선 사람 안 잡기)"}
      </button>
      <p className="flex justify-between text-sm opacity-70">
        <span>{note}</span>
        <button
          type="button"
          className="underline"
          onClick={() => {
            clearPlayZone();
            setNote("해제함 · 화면의 모든 사람을 봅니다");
          }}
        >
          해제
        </button>
      </p>
    </div>
  );
}
