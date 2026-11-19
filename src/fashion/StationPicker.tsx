import "@fontsource/gowun-batang/700.css";
import { useEffect, useRef, useState } from "react";
import { setMenuHands } from "@/app/HandCursor";
import { PRODUCER } from "@/game/constants";
import { PoseController } from "@/game/pose";
import { BRANDS } from "./garments";
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

/** 손으로 고를 때 덜 예민하게 하는 두 값. 현장에서 여전히 잘못 눌리면 둘 다 조금씩 올린다.
 * PICK_HOLD: 칸 위에 손을 이만큼(초) 올려 둬야 고른다(다른 버튼은 1초).
 * REST: 화면 아래 이 비율은 버튼이 없는 쉬는 자리. 손 높이는 어깨 폭 기준으로 화면에 펼쳐지는데(game/reach.ts),
 * 어깨 높이의 손이 화면 63%쯤에 오므로 0.3 이면 어깨보다 조금 아래부터는 아무것도 안 눌린다. */
const PICK_HOLD = 1.5;
const REST = 0.3;
/** 손이 이만큼(ms) 안 보여도 그 자리에 있는 것으로 친다. */
const HAND_GRACE_MS = 300;

type Tile = {
  key: StationId | "tryon" | "meteor";
  no: string;
  title: string;
  line: string;
  off?: boolean;
  /** 큰 칸: 가로 화면에서는 두 줄 높이, 세로 화면에서는 두 칸 너비. */
  big?: boolean;
  go: () => void;
};

/** 처음 켰을 때(또는 '체험 바꾸기' 후) 체험을 고르는 화면. 게임의 스테이지 고르기처럼 그림 카드로 보여 준다.
 * 일곱 칸: 01 가상 착장만 크게, 나머지 여섯은 3×2. 손(손 커서)·터치·리모컨 방향키로 고른다. */
