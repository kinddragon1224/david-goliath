import { Volume2, VolumeX } from "lucide-react";
import type { ReactNode } from "react";
import { CHURCH_NAME, GAME_TITLE, LEADERBOARD_SHOW, PRODUCER } from "./constants";
import { formatScoreDate } from "./scores";
import type { UiSnap } from "./types";

type Props = {
  ui: UiSnap;
  onBegin: () => void;
  onStart: () => void;
  onNext: () => void;
  onMute: () => void;
  onAskReset: () => void;
  onConfirmReset: () => void;
  onCancelReset: () => void;
  onRetryCamera: () => void;
  onRetryMotion: () => void;
  onOpenWindow: () => void;
  onSkipPractice: () => void;
};

export function Overlays({
  ui,
  onBegin,
  onStart,
  onNext,
  onMute,
  onAskReset,
  onConfirmReset,
  onCancelReset,
  onRetryCamera,
  onRetryMotion,
  onOpenWindow,
  onSkipPractice,
}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col text-fg">
      <button
        type="button"
        onClick={onMute}
        className="t-btn pointer-events-auto absolute top-3 right-3 z-20 flex size-12 items-center justify-center bg-cream text-ink"
        aria-label={ui.muted ? "소리 켜기" : "소리 끄기"}
      >
        {ui.muted ? <VolumeX className="size-5" strokeWidth={3} /> : <Volume2 className="size-5" strokeWidth={3} />}
      </button>

      {ui.phase === "boot" && <Boot ui={ui} onBegin={onBegin} />}
      {ui.phase === "attract" && (
        <Attract
          ui={ui}
          onStart={onStart}
          onAskReset={onAskReset}
          onRetryCamera={onRetryCamera}
          onRetryMotion={onRetryMotion}
        />
      )}
      {ui.phase === "start" && (
        <Start ui={ui} onStart={onStart} onRetryCamera={onRetryCamera} onRetryMotion={onRetryMotion} onOpenWindow={onOpenWindow} />
      )}
      {ui.phase === "practice" && <Practice ui={ui} onSkip={onSkipPractice} />}
      {ui.phase === "countdown" && <Countdown n={ui.countdown} />}
      {ui.phase === "play" && <Hud ui={ui} />}
      {ui.phase === "result" && <Result ui={ui} onNext={onNext} />}

      {ui.confirmReset && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink/60 px-8">
          <div className="t-panel w-full max-w-sm p-6 text-center">
            <p className="font-display text-2xl">기록을 모두 지울까요?</p>
            <p className="mt-2 text-sm text-fg-muted">리셋 전까지 쌓인 점수가 사라집니다.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={onCancelReset} className="t-btn h-14 flex-1 bg-cream text-lg">
                취소
              </button>
              <button type="button" onClick={onConfirmReset} className="t-btn h-14 flex-1 bg-don text-lg text-cream">
                지우기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── 공통 조각 ───────── */

function stop(e: { preventDefault: () => void; stopPropagation: () => void }) {
  e.preventDefault();
  e.stopPropagation();
}

function Ribbon({ children, tone = "don" }: { children: ReactNode; tone?: "don" | "ka" | "sun" }) {
  const bg = tone === "ka" ? "bg-ka" : tone === "sun" ? "bg-sun" : "bg-don";
  const fg = tone === "sun" ? "text-ink" : "text-cream";
  return (
    <span
      className={`inline-block rounded-full border-4 border-ink px-5 py-1 font-display text-lg leading-tight ${bg} ${fg}`}
    >
      {children}
    </span>
  );
}

function Title({ size = "lg" }: { size?: "lg" | "md" | "sm" }) {
  return (
    <h1
      className={`t-outline font-display leading-none whitespace-nowrap text-cream drop-shadow-[0_6px_0_var(--color-ink)] ${size === "lg" ? "text-5xl" : size === "md" ? "text-4xl" : "text-3xl"}`}
    >
      <span className="text-sun">다윗</span>과 <span className="text-don">골리앗</span>
      <span className="sr-only">{GAME_TITLE}</span>
    </h1>
  );
}

function LogoBadge({ size = 96 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full border-[5px] border-ink bg-white shadow-[0_5px_0_var(--color-ink)]"
      style={{ width: size, height: size }}
    >
      <img src="/logo-alllove.jpg" alt={CHURCH_NAME} className="size-full scale-125 object-cover" />
    </div>
  );
}

function VerseBlock({ ui, large, compact }: { ui: UiSnap; large?: boolean; compact?: boolean }) {
  const words = ui.verse.text.trim().split(/\s+/);
  return (
    <div className="t-panel relative w-full px-5 pt-7 pb-4 text-center">
      <div className="absolute -top-5 left-1/2 -translate-x-1/2">
        <Ribbon tone="ka">오늘의 말씀</Ribbon>
      </div>
      <blockquote
        className={`font-display leading-snug text-ink ${large ? "text-2xl" : compact ? "text-lg" : "text-xl"}`}
        style={{ wordBreak: "keep-all", lineBreak: "strict" }}
      >
        {words.map((word, i) => (
          <span key={`${i}-${word}`}>
            {i > 0 ? " " : null}
            <span className="whitespace-nowrap">{word}</span>
          </span>
        ))}
      </blockquote>
      <p className="mt-2 text-sm font-bold text-fg-muted">{ui.verse.ref}</p>
    </div>
  );
}

function HintPill({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="mx-auto w-fit max-w-[92%] rounded-full border-4 border-ink bg-cream px-4 py-1.5 text-center text-sm font-bold text-ink text-pretty">
      {children}
    </p>
  );
}

/** 제작사 표기. full이면 사업자 정보까지. */
function Credit({ full }: { full?: boolean }) {
  if (!full) {
    return (
      <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-fg-muted">
        <span>제작</span>
        <img src={PRODUCER.logo} alt={PRODUCER.name} className="h-3.5 w-auto" />
      </div>
    );
  }
  return (
    <div className="w-full rounded-2xl border-4 border-ink bg-paper/95 px-4 py-2.5 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="font-display text-sm text-fg-muted">제작</span>
        <img src={PRODUCER.logo} alt={PRODUCER.name} className="h-5 w-auto" />
      </div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-fg-muted text-pretty" style={{ wordBreak: "keep-all" }}>
        상호 {PRODUCER.name} · 대표 {PRODUCER.ceo} · 사업자등록번호 {PRODUCER.bizNo}
        <br />
        {PRODUCER.address} · {PRODUCER.phone} · {PRODUCER.email}
      </p>
    </div>
  );
}

/* ───────── 화면별 ───────── */

function Boot({ ui, onBegin }: { ui: UiSnap; onBegin: () => void }) {
  return (
    <button
      type="button"
      onPointerUp={(e) => {
        stop(e);
        onBegin();
      }}
      onClick={(e) => {
        stop(e);
        onBegin();
      }}
      className="pointer-events-auto relative flex h-full w-full touch-manipulation flex-col items-center justify-center gap-6 bg-ink/40 px-7 pb-28 text-center"
    >
      <LogoBadge size={104} />
      <div className="flex flex-col items-center gap-3">
        <Title />
        <p className="t-outline-sm font-display text-lg tracking-wide text-cream">{CHURCH_NAME}</p>
      </div>
      <VerseBlock ui={ui} large />
      <span className="t-btn animate-throb bg-don px-9 py-4 text-2xl text-cream">화면을 눌러 시작</span>
      <div className="absolute inset-x-4 bottom-4">
        <Credit full />
      </div>
    </button>
  );
}

const MEDAL = ["bg-sun", "bg-[#d9dde6]", "bg-[#e0955a]"];

function Attract({
  ui,
  onStart,
  onAskReset,
  onRetryCamera,
  onRetryMotion,
}: {
  ui: UiSnap;
  onStart: () => void;
  onAskReset: () => void;
  onRetryCamera: () => void;
  onRetryMotion: () => void;
}) {
  const top = ui.scores.slice(0, LEADERBOARD_SHOW);
  return (
    <>
      <header className="pointer-events-none flex flex-col items-center gap-2 px-4 pt-4">
        <div className="flex items-center gap-2 pr-12">
          <LogoBadge size={46} />
          <Title size="sm" />
        </div>
        <div className="mt-4 w-full">
          <VerseBlock ui={ui} compact />
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center">
        {!ui.checkMode && ui.cameraState === "live" && ui.modelState === "ready" && (
          <HandsUpPrompt progress={ui.handsUpProgress} small />
        )}
      </div>
      {ui.banner && (
        <div className="mb-3 px-5">
          <HintPill>{ui.banner}</HintPill>
        </div>
      )}
      <section className="t-panel pointer-events-auto mx-4 mb-4 shrink-0 p-4">
        <button
          type="button"
          onPointerUp={(e) => {
            stop(e);
            onStart();
          }}
          onClick={(e) => {
            stop(e);
            onStart();
          }}
          className="t-btn h-14 w-full touch-manipulation bg-don text-2xl text-cream"
        >
          시작하기
        </button>
        <p className="mt-2.5 text-center text-sm font-bold text-fg-muted">{ui.motionHint}</p>
        {ui.checkMode ? (
          <p className="mt-1 text-center text-xs text-fg-muted">화면을 밀어 던집니다. 점검 점수는 기록되지 않습니다.</p>
        ) : (
          ui.cameraState === "denied" && (
            <p className="mt-1 text-center text-xs text-fg-muted">웹캠이 없어도 화면을 밀어 던질 수 있습니다.</p>
          )
        )}
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.dataset.t = String(performance.now());
          }}
          onPointerUp={(e) => {
            const started = Number(e.currentTarget.dataset.t ?? 0);
            if (performance.now() - started > 1400) onAskReset();
          }}
          className="mt-3 flex w-full items-center justify-between"
        >
          <Ribbon tone="sun">명예의 전당</Ribbon>
          <span className="text-[11px] text-fg-muted">길게 눌러 초기화</span>
        </button>
        <ol className="mt-1.5 space-y-1">
          {top.length === 0 && <li className="py-2 text-center font-display text-lg text-fg-muted">첫 번째 용사를 기다립니다</li>}
          {top.map((row, i) => (
            <li key={`${row.at}-${i}`} className="flex items-center gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[3px] border-ink font-display text-base ${MEDAL[i] ?? "bg-cream"}`}
              >
                {i + 1}
              </span>
              <span className="flex-1 font-display text-lg tabular-nums">{row.score.toLocaleString("ko-KR")}</span>
              <span className="text-xs text-fg-muted">{formatScoreDate(row.at)}</span>
            </li>
          ))}
        </ol>
        {!ui.checkMode && ui.cameraState === "denied" && (
          <button type="button" onClick={onRetryCamera} className="mt-3 h-10 w-full text-sm font-bold text-fg-muted underline">
            카메라 다시 시도
          </button>
        )}
        {ui.modelState === "failed" && (
          <button type="button" onClick={onRetryMotion} className="mt-2 h-10 w-full text-sm font-bold text-fg-muted underline">
            모션 다시 준비
          </button>
        )}
        <div className="mt-2.5 border-t-2 border-dashed border-ink/20 pt-2">
          <Credit />
        </div>
      </section>
    </>
  );
}

