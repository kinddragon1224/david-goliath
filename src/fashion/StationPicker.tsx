import "@fontsource/gowun-batang/700.css";
import { useEffect, useRef, useState } from "react";
import { setMenuHands } from "@/app/HandCursor";
import { PoseController } from "@/game/pose";
import {
  STATIONS,
  STATION_ART,
  TRYON,
  goTryon,
  saveStation,
  useTryonReady,
  type StationId,
} from "./stations";

type Tile = {
  key: StationId | "tryon";
  no: string;
  title: string;
  line: string;
  off?: boolean;
  go: () => void;
};

/** 처음 켰을 때(또는 '체험 바꾸기' 후) 체험을 고르는 화면. 게임의 스테이지 고르기처럼 그림 카드로 보여 준다.
 * 터치·리모컨 방향키로 고른다. */
export function StationPicker({ onPick }: { onPick: (id: StationId) => void }) {
  const tryon = useTryonReady();
  const tiles: Tile[] = [
    {
      key: "tryon",
      ...TRYON,
      // 가상 착장만 인터넷이 필요하다(사무실 PC로 연결). 기기가 인터넷에 없을 때가 가장 흔한 원인이라 그렇게 알려 준다
      line: tryon ? TRYON.line : "인터넷에 연결되어야 해요 · 연결 확인 중",
      off: !tryon,
      go: goTryon,
    },
    ...STATIONS.map((s) => ({
      key: s.id,
      no: s.no,
      title: s.title,
      line: s.line,
      go: () => {
        saveStation(s.id);
        onPick(s.id);
      },
    })),
  ];
  // 마우스·터치가 없는 기기: 카메라로 손을 읽어 손 커서(HandCursor)로 칸을 고른다. 팔 닿는 범위를 화면 전체에 펼친다.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const pose = new PoseController();
    let raf = 0;
    let starting = false;
    const start = () => {
      const video = videoRef.current;
      if (starting || !video) return;
      starting = true;
      pose
        .start(video)
        .catch(() => {
          pose.status = "denied";
        })
        .finally(() => {
          starting = false;
        });
    };
    start();
    const retry = window.setInterval(() => {
      if (pose.status === "off" || pose.status === "denied") start();
    }, 5000);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const frame = pose.status === "live" ? pose.tick(now) : null;
      const hands =
        frame && pose.poseReady
          ? frame.reach.flatMap((h) =>
              h ? [{ x: h.x * window.innerWidth, y: h.y * window.innerHeight }] : [],
            )
          : [];
      setMenuHands(hands);
      setSeen(hands.length > 0);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(retry);
      setMenuHands([]);
      pose.stop();
    };
  }, []);
  return (
    <div className="f-root fixed inset-0 flex flex-col overflow-hidden">
      <img src="/art/iron.webp" alt="" className="f-pick-bg absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(7,8,12,0.35),rgba(7,8,12,0.92)_75%)]" />
      <header className="relative px-[3vmin] pt-[4vmin] text-center">
        <p className="text-[1.7vmin] tracking-[0.5em] text-[var(--f-gold)]">
          2026 WEAVE ON FESTIVAL
        </p>
        <h1 className="f-serif mt-[1vmin] text-[6.4vmin] leading-tight">
          몸으로 즐기는 <span className="f-pearl">AX 체험</span>
        </h1>
        <p className="f-pick-cta f-serif mt-[1.2vmin] text-[2.4vmin] text-[var(--f-ink)]">
          ◆ 체험을 골라 주세요 ◆
        </p>
        <p className="mt-[0.8vmin] text-[2vmin] text-[var(--f-muted)]">
          {seen
            ? "하고 싶은 체험에 손을 올리고 1초 기다려 주세요"
            : "카메라 앞에 서서 손을 들어 보세요 · 손으로 고를 수 있어요"}
        </p>
        <video ref={videoRef} className="pointer-events-none absolute size-px opacity-0" playsInline muted autoPlay />
      </header>
      <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-[2vmin] p-[3vmin] landscape:grid-cols-6 landscape:py-[5vmin]">
        {tiles.map((t, i) => {
          const a = STATION_ART[t.key];
          return (
            <button
              key={t.key}
              type="button"
              autoFocus={i === 1}
              disabled={t.off}
              onClick={t.go}
              className="f-pick hand-fill group text-left"
              style={{ "--i": i } as React.CSSProperties}
            >
              <img
                src={a.art}
                alt=""
                className="f-pick-art absolute inset-0 size-full object-cover"
                style={{ objectPosition: a.at }}
              />
              <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,12,0.1)_0%,rgba(7,8,12,0.25)_45%,rgba(7,8,12,0.96)_82%)]" />
              {a.prop && (
                <img
                  src={a.prop}
                  alt=""
                  className="f-pick-prop absolute top-[14%] left-1/2 h-[42%] w-[80%] object-contain"
                />
              )}
              <span className="f-serif f-pearl absolute top-[2%] left-[6%] text-[6vmin] leading-none">
                {t.no}
              </span>
              <span className="absolute inset-x-0 bottom-0 block p-[1.8vmin]">
                <span className="f-serif block text-[3.1vmin] leading-tight">{t.title}</span>
                <span className="mt-[0.6vmin] block text-[1.7vmin] leading-snug text-[var(--f-muted)]">
                  {t.line}
                </span>
                <span className="f-pick-go f-serif mt-[1.2vmin] inline-block rounded-full px-[1.6vmin] py-[0.5vmin] text-[1.8vmin]">
                  {t.off ? "준비 중" : "시작 ▶"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