export function StationPicker({ onPick }: { onPick: (id: StationId) => void }) {
  const tryon = useTryonReady();
  const meteor = useMeteorReady();
  const tiles: Tile[] = [
    {
      key: "tryon",
      ...TRYON,
      // 가상 착장만 인터넷이 필요하다(사무실 PC로 연결). 기기가 인터넷에 없을 때가 가장 흔한 원인이라 그렇게 알려 준다
      line: tryon ? TRYON.line : "인터넷에 연결되어야 해요 · 연결 확인 중",
      off: !tryon,
      big: true,
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
    // 꿈돌이 게임은 따로 빌드한 파일이라, 이 설치판에 들어 있을 때만 켠다
    { key: "meteor", ...METEOR, off: !meteor, go: goMeteor },
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
    // 인식이 한 번 빗나가 손이 잠깐 사라져도(약한 PC는 한 번이 0.2초) 차던 게이지가 깎이지 않게, 마지막 손을 잠깐 붙들어 둔다
    let held: { x: number; y: number }[] = [];
    let heldAt = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const frame = pose.status === "live" ? pose.tick(now) : null;
      let hands =
        frame && pose.poseReady
          ? frame.reach.flatMap((h) =>
              h ? [{ x: h.x * window.innerWidth, y: h.y * window.innerHeight }] : [],
            )
          : [];
      if (hands.length) {
        held = hands;
        heldAt = now;
      } else if (now - heldAt < HAND_GRACE_MS) hands = held;
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
    // 바탕은 남색 원단 + 옷본 모눈(styles.css 의 .f-cloth). 예전의 홀로그램 배경 그림은 쓰지 않는다
    <div className="f-root f-day fixed inset-0 flex flex-col overflow-hidden">
      {/* 바탕: 맞춤패션거리 풍경(GPT로 그린 그림, scripts/gpt-art.mjs). 위쪽은 제목이 읽히게 밝은 광목빛으로 살짝 덮는다(11/19: 군청 덮개와 군청 칸을 걷어 냄) */}
      <img src="/art/street.webp" alt="" className="absolute inset-0 size-full object-cover object-bottom" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,250,240,0.82)_0%,rgba(255,250,240,0.5)_22%,rgba(255,250,240,0.12)_55%,rgba(255,250,240,0)_100%)]" />
      {/* 머리: 왼쪽 행사 로고 · 가운데 제목과 때·곳 */}
      <header className="relative flex flex-col items-center gap-[1.5vmin] px-[3vmin] pt-[2vmin] text-center landscape:grid landscape:grid-cols-[1fr_auto_1fr]">
        <img
          src="/brand/logo-weaveon.png"
          alt="위브온 중촌"
          className="h-[9.5vmin] w-auto drop-shadow-[0_0.6vmin_1.6vmin_rgba(0,0,0,0.6)] landscape:justify-self-start"
        />
        <div>
          <h1 className="f-serif text-[5.8vmin] leading-tight text-[var(--f-ink)]">몸으로 즐기는 AX 체험</h1>
          <p className="mt-[0.4vmin] text-[1.9vmin] text-[var(--f-muted)]">
            위브온 페스티벌 · 11월 20일(금) 오후 2시~6시 · 대전 중구 중촌동 맞춤패션 플랫폼
          </p>
        </div>
        <video ref={videoRef} className="pointer-events-none absolute size-px opacity-0" playsInline muted autoPlay />
      </header>
      {/* 줄자 띠: 맞춤패션거리 행사의 표식 */}
      <div className="f-tape relative mt-[1.6vmin]" />
      {/* 칸은 화면 위쪽에만 둔다: 손을 내리고 서 있거나 가슴 높이에서 움직이는 손은 아래 쉬는 자리에 떨어져 아무것도 눌리지 않는다 */}
      <div className="relative grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-[2vmin] px-[3vmin] pt-[2vmin] landscape:grid-cols-[1.2fr_1fr_1fr_1fr] landscape:grid-rows-2">
        {tiles.map((t, i) => {
          const a = STATION_ART[t.key];
          return (
            <button
              key={t.key}
              type="button"
              autoFocus={i === 1}
              disabled={t.off}
              onClick={t.go}
              data-hold={PICK_HOLD}
              className={`f-pick hand-fill group text-left ${t.big ? "col-span-2 landscape:col-span-1 landscape:row-span-2" : ""}`}
              style={{ "--i": i } as React.CSSProperties}
            >
              {/* 칸은 원단 조각(바탕은 styles.css 의 .f-pick). 그림은 세 가지 중 하나:
                  큰 칸(가상 착장) = 옷걸이에 건 룩북 옷 세 벌 / 소품이 있는 칸 = 오른쪽에 소품 / 소품이 없는 칸(꿈돌이) = 오른쪽에 게임 화면 */}
              {t.big ? (
                <span className="absolute inset-x-[8%] top-[19%] flex h-[48%] items-start justify-center">
                  {BRANDS.slice(0, 3).map((g, k) => (
                    <img
                      key={g.photo}
                      src={`/brand/${g.photo}.webp`}
                      alt=""
                      className="h-full w-[36%] rounded-[1.4vmin] border-[0.3vmin] border-[var(--f-frame)] bg-[#f3efe6] object-contain p-[0.6vmin] shadow-[0_1vmin_2.4vmin_rgba(0,0,0,0.5)]"
                      style={{ rotate: `${(k - 1) * 5}deg`, marginLeft: k ? "-6%" : 0, translate: `0 ${k === 1 ? "-4%" : "3%"}` }}
                    />
                  ))}
                </span>
              ) : a.prop ? (
                <img
                  src={a.prop}
                  alt=""
                  className="f-pick-prop f-pick-side absolute top-[7%] right-[3%] h-[86%] w-[40%] object-contain"
                />
              ) : (
                <img
                  src={a.art}
                  alt=""
                  className="absolute inset-y-0 right-0 h-full w-[62%] object-cover [mask-image:linear-gradient(90deg,transparent,#000_45%)]"
                  style={{ objectPosition: a.at }}
                />
              )}
              <span className="f-stitch" />
              <span
                className={`f-serif absolute leading-none text-[var(--f-gold)] ${t.big ? "top-[3%] left-[7%] text-[8vmin]" : "top-[9%] left-[6%] text-[5vmin]"}`}
              >
                {t.no}
              </span>
              {/* 좁은 칸(4:3 태블릿)에서 "챌린/지"처럼 낱말 가운데서 끊기지 않게 낱말 단위로 줄을 바꾼다 */}
              <span
                className={`absolute bottom-0 left-0 block [word-break:keep-all] ${t.big ? "w-full px-[3.2vmin] pb-[3vmin]" : "w-[66%] px-[2.6vmin] pb-[2.4vmin]"}`}
              >
                <span
                  className={`f-serif block leading-tight ${t.big ? "text-[4.8vmin]" : "text-[3.1vmin]"}`}
                >
                  {t.title}
                </span>
                <span
                  className={`mt-[0.6vmin] block leading-snug text-[var(--f-muted)] ${t.big ? "text-[2.2vmin]" : "text-[1.75vmin]"}`}
                >
                  {t.line}
                </span>
                {t.off && (
                  <span className="f-pick-go f-serif mt-[1.2vmin] inline-block rounded-full px-[1.6vmin] py-[0.5vmin] text-[1.8vmin]">
                    준비 중
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {/* 쉬는 자리(화면 아래 REST): 버튼 없이 고르는 법과 함께하는 곳만. 지금 할 단계가 밝게 켜진다 */}
      <footer
        className="pointer-events-none relative flex shrink-0 flex-col items-center justify-center gap-[2vmin] px-[3vmin]"
        style={{ height: `${REST * 100}%` }}
      >
        {/* 거리의 주민 둘: 대전 중구 SNS 캐릭터 중구할매(왼쪽)와 손자 중구(오른쪽). 대표님이 준 공식 그림(11/19).
            그림 둘레에 빈 자리가 많아 크게 깔고 아래로 내린다. 가로 화면에서만(세로는 자리가 없다) */}
        <img src="/art/junggu-halmae.webp" alt="" className="absolute bottom-[-13%] left-[1%] hidden h-[112%] w-auto landscape:block" />
        <img src="/art/junggu-son.webp" alt="" className="absolute right-[1%] bottom-[-13%] hidden h-[112%] w-auto landscape:block" />
        <ol className="relative flex flex-wrap items-center justify-center gap-[1.4vmin] text-[2.5vmin]">
          {["카메라 앞에 서요", "손을 들어 체험 위에 올려요", "주황빛이 다 차면 시작!"].map((s, i) => (
            <li
              key={s}
              className={`f-step f-serif flex items-center gap-[1.2vmin] rounded-full py-[0.7vmin] pr-[2.4vmin] pl-[0.7vmin] ${(i === 0) !== seen ? "f-step-on" : ""}`}
            >
              <b className="grid size-[4vmin] place-items-center rounded-full">{i + 1}</b>
              {s}
            </li>
          ))}
        </ol>
        {/* 함께하는 곳: 로고가 짙은 색이라 흰 띠 위에 원래 색 그대로 둔다 */}
        <div className="flex items-center gap-[3.5vmin] rounded-full bg-white/95 px-[4.5vmin] py-[0.9vmin] shadow-[0_0.8vmin_2.4vmin_rgba(0,0,0,0.6)]">
          <img src="/brand/logo-youth.png" alt="청년마을" className="h-[5vmin] w-auto" />
          <i className="h-[3.4vmin] w-px bg-black/15" />
          <img src="/brand/logo-bargium.png" alt="BARGIUM" className="h-[3vmin] w-auto" />
          <i className="h-[3.4vmin] w-px bg-black/15" />
          {/* 제작사는 함께하는 곳과 구분해 '제작'을 붙여 작게 */}
          <span className="flex items-center gap-[1vmin] text-[1.5vmin] font-bold text-black/55">
            제작
            <img src={PRODUCER.logo} alt={PRODUCER.name} className="h-[2.5vmin] w-auto" />
          </span>
        </div>
      </footer>
    </div>
  );
}