function Start({
  ui,
  onStart,
  onRetryCamera,
  onRetryMotion,
  onOpenWindow,
}: {
  ui: UiSnap;
  onStart: () => void;
  onRetryCamera: () => void;
  onRetryMotion: () => void;
  onOpenWindow: () => void;
}) {
  return (
    <div
      className="pointer-events-auto flex h-full flex-col items-center justify-center gap-6 overflow-y-auto bg-ink/45 px-6 py-8 text-center"
      onPointerUp={(e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest("[data-keep-click]")) return;
        onStart();
      }}
    >
      <LogoBadge size={88} />
      <div className="mt-2 w-full">
        <VerseBlock ui={ui} />
      </div>
      {!ui.checkMode && ui.cameraState === "live" && ui.modelState === "ready" && (
        <HandsUpPrompt progress={ui.handsUpProgress} />
      )}
      <button
        type="button"
        onPointerUp={(e) => {
          stop(e);
          onStart();
        }}
        onClick={(e) => {
          stop(e);
          onStart();
        }}
        className="t-btn h-16 w-full max-w-xs touch-manipulation bg-don text-2xl text-cream"
      >
        연습 던지기
      </button>
      <HintPill>{ui.checkMode ? "화면을 밀어 던지는 중입니다" : ui.motionHint}</HintPill>
      {!ui.checkMode && ui.cameraState === "denied" && (
        <CameraHelp ui={ui} onRetry={onRetryCamera} onOpenWindow={onOpenWindow} />
      )}
      {!ui.checkMode && ui.cameraState === "live" && ui.modelState === "failed" && (
        <ModelHelp ui={ui} onRetry={onRetryMotion} />
      )}
    </div>
  );
}

