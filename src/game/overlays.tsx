import { Volume2, VolumeX } from "lucide-react";
import { CHURCH_NAME, GAME_TITLE, LEADERBOARD_SHOW } from "./constants";
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
        className="pointer-events-auto absolute top-4 right-4 z-20 flex size-11 items-center justify-center rounded-full border border-border bg-bg-elevated/80 text-fg"
        aria-label={ui.muted ? "소리 켜기" : "소리 끄기"}
      >
        {ui.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
      </button>

      {ui.phase === "boot" && <Boot ui={ui} onBegin={onBegin} />}
      {ui.phase === "attract" && (
        <Attract
          ui={ui}
          onStart={onStart}
          onAskReset={onAskReset}
          onRetryCamera={onRetryCamera}
          onRetryMotion={onRetryMotion}
          onOpenWindow={onOpenWindow}
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
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-bg/70 px-8">
          <div className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-6 shadow-[0_24px_60px_rgb(0_0_0/0.35)]">
            <p className="font-display text-xl text-fg">기록을 모두 지울까요?</p>
            <p className="mt-2 text-sm text-fg-muted">리셋 전까지 쌓인 점수가 사라집니다.</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onCancelReset}
                className="h-12 flex-1 rounded-md border border-border-strong text-sm font-medium"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmReset}
                className="h-12 flex-1 rounded-md bg-fg text-sm font-medium text-accent-fg"
              >
                지우기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerseBlock({ ui, large }: { ui: UiSnap; large?: boolean }) {
  return (
    <div className="px-6 text-center">
      <p className="text-xs tracking-[0.22em] text-fg-muted">말씀 · 발췌</p>
      <blockquote className={`mt-3 font-display leading-snug text-balance ${large ? "text-4xl" : "text-2xl"}`}>
        {ui.verse.text}
      </blockquote>
      <p className="mt-3 text-sm tracking-wide text-fg-muted">{ui.verse.ref}</p>
    </div>
  );
}

function Boot({ ui, onBegin }: { ui: UiSnap; onBegin: () => void }) {
  return (
    <button
      type="button"
      onClick={onBegin}
      className="pointer-events-auto flex h-full w-full flex-col items-center justify-center gap-8 bg-bg px-8 text-center"
    >
      <img src="/logo-alllove.jpg" alt={CHURCH_NAME} className="h-28 w-28 object-contain" />
      <div>
        <p className="text-sm tracking-[0.18em] text-fg-muted">{CHURCH_NAME}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-balance">{GAME_TITLE}</h1>
      </div>
      <VerseBlock ui={ui} large />
      <p className="rounded-full border border-border-strong px-5 py-3 text-sm tracking-wide">화면을 눌러 시작</p>
    </button>
  );
}

function Attract({
  ui,
  onStart,
  onAskReset,
  onRetryCamera,
  onRetryMotion,
  onOpenWindow,
}: {
  ui: UiSnap;
  onStart: () => void;
  onAskReset: () => void;
  onRetryCamera: () => void;
  onRetryMotion: () => void;
  onOpenWindow: () => void;
}) {
  const top = ui.scores.slice(0, LEADERBOARD_SHOW);
  return (
    <>
      <header className="pointer-events-none flex flex-col items-center px-4 pt-6">
        <img src="/logo-alllove.jpg" alt="" className="h-12 w-12 object-contain" />
        <h1 className="mt-2 font-display text-3xl text-balance">{GAME_TITLE}</h1>
        <p className="mt-1 text-xs tracking-[0.2em] text-fg-muted">{CHURCH_NAME}</p>
        <div className="mt-4">
          <VerseBlock ui={ui} />
        </div>
      </header>
      <div className="flex-1" />
      <section className="pointer-events-auto mx-5 mb-6 rounded-xl border border-border bg-bg/78 p-5 backdrop-blur-[2px]">
        <button
          type="button"
          onPointerDown={(e) => {
            e.currentTarget.dataset.t = String(performance.now());
          }}
          onPointerUp={(e) => {
            const started = Number(e.currentTarget.dataset.t ?? 0);
            if (performance.now() - started > 1400) onAskReset();
          }}
          className="flex w-full items-baseline justify-between"
        >
          <h2 className="text-sm tracking-[0.16em] text-fg-muted">최고 기록</h2>
          <span className="text-[11px] text-fg-subtle">길게 눌러 초기화</span>
        </button>
        <ol className="mt-3 space-y-2">
          {top.length === 0 && <li className="text-sm text-fg-subtle">아직 기록이 없습니다</li>}
          {top.map((row, i) => (
            <li key={`${row.at}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="tabular-nums text-fg-subtle">{i + 1}</span>
              <span className="flex-1 tabular-nums font-medium">{row.score.toLocaleString("ko-KR")}</span>
              <span className="text-xs text-fg-subtle">{formatScoreDate(row.at)}</span>
            </li>
          ))}
        </ol>
        {ui.cameraState === "denied" ? (
          <CameraHelp ui={ui} onRetry={onRetryCamera} onOpenWindow={onOpenWindow} />
        ) : ui.modelState === "failed" ? (
          <ModelHelp ui={ui} onRetry={onRetryMotion} />
        ) : (
          <>
            <button
              type="button"
              onClick={onStart}
              disabled={!ui.poseReady}
              className="mt-5 h-14 w-full rounded-lg bg-fg text-base font-medium text-accent-fg disabled:opacity-60"
            >
              {ui.poseReady
                ? "시작하기"
                : ui.modelState === "loading" || ui.cameraState === "loading"
                  ? ui.cameraState === "loading"
                    ? "카메라를 켜는 중…"
                    : "모션을 준비하는 중…"
                  : "카메라 앞에 서 주세요"}
            </button>
            <p className="mt-3 text-center text-xs text-fg-subtle">{ui.motionHint}</p>
          </>
        )}
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
    <div className="pointer-events-auto flex h-full flex-col items-center justify-center bg-bg/55 px-8 text-center">
      <img
        src="/logo-alllove.jpg"
        alt={CHURCH_NAME}
        className="h-28 w-28 object-contain"
      />
      <VerseBlock ui={ui} />
      <p className="mt-6 text-lg font-medium">양손을 들거나 연습으로</p>
      <button
        type="button"
        onClick={onStart}
        disabled={!ui.poseReady}
        className="mt-4 h-14 w-full max-w-xs rounded-lg bg-fg text-base font-medium text-accent-fg disabled:opacity-60"
      >
        연습 던지기
      </button>
      <p className="mt-3 text-sm text-fg-muted">{ui.motionHint}</p>
      {ui.cameraState === "denied" && (
        <CameraHelp ui={ui} onRetry={onRetryCamera} onOpenWindow={onOpenWindow} />
      )}
      {ui.cameraState === "live" && ui.modelState === "failed" && <ModelHelp ui={ui} onRetry={onRetryMotion} />}
      {ui.cameraState === "live" && ui.modelState !== "ready" && ui.modelState !== "failed" && (
        <p className="mt-6 text-sm text-fg-muted">모션이 준비되기 전에는 시작되지 않습니다</p>
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
    <div className="mt-5 rounded-lg border border-border-strong bg-bg-elevated p-4 text-left">
      <p className="font-medium">카메라가 꺼져 있습니다</p>
      <p className="mt-2 text-sm text-pretty text-fg-muted">
        {ui.cameraError || "브라우저가 카메라를 막았습니다."}
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-fg-subtle">
        <li>주소창 왼쪽 자물쇠 또는 카메라 아이콘을 누릅니다</li>
        <li>
          카메라를 <span className="text-fg">허용</span>으로 바꿉니다
        </li>
        <li>아래 다시 시도를 누릅니다</li>
      </ol>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-12 w-full rounded-lg bg-fg text-sm font-medium text-accent-fg"
      >
        다시 시도
      </button>
      <button
        type="button"
        onClick={onOpenWindow}
        className="mt-2 h-12 w-full rounded-lg border border-border-strong text-sm font-medium"
      >
        새 창에서 열기
      </button>
    </div>
  );
}

function ModelHelp({ ui, onRetry }: { ui: UiSnap; onRetry: () => void }) {
  return (
    <div className="mt-5 rounded-lg border border-border-strong bg-bg-elevated p-4 text-left">
      <p className="font-medium">모션을 준비하지 못했습니다</p>
      <p className="mt-2 text-sm text-pretty text-fg-muted">
        {ui.modelError || "카메라는 켜져 있지만 동작 인식을 불러오지 못했습니다."}
      </p>
      <p className="mt-2 text-xs text-fg-subtle">카메라는 그대로 두고, 모션만 다시 불러옵니다.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-12 w-full rounded-lg bg-fg text-sm font-medium text-accent-fg"
      >
        모션 다시 준비
      </button>
    </div>
  );
}

function HandsUpMark() {
  return (
    <svg viewBox="0 0 120 140" className="mt-8 h-28 w-24 text-fg" aria-hidden="true">
      <circle cx="60" cy="44" r="12" fill="currentColor" opacity="0.9" />
      <path
        d="M60 56v34M60 70l-22 18M60 70l22 18M60 90l-14 28M60 90l14 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M38 40V18M82 40V18"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Practice({ ui, onSkip }: { ui: UiSnap; onSkip: () => void }) {
  return (
    <div className="pointer-events-none flex h-full flex-col">
      <div className="flex-1" />
      <div className="pointer-events-auto mb-8 px-6 text-center">
        <p className="font-display text-3xl">연습</p>
        <p className="mt-2 text-sm text-fg-muted">점수는 오르지 않습니다. 한 번 던지면 시작합니다.</p>
        <p className="mt-2 text-sm text-fg">{ui.motionHint}</p>
        <button type="button" onClick={onSkip} className="mt-4 h-12 rounded-lg border border-border-strong px-5 text-sm">
          건너뛰고 시작
        </button>
      </div>
    </div>
  );
}

function Countdown({ n }: { n: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <p className="font-display text-8xl tabular-nums">{n}</p>
      <p className="text-lg text-fg">흰 점 = 크리티컬 x2</p>
      <p className="max-w-[22ch] text-center text-sm text-fg-muted">
        점선이 가는 곳으로 돌이 날아갑니다. 골리앗 쪽으로 팔을 휘두르세요.
      </p>
    </div>
  );
}

function Hud({ ui }: { ui: UiSnap }) {
  const mm = Math.floor(ui.timeLeft);
  const frac = Math.floor((ui.timeLeft % 1) * 10);
  const urgent = ui.timeLeft <= 10;
  return (
    <>
      <div className="flex items-start justify-end gap-3 px-5 pt-5 pr-16">
        <div className="rounded-md border border-border bg-bg/70 px-3 py-2 text-right">
          <p className="text-xs tracking-[0.16em] text-fg-muted">점수</p>
          <p className="font-display text-3xl tabular-nums leading-none">{ui.score.toLocaleString("ko-KR")}</p>
          <p className="mt-1 text-xs text-fg-subtle">
            크리티컬 {ui.foreheadHits}
            {ui.combo > 1 ? ` · 연속 ${ui.combo}` : ""}
          </p>
        </div>
        <div className={`rounded-md border px-3 py-2 text-right ${urgent ? "border-danger bg-bg/80 text-danger" : "border-border bg-bg/70"}`}>
          <p className="text-xs tracking-[0.16em] text-fg-muted">시간</p>
          <p className="font-display text-3xl tabular-nums leading-none">
            {mm}
            <span className="text-lg text-fg-muted">.{frac}</span>
          </p>
        </div>
      </div>
      {ui.freezeLeft > 0 && <p className="mt-2 text-center text-sm text-fg">프리징</p>}
      {ui.banner && <p className="mt-2 text-center text-sm text-fg">{ui.banner}</p>}
      <div className="flex-1" />
      <p className="mb-6 px-6 text-center text-sm text-fg-muted">{ui.motionHint}</p>
    </>
  );
}

function Result({ ui, onNext }: { ui: UiSnap; onNext: () => void }) {
  const best = ui.bestScore;
  const isBest = ui.resultRank === 1 && ui.score > 0;
  return (
    <div className="pointer-events-auto flex h-full flex-col items-center justify-center bg-bg/62 px-8 text-center">
      <p className="text-sm tracking-[0.2em] text-fg-muted">{isBest ? "최고 기록" : "기록"}</p>
      <p className="mt-3 font-display text-7xl tabular-nums leading-none">{ui.score.toLocaleString("ko-KR")}</p>
      <p className="mt-4 text-fg-muted">
        {ui.resultRank > 0 ? `${ui.resultRank}위` : "순위권 밖"}
        {" · "}
        {ui.inputVia === "pointer" ? "화면 조작" : "웹캠"}
        {" · "}
        {formatScoreDate(Date.now())}
      </p>
      <dl className="mt-8 grid w-full max-w-xs grid-cols-2 gap-3 text-sm">
        <div className="rounded-md border border-border bg-bg/50 px-3 py-3">
          <dt className="text-xs text-fg-subtle">크리티컬</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums">{ui.foreheadHits}</dd>
        </div>
        <div className="rounded-md border border-border bg-bg/50 px-3 py-3">
          <dt className="text-xs text-fg-subtle">최대 콤보</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums">{ui.maxCombo}</dd>
        </div>
      </dl>
      {best > 0 && (
        <p className="mt-4 text-xs text-fg-subtle">최고 {best.toLocaleString("ko-KR")}</p>
      )}
      {ui.freezeFound && <p className="mt-3 text-sm text-fg">다윗의 프리징을 발견했습니다</p>}
      <blockquote className="mt-6 max-w-[22ch] font-display text-2xl leading-snug text-balance">
        {ui.verse.text}
      </blockquote>
      <p className="mt-2 text-xs tracking-wide text-fg-muted">{ui.verse.ref}</p>
      <button
        type="button"
        onClick={onNext}
        className="mt-10 h-14 min-w-52 rounded-lg bg-fg px-8 font-medium text-accent-fg"
      >
        다음 사람
      </button>
      <p className="mt-4 text-xs text-fg-subtle">자리를 비우면 대기 화면으로 돌아갑니다</p>
    </div>
  );
}
