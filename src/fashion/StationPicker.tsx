import "@fontsource/gowun-batang/700.css";
import { STATIONS, TRYON, goTryon, saveStation, useTryonReady, type StationId } from "./stations";

/** 처음 켰을 때(또는 '체험 바꾸기' 후) 이 기기에서 돌릴 체험을 고른다. 리모컨 방향키로도 고른다. */
export function StationPicker({ onPick }: { onPick: (id: StationId) => void }) {
  const tryon = useTryonReady();
  return (
    <div className="f-root fixed inset-0 flex flex-col items-center justify-center gap-8 overflow-auto p-6">
      <div className="text-center">
        <p className="text-sm tracking-[0.35em] text-[var(--f-muted)]">2026 WEAVE ON FESTIVAL</p>
        <h1 className="f-serif mt-2 text-4xl sm:text-5xl">
          몸으로 즐기는 <span className="f-pearl">AX 체험</span>
        </h1>
        <p className="mt-3 text-base text-[var(--f-muted)]">
          이 화면에서 운영할 체험을 골라 주세요. 다음부터는 바로 시작합니다.
        </p>
      </div>
      <div className="grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          type="button"
          disabled={!tryon}
          onClick={goTryon}
          className="f-card group p-6 text-left transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-3 focus-visible:outline-white disabled:opacity-45"
        >
          <span className="f-serif f-pearl text-4xl">{TRYON.no}</span>
          <span className="f-serif mt-2 block text-2xl">{TRYON.title}</span>
          <span className="mt-1 block text-sm text-[var(--f-muted)]">
            {tryon ? TRYON.line : "이 PC에서 가상 착장을 켜면 열려요"}
          </span>
        </button>
        {STATIONS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            autoFocus={i === 0}
            onClick={() => {
              saveStation(s.id);
              onPick(s.id);
            }}
            className="f-card group p-6 text-left transition-transform hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:outline-3 focus-visible:outline-white"
          >
            <span className="f-serif f-pearl text-4xl">{s.no}</span>
            <span className="f-serif mt-2 block text-2xl">{s.title}</span>
            <span className="mt-1 block text-sm text-[var(--f-muted)]">{s.line}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