function CameraHelp({
  ui,
  onRetry,
  onOpenWindow,
}: {
  ui: UiSnap;
  onRetry: () => void;
  onOpenWindow: () => void;
}) {
  return (
    <div data-keep-click className="t-panel w-full p-4 text-left">
      <p className="font-display text-xl">카메라가 꺼져 있습니다</p>
      <p className="mt-1 text-sm text-pretty text-fg-muted">{ui.cameraError || "브라우저가 카메라를 막았습니다."}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>주소창 왼쪽 자물쇠 또는 카메라 아이콘을 누릅니다</li>
        <li>
          카메라를 <b>허용</b>으로 바꿉니다
        </li>
        <li>아래 다시 시도를 누릅니다</li>
      </ol>
      <button type="button" onClick={onRetry} className="t-btn mt-4 h-14 w-full bg-don text-lg text-cream">
        다시 시도
      </button>
      <button type="button" onClick={onOpenWindow} className="t-btn mt-3 h-14 w-full bg-cream text-lg">
        새 창에서 열기
      </button>
    </div>
  );
}

function ModelHelp({ ui, onRetry }: { ui: UiSnap; onRetry: () => void }) {
  return (
    <div data-keep-click className="t-panel w-full p-4 text-left">
      <p className="font-display text-xl">모션을 준비하지 못했습니다</p>
      <p className="mt-1 text-sm text-pretty text-fg-muted">
        {ui.modelError || "카메라는 켜져 있지만 동작 인식을 불러오지 못했습니다."}
      </p>
      <p className="mt-2 text-xs text-fg-muted">카메라는 그대로 두고, 모션만 다시 불러옵니다.</p>
      <button type="button" onClick={onRetry} className="t-btn mt-4 h-14 w-full bg-don text-lg text-cream">
        모션 다시 준비
      </button>
    </div>
  );
}

