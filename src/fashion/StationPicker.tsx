import "@fontsource/gowun-batang/700.css";
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
      line: tryon ? TRYON.line : "이 PC에서 가상 착장을 켜면 열려요",
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
              className="f-pick group text-left"
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