/** 양손 번쩍 그림과 유지 게이지. 다 차면 연습이 시작된다. */
function HandsUpPrompt({ progress, label = true, small }: { progress: number; label?: boolean; small?: boolean }) {
  const R = 56;
  const len = 2 * Math.PI * R;
  const holding = progress > 0.02;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 140 140" className={`${small ? "size-28" : "size-36"} ${holding ? "" : "animate-bob"}`} aria-hidden="true">
        <circle cx="70" cy="70" r={R} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth="18" />
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-cream)" strokeWidth="9" />
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="var(--color-don)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${len * progress} ${len}`}
          transform="rotate(-90 70 70)"
        />
        <g transform="translate(10 6)">
          <g fill="none" stroke="var(--color-ink)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round">
            <path d="M60 64v26M60 74L38 46M60 74l22-28M60 90l-13 22M60 90l13 22" />
          </g>
          <g fill="none" stroke="var(--color-orange)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M60 64v26M60 74L38 46M60 74l22-28M60 90l-13 22M60 90l13 22" />
          </g>
          <circle cx="60" cy="46" r="14" fill="var(--color-sun)" stroke="var(--color-ink)" strokeWidth="5" />
          <circle cx="35" cy="40" r="8" fill="var(--color-don)" stroke="var(--color-ink)" strokeWidth="4" />
          <circle cx="85" cy="40" r="8" fill="var(--color-don)" stroke="var(--color-ink)" strokeWidth="4" />
        </g>
      </svg>
      {label && (
        <p key={holding ? "hold" : "idle"} className={`animate-pop t-outline font-display text-cream ${small ? "text-2xl" : "text-3xl"}`}>
          {holding ? "그대로 유지!" : "양손 번쩍!"}
        </p>
      )}
    </div>
  );
}

function Practice({ ui, onSkip }: { ui: UiSnap; onSkip: () => void }) {
  return (
    <div className="pointer-events-none flex h-full flex-col">
      <div className="flex justify-center pt-5">
        <span className="t-outline font-display text-6xl text-ka drop-shadow-[0_5px_0_var(--color-ink)]">연습</span>
      </div>
      <div className="flex-1" />
      <div className="t-panel pointer-events-auto mx-4 mb-6 px-5 py-4 text-center">
        <p className="font-display text-xl">점수는 오르지 않아요. 금빛 표적이 뜨면 이마를 노려요!</p>
        <p className="mt-2 text-sm font-bold text-fg-muted">{ui.motionHint}</p>
        <button type="button" onClick={onSkip} className="t-btn mt-4 h-14 bg-sun px-7 text-xl">
          바로 시작!
        </button>
      </div>
    </div>
  );
}

function Countdown({ n }: { n: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-ink/25">
      <p
        key={n}
        className="animate-pop t-outline font-display text-[11rem] leading-none tabular-nums text-sun drop-shadow-[0_8px_0_var(--color-ink)]"
      >
        {n > 0 ? n : "시작!"}
      </p>
      <div className="t-panel max-w-[80%] px-5 py-3 text-center">
        <p className="font-display text-xl" style={{ wordBreak: "keep-all" }}>
          금빛 표적이 뜨면 <span className="whitespace-nowrap">이마 = 크리티컬!</span>
        </p>
        <p className="mt-1 text-sm text-fg-muted">손을 든 높이로 돌이 날아갑니다</p>
      </div>
    </div>
  );
}

/** 태고 북 모양 시계. */
function DrumTimer({ timeLeft }: { timeLeft: number }) {
  const sec = Math.ceil(timeLeft);
  const urgent = timeLeft <= 10;
  return (
    <div
      className={`relative flex size-24 shrink-0 items-center justify-center rounded-full border-[5px] border-ink shadow-[0_5px_0_var(--color-ink)] ${urgent ? "animate-throb bg-don" : "bg-don"}`}
    >
      <div className="absolute inset-[9px] rounded-full border-[4px] border-ink bg-cream" />
      <div className="absolute inset-[22px] rounded-full bg-[#f6e2bf]" />
      <span
        key={urgent ? sec : undefined}
        className={`relative font-display text-4xl leading-none tabular-nums ${urgent ? "animate-pop text-don" : "text-ink"}`}
      >
        {sec}
      </span>
    </div>
  );
}

function Hud({ ui }: { ui: UiSnap }) {
  return (
    <>
      <div className="flex items-start gap-2 px-3 pt-3 pr-16">
        <DrumTimer timeLeft={ui.timeLeft} />
        <div className="mt-2 flex-1 rounded-2xl border-[5px] border-ink bg-gradient-to-b from-don to-don-dark px-4 py-1.5 text-right shadow-[0_5px_0_var(--color-ink)]">
          <p className="font-display text-sm leading-tight text-cream/90">점수 · 크리티컬 {ui.foreheadHits}</p>
          <p className="t-outline-sm font-display text-4xl leading-none tabular-nums text-cream">
            {ui.score.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>
      <div className="relative h-24">
        {ui.combo > 1 && (
          <div key={ui.combo} className="animate-pop absolute top-2 left-4 flex flex-col items-center">
            <span className="t-outline font-display text-5xl leading-none tabular-nums text-sun">{ui.combo}</span>
            <span className="t-outline-sm font-display text-lg leading-none text-cream">콤보</span>
          </div>
        )}
        {ui.banner && (
          <p
            key={ui.banner}
            className="animate-pop t-outline absolute inset-x-0 top-3 text-center font-display text-5xl text-cream drop-shadow-[0_5px_0_var(--color-ink)]"
          >
            {ui.banner}
          </p>
        )}
        {ui.freezeLeft > 0 && (
          <p className="absolute inset-x-0 top-20 text-center">
            <span className="rounded-full border-4 border-ink bg-ka px-4 py-1 font-display text-lg text-cream">
              집중 {ui.freezeLeft.toFixed(1)}
            </span>
          </p>
        )}
      </div>
      <div className="flex-1" />
      <div className="mb-5 px-4">
        <HintPill>{ui.motionHint}</HintPill>
      </div>
    </>
  );
}

function Result({ ui, onNext }: { ui: UiSnap; onNext: () => void }) {
  const best = ui.bestScore;
  const isBest = ui.resultRank === 1 && ui.score > 0;
  return (
    <div className="pointer-events-auto flex h-full flex-col items-center justify-center overflow-y-auto bg-ink/55 px-5 pt-20 pb-6 text-center">
      <div className="t-panel relative w-full px-5 pt-9 pb-5">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full border-[5px] border-ink bg-don px-7 py-1.5 font-display text-2xl whitespace-nowrap text-cream">
            {isBest ? "최고 기록!" : "결과 발표"}
          </span>
        </div>
        <p className="animate-pop t-outline font-display text-7xl leading-none tabular-nums text-sun drop-shadow-[0_6px_0_var(--color-ink)]">
          {ui.score.toLocaleString("ko-KR")}
        </p>
        <p className="mt-3 font-display text-lg text-fg-muted">
          {ui.checkMode ? "점검은 기록되지 않습니다" : ui.resultRank > 0 ? `전체 ${ui.resultRank}위` : "순위권 밖"}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border-4 border-ink bg-sun px-3 py-2">
            <dt className="font-display text-sm">크리티컬</dt>
            <dd className="font-display text-3xl tabular-nums">{ui.foreheadHits}</dd>
          </div>
          <div className="rounded-2xl border-4 border-ink bg-ka px-3 py-2 text-cream">
            <dt className="font-display text-sm">최대 콤보</dt>
            <dd className="t-outline-sm font-display text-3xl tabular-nums">{ui.maxCombo}</dd>
          </div>
        </dl>
        {best > 0 && <p className="mt-3 text-sm font-bold text-fg-muted">역대 최고 {best.toLocaleString("ko-KR")}</p>}
        {ui.freezeFound && <p className="mt-1 font-display text-lg text-ka-dark">다윗의 프리징을 발견했습니다!</p>}
      </div>
      <div className="mt-8 w-full">
        <VerseBlock ui={ui} />
      </div>
      <button type="button" onClick={onNext} className="t-btn mt-6 h-16 min-w-56 bg-don px-8 text-2xl text-cream">
        다음 사람
      </button>
      <p className="t-outline-sm mt-3 text-sm font-bold text-cream">자리를 비우면 대기 화면으로 돌아갑니다</p>
    </div>
  );
}
