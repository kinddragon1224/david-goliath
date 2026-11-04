import { Home, Power, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  APP_VERSION,
  URGENT_SECONDS,
  GAME_TITLE,
  LEADERBOARD_SHOW,
  PRODUCER,
  ROUND_SECONDS,
} from "./constants";
import { EDITION, EDITION_ID } from "./edition";
import { resetStation } from "@/fashion/stations";
import { isKiosk, isTv, listCameras, preferredCameraId, setPreferredCamera } from "./kiosk";
import { backspaceJamo, KEY_ROWS, SHIFTED, typeJamo } from "./hangul";
import { GIANT_PRESETS } from "./giant";
import {
  formatScoreDate,
  monthCsv,
  monthKey,
  monthLabel,
  monthlyRows,
  shiftMonth,
  type ScoreRecord,
} from "./scores";
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
  onSaveName: (name: string) => void;
  onSkipName: () => void;
  onRemoveRecord: (at: number) => void;
  onTestSound: () => void;
  onResetGiant: (max: number) => void;
  /** 게임 중 처음 화면으로. */
  onHome?: () => void;
  /** 가로 TV 화면. 순위·방법·거대 골리앗은 오른쪽 패널로 옮긴다. */
  wide?: boolean;
};

/** 오른쪽 패널(게임 칸 밖)에서 운영자 화면을 열 때 쓰는 신호. */
const OPEN_ADMIN_EVENT = "dg-open-admin";

/** 길게 누르면(손가락 또는 리모컨 확인 버튼 1.4초) 운영자 화면을 연다. */
function useLongPress(onLong: () => void) {
  const started = useRef(0);
  return {
    onPointerDown: () => {
      started.current = performance.now();
    },
    onPointerUp: () => {
      if (started.current && performance.now() - started.current > 1400) onLong();
      started.current = 0;
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (!started.current) started.current = performance.now();
    },
    onKeyUp: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (started.current && performance.now() - started.current > 1400) onLong();
      started.current = 0;
    },
  };
}

function BoardHeader({ month, onLong }: { month: string; onLong: () => void }) {
  const press = useLongPress(onLong);
  return (
    <button type="button" {...press} className="flex w-full items-center justify-between">
      <span className="sr-only">길게 눌러 운영자 화면</span>
      <Ribbon tone="sun">{Number(month.slice(5))}월의 용사</Ribbon>
      <span className="font-display text-sm text-don">{EDITION.boardTag}</span>
    </button>
  );
}

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
  onSaveName,
  onSkipName,
  onRemoveRecord,
  onTestSound,
  onResetGiant,
  onHome,
  wide = false,
}: Props) {
  const [adminOpen, setAdminOpen] = useState(false);
  useEffect(() => {
    const open = () => setAdminOpen(true);
    window.addEventListener(OPEN_ADMIN_EVENT, open);
    return () => window.removeEventListener(OPEN_ADMIN_EVENT, open);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col text-fg">
      <button
        type="button"
        onClick={onMute}
        className={`t-btn pointer-events-auto absolute top-3 right-3 z-20 flex size-12 items-center justify-center ${ui.sound === "blocked" && !ui.muted ? "animate-throb bg-don text-cream" : "bg-cream text-ink"}`}
        aria-label={
          ui.sound === "blocked" && !ui.muted
            ? "소리가 막혀 있어요. 화면을 한 번 눌러 주세요"
            : ui.muted
              ? "소리 켜기"
              : "소리 끄기"
        }
      >
        {ui.muted || ui.sound === "blocked" ? (
          <VolumeX className="size-5" strokeWidth={3} />
        ) : (
          <Volume2 className="size-5" strokeWidth={3} />
        )}
      </button>

      {(ui.phase === "boot" || ui.phase === "attract" || (ui.phase === "result" && !ui.naming)) && (
        <PowerControl />
      )}

      {ui.phase === "boot" && <Boot ui={ui} onBegin={onBegin} />}
      {ui.phase === "attract" && (
        <Attract
          ui={ui}
          wide={wide}
          onStart={onStart}
          onOpenAdmin={() => setAdminOpen(true)}
          onRetryCamera={onRetryCamera}
          onRetryMotion={onRetryMotion}
        />
      )}
      {ui.phase === "start" && (
        <Start
          ui={ui}
          onStart={onStart}
          onRetryCamera={onRetryCamera}
          onRetryMotion={onRetryMotion}
          onOpenWindow={onOpenWindow}
        />
      )}
      {ui.phase === "practice" && <Practice ui={ui} onSkip={onSkipPractice} />}
      {ui.phase === "countdown" &&
        (ui.waitingForPlayer ? <WaitForPlayer /> : <Countdown n={ui.countdown} />)}
      {(ui.phase === "play" || ui.phase === "ko") && <Hud ui={ui} />}
      {(ui.phase === "countdown" || ui.phase === "play" || ui.phase === "ko") && onHome && (
        <button
          type="button"
          onClick={onHome}
          className="t-btn pointer-events-auto absolute bottom-24 left-3 z-20 flex h-11 items-center gap-1.5 bg-cream px-3 font-display text-sm text-ink"
          aria-label="처음 화면으로"
        >
          <Home className="size-5" strokeWidth={3} />
          처음으로
        </button>
      )}
      {ui.homeProgress > 0 && <HomeHold progress={ui.homeProgress} />}
      {ui.phase === "ko" && <KoSplash />}
      {ui.phase === "result" &&
        (ui.naming ? (
          <NameEntry ui={ui} onSave={onSaveName} onSkip={onSkipName} />
        ) : (
          <Result ui={ui} onNext={onNext} />
        ))}

      {adminOpen && (
        <AdminPanel
          scores={ui.scores}
          onClose={() => setAdminOpen(false)}
          onRemove={onRemoveRecord}
          giant={ui.giant}
          onResetGiant={onResetGiant}
          onAskReset={onAskReset}
          onTestSound={onTestSound}
          sound={ui.muted ? "muted" : ui.sound}
        />
      )}

      {ui.confirmReset && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-ink/60 px-8">
          <div className="t-panel w-full max-w-sm p-6 text-center">
            <p className="font-display text-2xl">기록을 모두 지울까요?</p>
            <p className="mt-2 text-sm text-fg-muted">리셋 전까지 쌓인 점수가 사라집니다.</p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onCancelReset}
                className="t-btn h-14 flex-1 bg-cream text-lg"
              >
                취소
              </button>
              <button
                type="button"
                onClick={onConfirmReset}
                className="t-btn h-14 flex-1 bg-don text-lg text-cream"
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
      className={`inline-block rounded-full border-[0.25rem] border-ink px-5 py-1 font-display text-lg leading-tight ${bg} ${fg}`}
    >
      {children}
    </span>
  );
}

function Title({ size = "lg" }: { size?: "lg" | "md" | "sm" }) {
  return (
    <h1
      className={`t-outline font-display leading-none whitespace-nowrap text-cream drop-shadow-[0_0.375rem_0_var(--color-ink)] ${size === "lg" ? "text-5xl" : size === "md" ? "text-4xl" : "text-3xl"}`}
    >
      <span className="text-sun">다윗</span>과 <span className="text-don">골리앗</span>
      <span className="sr-only">{GAME_TITLE}</span>
    </h1>
  );
}

/** 행사장 로고. 행사장판처럼 로고가 없으면 아무것도 그리지 않는다. */
function LogoBadge({ size = 96 }: { size?: number }) {
  if (!EDITION.venueLogo) return null;
  return (
    <div
      className="flex items-center justify-center overflow-hidden rounded-full border-[0.3125rem] border-ink bg-white shadow-[0_0.3125rem_0_var(--color-ink)]"
      style={{ width: size, height: size }}
    >
      <img
        src={EDITION.venueLogo}
        alt={EDITION.venueName ?? ""}
        className="size-full scale-125 object-cover"
      />
    </div>
  );
}

/** 판에 따라 성경 말씀 또는 게임 방법. */
function InfoBlock({ ui, large, compact }: { ui: UiSnap; large?: boolean; compact?: boolean }) {
  return EDITION.showVerses ? (
    <VerseBlock ui={ui} large={large} compact={compact} />
  ) : (
    <HowToBlock compact={compact} />
  );
}

function HowToBlock({ compact }: { compact?: boolean }) {
  // 이모지는 PC마다 안 보일 수 있어 숫자 배지로
  const steps = [
    "양손을 머리 위로 번쩍! 1초 유지하면 시작",
    "손을 머리 위로 들었다가 앞으로 힘껏 던지기",
    "창이 날아오면 몸을 옆으로 움직여 피하기!",
  ];
  return (
    <div className="t-panel relative w-full px-5 pt-7 pb-4 text-left">
      <div className="absolute -top-5 left-1/2 -translate-x-1/2">
        <Ribbon tone="ka">게임 방법</Ribbon>
      </div>
      <ol className={compact ? "space-y-1.5" : "space-y-2.5"}>
        {steps.map((text, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border-[0.1875rem] border-ink bg-sun font-display text-xl text-ink">
              {i + 1}
            </span>
            <span
              className={`font-display leading-snug text-ink ${compact ? "text-lg" : "text-xl"}`}
              style={{ wordBreak: "keep-all" }}
            >
              {text}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-sm font-bold text-fg-muted">
        {ROUND_SECONDS}초 안에 골리앗을 쓰러뜨려라! 금빛 이마는 크리티컬, 마지막 5초는 2배
      </p>
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
    <p className="mx-auto w-fit max-w-[92%] rounded-full border-[0.25rem] border-ink bg-cream px-4 py-1.5 text-center text-sm font-bold text-ink text-pretty">
      {children}
    </p>
  );
}

/** 제작사 표기. full이면 사업자 정보까지. */
function Credit({ full }: { full?: boolean }) {
  if (!full) {
    return (
      <div className="flex items-center justify-center gap-2 text-[0.6875rem] font-bold text-fg-muted">
        <span>제작</span>
        <img src={PRODUCER.logo} alt={PRODUCER.name} className="h-3.5 w-auto" />
      </div>
    );
  }
  return (
    <div className="w-full rounded-2xl border-[0.25rem] border-ink bg-paper/95 px-4 py-2.5 text-center">
      <div className="flex items-center justify-center gap-2">
        <span className="font-display text-sm text-fg-muted">제작</span>
        <img src={PRODUCER.logo} alt={PRODUCER.name} className="h-5 w-auto" />
      </div>
      <p
        className="mt-1.5 text-[0.625rem] leading-relaxed text-fg-muted text-pretty"
        style={{ wordBreak: "keep-all" }}
      >
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
        <p className="t-outline-sm font-display text-lg tracking-wide text-cream">
          {EDITION.venueName ?? "온몸으로 던지는 모션 게임"}
        </p>
      </div>
      <InfoBlock ui={ui} large />
      <span className="t-btn animate-throb bg-don px-9 py-4 text-2xl text-cream">
        화면을 눌러 시작
      </span>
      <div className="absolute inset-x-4 bottom-4">
        <Credit full />
      </div>
    </button>
  );
}

const MEDAL = ["bg-sun", "bg-[#d9dde6]", "bg-[#e0955a]"];

function Attract({
  ui,
  wide,
  onStart,
  onOpenAdmin,
  onRetryCamera,
  onRetryMotion,
}: {
  ui: UiSnap;
  wide: boolean;
  onStart: () => void;
  onOpenAdmin: () => void;
  onRetryCamera: () => void;
  onRetryMotion: () => void;
}) {
  const month = monthKey(Date.now());
  const top = monthlyRows(ui.scores, month).slice(0, Math.min(3, LEADERBOARD_SHOW));
  return (
    <>
      <header className="pointer-events-none flex flex-col items-center gap-2 px-4 pt-4">
        <div className="flex items-center gap-2 px-12">
          <LogoBadge size={46} />
          <Title size="sm" />
        </div>
        {!wide && (
          <div className="mt-4 w-full">
            <InfoBlock ui={ui} compact />
          </div>
        )}
      </header>
      <div className="flex flex-1 items-center justify-end pr-5">
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
        {!wide && <GiantBar giant={ui.giant} />}
        {ui.checkMode ? (
          <p className="mt-1 text-center text-xs text-fg-muted">
            화면을 밀어 던집니다. 점검 점수는 기록되지 않습니다.
          </p>
        ) : (
          ui.cameraState === "denied" && (
            <p className="mt-1 text-center text-xs text-fg-muted">
              웹캠이 없어도 화면을 밀어 던질 수 있습니다.
            </p>
          )
        )}
        {!wide && (
          <>
            <div className="mt-3">
              <BoardHeader month={month} onLong={onOpenAdmin} />
            </div>
            <ol className="mt-1.5 space-y-1">
              {top.length === 0 && (
                <li className="py-2 text-center font-display text-lg text-fg-muted">
                  이달 첫 번째 용사를 기다립니다
                </li>
              )}
              {top.map((row, i) => (
                <li key={`${row.at}-${i}`} className="flex items-center gap-3">
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[0.1875rem] border-ink font-display text-base ${MEDAL[i] ?? "bg-cream"}`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate font-display text-lg ${row.name ? "" : "text-fg-muted"}`}
                  >
                    {row.name ?? "이름 없음"}
                  </span>
                  <span className="font-display text-lg tabular-nums">
                    {row.score.toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        {!ui.checkMode && ui.cameraState === "denied" && (
          <button
            type="button"
            onClick={onRetryCamera}
            className="mt-3 h-10 w-full text-sm font-bold text-fg-muted underline"
          >
            카메라 다시 시도
          </button>
        )}
        {ui.modelState === "failed" && (
          <button
            type="button"
            onClick={onRetryMotion}
            className="mt-2 h-10 w-full text-sm font-bold text-fg-muted underline"
          >
            모션 다시 준비
          </button>
        )}
        <div className="mt-2.5 border-t-[0.125rem] border-dashed border-ink/20 pt-2">
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
        <InfoBlock ui={ui} />
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
        게임 시작
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
      <p className="mt-1 text-sm text-pretty text-fg-muted">
        {ui.cameraError || "브라우저가 카메라를 막았습니다."}
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>주소창 왼쪽 자물쇠 또는 카메라 아이콘을 누릅니다</li>
        <li>
          카메라를 <b>허용</b>으로 바꿉니다
        </li>
        <li>아래 다시 시도를 누릅니다</li>
      </ol>
      <button
        type="button"
        onClick={onRetry}
        className="t-btn mt-4 h-14 w-full bg-don text-lg text-cream"
      >
        다시 시도
      </button>
      <button
        type="button"
        onClick={onOpenWindow}
        className="t-btn mt-3 h-14 w-full bg-cream text-lg"
      >
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
      <button
        type="button"
        onClick={onRetry}
        className="t-btn mt-4 h-14 w-full bg-don text-lg text-cream"
      >
        모션 다시 준비
      </button>
    </div>
  );
}

/** 양손 번쩍 그림과 유지 게이지. 다 차면 바로 게임이 시작된다. */
function HandsUpPrompt({
  progress,
  label = true,
  small,
}: {
  progress: number;
  label?: boolean;
  small?: boolean;
}) {
  const R = 56;
  const len = 2 * Math.PI * R;
  const holding = progress > 0.02;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 140 140"
        className={`${small ? "size-28" : "size-36"} ${holding ? "" : "animate-bob"}`}
        aria-hidden="true"
      >
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="var(--color-paper)"
          stroke="var(--color-ink)"
          strokeWidth="18"
        />
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
          <g
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="16"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M60 64v26M60 74L38 46M60 74l22-28M60 90l-13 22M60 90l13 22" />
          </g>
          <g
            fill="none"
            stroke="var(--color-orange)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M60 64v26M60 74L38 46M60 74l22-28M60 90l-13 22M60 90l13 22" />
          </g>
          <circle
            cx="60"
            cy="46"
            r="14"
            fill="var(--color-sun)"
            stroke="var(--color-ink)"
            strokeWidth="5"
          />
          <circle
            cx="35"
            cy="40"
            r="8"
            fill="var(--color-don)"
            stroke="var(--color-ink)"
            strokeWidth="4"
          />
          <circle
            cx="85"
            cy="40"
            r="8"
            fill="var(--color-don)"
            stroke="var(--color-ink)"
            strokeWidth="4"
          />
        </g>
      </svg>
      {label && (
        <p
          key={holding ? "hold" : "idle"}
          className={`animate-pop t-outline font-display text-cream ${small ? "text-2xl" : "text-3xl"}`}
        >
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
        <span className="t-outline font-display text-6xl text-ka drop-shadow-[0_0.3125rem_0_var(--color-ink)]">
          연습
        </span>
      </div>
      <div className="flex-1" />
      <div className="t-panel pointer-events-auto mx-4 mb-6 px-5 py-4 text-center">
        <p className="font-display text-xl">
          점수는 오르지 않아요. 금빛 표적이 뜨면 이마를 노려요!
        </p>
        <p className="mt-2 text-sm font-bold text-fg-muted">{ui.motionHint}</p>
        <button type="button" onClick={onSkip} className="t-btn mt-4 h-14 bg-sun px-7 text-xl">
          바로 시작!
        </button>
      </div>
    </div>
  );
}

/** 화면을 눌러 시작했는데 카메라에 사람이 아직 안 보일 때. */
function WaitForPlayer() {
  return (
    <div className="flex h-full flex-col items-center justify-start gap-6 bg-ink/35 px-6 pt-[22%]">
      <p className="animate-bob t-outline font-display text-5xl leading-tight text-sun text-center drop-shadow-[0_0.5rem_0_var(--color-ink)]">
        발자국 위에
        <br />서 주세요!
      </p>
      <div className="t-panel max-w-[85%] px-5 py-3 text-center">
        <p className="font-display text-xl">카메라에 몸이 보이면 바로 시작해요</p>
        <p className="mt-1 text-sm text-fg-muted">머리부터 허리까지 "내 모습"에 나오게 서 주세요</p>
      </div>
    </div>
  );
}

function Countdown({ n }: { n: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-ink/25">
      <p
        key={n}
        className="animate-pop t-outline font-display text-[11rem] leading-none tabular-nums text-sun drop-shadow-[0_0.5rem_0_var(--color-ink)]"
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
  const urgent = timeLeft <= URGENT_SECONDS;
  return (
    <div
      className={`relative flex size-24 shrink-0 items-center justify-center rounded-full border-[0.3125rem] border-ink shadow-[0_0.3125rem_0_var(--color-ink)] ${urgent ? "animate-throb bg-don" : "bg-don"}`}
    >
      <div className="absolute inset-[0.5625rem] rounded-full border-[0.25rem] border-ink bg-cream" />
      <div className="absolute inset-[1.375rem] rounded-full bg-[#f6e2bf]" />
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
        <div className="mt-2 flex-1 rounded-2xl border-[0.3125rem] border-ink bg-gradient-to-b from-don to-don-dark px-4 py-1.5 text-right shadow-[0_0.3125rem_0_var(--color-ink)]">
          <p className="font-display text-sm leading-tight text-cream/90">
            점수 · 크리티컬 {ui.foreheadHits}
          </p>
          <p className="t-outline-sm font-display text-4xl leading-none tabular-nums text-cream">
            {ui.score.toLocaleString("ko-KR")}
          </p>
        </div>
      </div>
      <HpBar ratio={ui.hpRatio} fever={ui.fever} />
      <div className="relative h-24">
        {ui.combo > 1 && (
          <div
            key={ui.combo}
            className="animate-pop absolute top-2 left-4 flex flex-col items-center"
          >
            <span className="t-outline font-display text-5xl leading-none tabular-nums text-sun">
              {ui.combo}
            </span>
            <span className="t-outline-sm font-display text-lg leading-none text-cream">콤보</span>
          </div>
        )}
        {ui.banner && (
          <p
            key={ui.banner}
            className="animate-pop t-outline absolute inset-x-0 top-3 text-center font-display text-5xl text-cream drop-shadow-[0_0.3125rem_0_var(--color-ink)]"
          >
            {ui.banner}
          </p>
        )}
        {ui.freezeLeft > 0 && (
          <p className="absolute inset-x-0 top-20 text-center">
            <span className="rounded-full border-[0.25rem] border-ink bg-ka px-4 py-1 font-display text-lg text-cream">
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
          <span className="inline-block rounded-full border-[0.3125rem] border-ink bg-don px-7 py-1.5 font-display text-2xl whitespace-nowrap text-cream">
            {ui.won ? "골리앗 KO!" : isBest ? "최고 기록!" : "아쉬워요!"}
          </span>
        </div>
        <p className="animate-pop t-outline font-display text-7xl leading-none tabular-nums text-sun drop-shadow-[0_0.375rem_0_var(--color-ink)]">
          {ui.score.toLocaleString("ko-KR")}
        </p>
        <p className={`mt-2 font-display text-xl ${ui.won ? "text-don" : "text-ink"}`}>
          {ui.won
            ? `${Math.ceil(ui.timeLeft)}초 남기고 쓰러뜨렸어요! 보너스 +${ui.koBonus.toLocaleString("ko-KR")}`
            : `골리앗 체력 ${Math.max(1, Math.round(ui.hpRatio * 100))}% 남았어요. 다시 도전!`}
        </p>
        <p className="mt-1 font-display text-lg text-fg-muted">
          {ui.checkMode
            ? "점검은 기록되지 않습니다"
            : ui.savedName
              ? `${ui.savedName} 용사, 이달 ${ui.monthRank}위로 올라갔어요!`
              : ui.monthRank > 0
                ? `이달 ${ui.monthRank}위`
                : "기록되지 않았습니다"}
        </p>
        {!ui.checkMode && ui.monthRank > 1 && (
          <p className="mt-1 font-display text-2xl text-don">
            1위까지{" "}
            {(
              monthlyRows(ui.scores, monthKey(Date.now()))[0].score -
              ui.score +
              1
            ).toLocaleString("ko-KR")}
            점!
          </p>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-2xl border-[0.25rem] border-ink bg-sun px-3 py-2">
            <dt className="font-display text-sm">크리티컬</dt>
            <dd className="font-display text-3xl tabular-nums">{ui.foreheadHits}</dd>
          </div>
          <div className="rounded-2xl border-[0.25rem] border-ink bg-ka px-3 py-2 text-cream">
            <dt className="font-display text-sm">최대 콤보</dt>
            <dd className="t-outline-sm font-display text-3xl tabular-nums">{ui.maxCombo}</dd>
          </div>
          <div className="rounded-2xl border-[0.25rem] border-ink bg-cream px-3 py-2">
            <dt className="font-display text-sm">창 피하기</dt>
            <dd className="font-display text-3xl tabular-nums">{ui.dodges}</dd>
          </div>
        </dl>
        {!ui.checkMode && ui.giantHit > 0 && (
          <p
            className={`mt-3 rounded-2xl border-[0.25rem] border-ink px-3 py-2 font-display ${ui.giantKoNow ? "animate-throb bg-sun text-xl" : "bg-paper text-lg"}`}
          >
            {ui.giantKoNow
              ? `거대 골리앗을 쓰러뜨렸어요! 오늘 ${ui.giant.defeated}번째!`
              : `거대 골리앗에게 ${ui.giantHit.toLocaleString("ko-KR")} 피해!`}
          </p>
        )}
        {best > 0 && (
          <p className="mt-3 text-sm font-bold text-fg-muted">
            역대 최고 {best.toLocaleString("ko-KR")}
          </p>
        )}
        {ui.freezeFound && (
          <p className="mt-1 font-display text-lg text-ka-dark">다윗의 프리징을 발견했습니다!</p>
        )}
      </div>
      {EDITION.showVerses && (
        <div className="mt-8 w-full">
          <VerseBlock ui={ui} />
        </div>
      )}
      <button
        type="button"
        onClick={onNext}
        className="t-btn mt-6 h-16 min-w-56 bg-don px-8 text-2xl text-cream"
      >
        다음 사람
      </button>
      <p className="t-outline-sm mt-3 text-sm font-bold text-cream">
        자리를 비우면 대기 화면으로 돌아갑니다
      </p>
    </div>
  );
}

/* ───────── 이름 남기기 ───────── */

function NameEntry({
  ui,
  onSave,
  onSkip,
}: {
  ui: UiSnap;
  onSave: (name: string) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState("");
  const [shift, setShift] = useState(false);
  const MAX = 8;
  const put = (k: string) => {
    const next = typeJamo(name, shift ? (SHIFTED[k] ?? k) : k);
    if (next.length <= MAX) setName(next);
    setShift(false);
  };
  const key =
    "h-12 min-w-0 flex-1 rounded-xl border-[0.1875rem] border-ink font-display text-2xl shadow-[0_0.1875rem_0_var(--color-ink)] active:translate-y-0.5 active:shadow-none";
  const ready = name.trim().length > 0;
  return (
    <div className="pointer-events-auto flex h-full flex-col items-center justify-center gap-4 overflow-y-auto bg-ink/60 px-3 pt-16 pb-4 text-center">
      <div className="t-panel relative w-full px-4 pt-8 pb-4">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full border-[0.3125rem] border-ink bg-don px-6 py-1.5 font-display text-2xl whitespace-nowrap text-cream">
            이달 {ui.monthRank}위!
          </span>
        </div>
        <p className="t-outline font-display text-5xl leading-none tabular-nums text-sun">
          {ui.score.toLocaleString("ko-KR")}
        </p>
        <p className="mt-3 font-display text-lg">이름을 남기면 순위판에 올라가요</p>
        <p className="text-sm font-bold text-don">{EDITION.nameTag}</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.replace(/[<>]/g, "").slice(0, MAX))}
          inputMode="none"
          autoComplete="off"
          aria-label="이름"
          placeholder="이름을 눌러 주세요"
          className="mt-3 h-14 w-full rounded-2xl border-[0.25rem] border-ink bg-white px-4 text-center font-display text-3xl text-ink outline-none placeholder:text-lg placeholder:text-fg-muted/60"
        />
      </div>
      <div className="w-full space-y-1.5">
        {KEY_ROWS.map((row, i) => (
          <div key={i} className="flex gap-1">
            {i === 2 && (
              <button
                type="button"
                onClick={() => setShift((v) => !v)}
                className={`${key} ${shift ? "bg-sun" : "bg-cream"} max-w-14 text-lg`}
                aria-label="쌍자음"
              >
                ⇧
              </button>
            )}
            {row.map((k) => (
              <button key={k} type="button" onClick={() => put(k)} className={`${key} bg-paper`}>
                {shift ? (SHIFTED[k] ?? k) : k}
              </button>
            ))}
            {i === 2 && (
              <button
                type="button"
                onClick={() => setName((n) => backspaceJamo(n))}
                className={`${key} max-w-16 bg-cream text-lg`}
                aria-label="지우기"
              >
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="flex w-full gap-3">
        <button type="button" onClick={onSkip} className="t-btn h-14 flex-1 bg-cream text-xl">
          건너뛰기
        </button>
        <button
          type="button"
          disabled={!ready}
          onClick={() => onSave(name.trim())}
          className="t-btn h-14 flex-[2] bg-don text-2xl text-cream disabled:opacity-50"
        >
          이름 저장
        </button>
      </div>
    </div>
  );
}

/* ───────── 운영자: 월별 기록 ───────── */

function AdminPanel({
  scores,
  onClose,
  onRemove,
  onAskReset,
  onTestSound,
  sound,
  giant,
  onResetGiant,
}: {
  giant: UiSnap["giant"];
  onResetGiant: (max: number) => void;
  scores: ScoreRecord[];
  onClose: () => void;
  onRemove: (at: number) => void;
  onAskReset: () => void;
  onTestSound: () => void;
  sound: UiSnap["sound"] | "muted";
}) {
  const [month, setMonth] = useState(() => monthKey(Date.now()));
  const [armed, setArmed] = useState<number | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [camera, setCamera] = useState<string>(() => preferredCameraId() ?? "");
  useEffect(() => {
    void listCameras().then(setCameras);
  }, []);
  const rows = monthlyRows(scores, month);
  const download = () => {
    const blob = new Blob([monthCsv(scores, month)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `다윗과골리앗_${month}_순위.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="pointer-events-auto absolute inset-0 z-[25] flex items-center justify-center bg-ink/70 px-3 py-4">
      <div className="t-panel flex max-h-full w-full flex-col p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-xl">운영자 · 월별 기록</p>
          <button type="button" onClick={onClose} className="t-btn h-10 bg-cream px-4 text-base">
            닫기
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-2xl border-[0.25rem] border-ink bg-sun px-2 py-1">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            className="size-10 font-display text-2xl"
            aria-label="이전 달"
          >
            ◀
          </button>
          <span className="font-display text-xl">
            {monthLabel(month)} · {rows.length}판
          </span>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            className="size-10 font-display text-2xl"
            aria-label="다음 달"
          >
            ▶
          </button>
        </div>
        <ol className="mt-3 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {rows.length === 0 && (
            <li className="py-6 text-center text-fg-muted">이 달 기록이 없습니다</li>
          )}
          {rows.slice(0, 50).map((r, i) => (
            <li
              key={r.at}
              className={`flex items-center gap-2 rounded-lg px-2 py-1 ${i === 0 ? "bg-sun/50" : ""}`}
            >
              <span className="w-6 text-right font-display tabular-nums">{i + 1}</span>
              <span
                className={`min-w-0 flex-1 truncate font-display text-lg ${r.name ? "" : "text-fg-muted"}`}
              >
                {r.name ?? "이름 없음"}
              </span>
              <span className="font-display tabular-nums">{r.score.toLocaleString("ko-KR")}</span>
              <span className="w-24 text-right text-[0.6875rem] text-fg-muted">
                {formatScoreDate(r.at)}
              </span>
              <button
                type="button"
                onClick={() => {
                  if (armed === r.at) {
                    onRemove(r.at);
                    setArmed(null);
                  } else setArmed(r.at);
                }}
                className={`h-8 shrink-0 rounded-lg border-[0.125rem] border-ink px-2 text-xs font-bold ${armed === r.at ? "bg-don text-cream" : "bg-cream"}`}
              >
                {armed === r.at ? "정말 삭제" : "삭제"}
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={download}
          disabled={rows.length === 0}
          className="t-btn mt-3 h-14 bg-ka text-xl text-cream disabled:opacity-50"
        >
          이 달 명단 저장 (엑셀 CSV)
        </button>
        {cameras.length > 1 && (
          <label className="mt-3 flex items-center gap-2 text-sm font-bold">
            <span className="shrink-0">카메라</span>
            <select
              value={camera}
              onChange={(e) => {
                setCamera(e.target.value);
                setPreferredCamera(e.target.value || null);
                window.location.reload();
              }}
              className="h-10 min-w-0 flex-1 rounded-lg border-[0.1875rem] border-ink bg-white px-2"
            >
              <option value="">자동 선택</option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-3 rounded-xl border-[0.1875rem] border-ink bg-sun/30 p-2 text-sm font-bold">
          <p>
            거대 골리앗: 체력 {giant.hp.toLocaleString("ko-KR")} /{" "}
            {giant.max.toLocaleString("ko-KR")} · 오늘 {giant.plays}판 · {giant.defeated}마리
            쓰러뜨림
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-fg-muted">새로 시작(체력):</span>
            {GIANT_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onResetGiant(m)}
                className={`h-8 rounded-lg border-2 border-ink px-2 text-xs ${m === giant.max ? "bg-sun" : "bg-cream"}`}
              >
                {m >= 10000 ? `${m / 10000}만` : m}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm font-bold">
          <span className="shrink-0">소리</span>
          <span
            className={`min-w-0 flex-1 truncate ${sound === "running" ? "text-ka-dark" : "text-don"}`}
          >
            {sound === "running"
              ? "켜짐"
              : sound === "muted"
                ? "음소거됨(오른쪽 위 버튼)"
                : sound === "blocked"
                  ? "브라우저가 막음"
                  : "아직 시작 안 됨"}
          </span>
          <button
            type="button"
            onClick={onTestSound}
            className="h-10 shrink-0 rounded-lg border-[0.1875rem] border-ink bg-cream px-3"
          >
            소리 확인
          </button>
        </div>
        {EDITION_ID === "weaveon" && (
          <button
            type="button"
            onClick={resetStation}
            className="mt-2 h-11 w-full rounded-lg border-[0.1875rem] border-ink bg-sun font-display text-lg"
          >
            다른 체험으로 바꾸기
          </button>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-fg-muted">버전 {APP_VERSION}</span>
          <button
            type="button"
            onClick={onAskReset}
            className="h-10 text-sm font-bold text-fg-muted underline"
          >
            전체 기록 지우기
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── 전원 끄기 (오프라인 설치판 전용) ───────── */

const POWER_TAPS = 5;

type PowerStep = "idle" | "confirm" | "sending" | "counting" | "failed";

/** 왼쪽 위 전원 버튼. 아이들이 실수로 끄지 않게 연속 5번 누른 뒤 한 번 더 확인한다.
 * 게임 중(카운트다운·경기·이름 입력)에는 아예 보이지 않는다.
 * 실제 종료는 설치판 server.ps1의 /api/shutdown 이 15초 뒤 PC를 끄고, 그 사이 취소할 수 있다.
 */
function PowerControl() {
  const [taps, setTaps] = useState(0);
  const [lastTap, setLastTap] = useState(0);
  const [step, setStep] = useState<PowerStep>("idle");
  const [left, setLeft] = useState(0);
  // TV 앱은 리모컨 전원으로 끈다
  // 서버 렌더와 맞추려고 처음엔 false, 화면이 뜬 뒤에 판단한다
  const [kiosk, setKiosk] = useState(false);
  useEffect(() => setKiosk(isKiosk() && !isTv()), []);

  // 2초 동안 안 누르면 횟수를 처음부터
  useEffect(() => {
    if (taps === 0 || step !== "idle") return;
    const id = window.setTimeout(() => setTaps(0), 2000);
    return () => window.clearTimeout(id);
  }, [taps, lastTap, step]);

  useEffect(() => {
    if (step !== "counting") return;
    if (left <= 0) return;
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [step, left]);

  useEffect(() => {
    if (taps < POWER_TAPS) return;
    setTaps(0);
    setStep("confirm");
  }, [taps]);

  if (!kiosk) return null;

  const call = async (path: string) => {
    const res = await fetch(path, { method: "POST", headers: { "X-DG-Action": "power" } });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as { ok: boolean; seconds?: number };
  };

  // 빠르게 연달아 눌러도 횟수를 놓치지 않게 이전 값 기준으로 센다
  const tap = () => {
    setLastTap(Date.now());
    setTaps((n) => n + 1);
  };

  const confirm = async () => {
    setStep("sending");
    try {
      const r = await call("/api/shutdown");
      setLeft(r.seconds ?? 15);
      setStep("counting");
    } catch {
      setStep("failed");
    }
  };

  const cancel = async () => {
    if (step === "counting") {
      try {
        await call("/api/shutdown/cancel");
      } catch {
        /* 취소 요청 실패는 아래 안내로 대신한다 */
      }
    }
    setStep("idle");
    setTaps(0);
  };

  return (
    <>
      <button
        type="button"
        onClick={tap}
        aria-label="전원 끄기(연속 5번)"
        className="t-btn pointer-events-auto absolute top-3 left-3 z-20 flex size-12 items-center justify-center bg-cream text-ink"
      >
        <Power className="size-5" strokeWidth={3} />
      </button>
      {taps > 0 && step === "idle" && (
        <p
          key={taps}
          className="animate-pop pointer-events-none absolute top-16 left-3 z-20 rounded-full border-[0.1875rem] border-ink bg-cream px-2.5 py-0.5 font-display text-xs"
        >
          전원 끄기: {POWER_TAPS - taps}번 더
        </p>
      )}
      {step !== "idle" && (
        <div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/70 px-6">
          <div className="t-panel relative w-full max-w-sm px-5 pt-10 pb-5 text-center">
            <div className="absolute -top-8 left-1/2 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border-[0.3125rem] border-ink bg-don text-cream shadow-[0_0.3125rem_0_var(--color-ink)]">
              <Power className="size-8" strokeWidth={3} />
            </div>
            {step === "confirm" || step === "sending" ? (
              <>
                <p className="font-display text-2xl">게임 PC를 끌까요?</p>
                <p className="mt-2 text-sm text-fg-muted">
                  점수 기록은 그대로 남아요. 끈 뒤 다시 켜면 게임이 자동으로 시작돼요.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={cancel}
                    className="t-btn h-14 flex-1 bg-cream text-xl"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={confirm}
                    disabled={step === "sending"}
                    className="t-btn h-14 flex-1 bg-don text-xl text-cream disabled:opacity-60"
                  >
                    전원 끄기
                  </button>
                </div>
              </>
            ) : step === "counting" ? (
              <>
                <p className="font-display text-2xl">
                  <span className="t-outline-sm text-4xl tabular-nums text-sun">
                    {Math.max(0, left)}
                  </span>
                  초 뒤 꺼집니다
                </p>
                <p className="mt-2 text-sm text-fg-muted">잘못 눌렀다면 아래를 눌러 취소하세요.</p>
                <button
                  type="button"
                  onClick={cancel}
                  className="t-btn mt-6 h-14 w-full bg-cream text-xl"
                >
                  끄기 취소
                </button>
              </>
            ) : (
              <>
                <p className="font-display text-2xl">이 화면에서는 끌 수 없어요</p>
                <p className="mt-2 text-sm text-fg-muted">
                  설치판(start.bat)으로 실행했을 때만 전원을 끌 수 있습니다. 윈도우 시작 메뉴에서 꺼
                  주세요.
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  className="t-btn mt-6 h-14 w-full bg-cream text-xl"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ───────── 골리앗 체력 · KO · 거대 골리앗 ───────── */

function HpBar({ ratio, fever }: { ratio: number; fever: boolean }) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <div className="mt-2 flex items-center gap-2 px-3 pr-16">
      <span className="t-outline-sm shrink-0 font-display text-lg text-cream">골리앗</span>
      <div className="relative h-7 flex-1 overflow-hidden rounded-full border-[0.25rem] border-ink bg-ink/70">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${pct > 40 ? "bg-don" : pct > 15 ? "bg-orange" : "animate-throb bg-sun"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {fever && (
        <span className="animate-throb shrink-0 rounded-full border-[0.1875rem] border-ink bg-sun px-2 py-0.5 font-display text-sm text-don">
          피버 ×2
        </span>
      )}
    </div>
  );
}

function KoSplash() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3">
      <p className="animate-pop t-outline font-display text-[9rem] leading-none text-sun drop-shadow-[0_0.6rem_0_var(--color-ink)]">
        KO!
      </p>
      <p className="animate-pop t-outline font-display text-4xl text-cream">골리앗을 쓰러뜨렸다!</p>
    </div>
  );
}

export function GiantBar({ giant }: { giant: UiSnap["giant"] }) {
  const pct = giant.max > 0 ? Math.max(0, Math.min(1, giant.hp / giant.max)) * 100 : 100;
  return (
    <div className="mt-3 rounded-2xl border-[0.25rem] border-ink bg-sun/40 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="font-display text-base">오늘의 거대 골리앗</span>
        <span className="text-xs font-bold text-fg-muted">
          도전 {giant.plays}명{giant.defeated > 0 ? ` · ${giant.defeated}마리 쓰러뜨림` : ""}
        </span>
      </div>
      <div className="mt-1 h-5 overflow-hidden rounded-full border-[0.1875rem] border-ink bg-white">
        <div className="h-full rounded-full bg-don" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-center font-display text-sm text-don">
        모두의 점수로 함께 쓰러뜨려요! 남은 체력 {Math.ceil(pct)}%
      </p>
    </div>
  );
}

/* ───────── 가로 화면(TV) 오른쪽 패널 ───────── */

/** 가로 TV에서 게임 오른쪽에 보이는 패널: 제목, 오늘의 거대 골리앗, 이달 순위, 게임 방법. */
export function SidePanel({ ui }: { ui: UiSnap }) {
  const month = monthKey(Date.now());
  const top = monthlyRows(ui.scores, month).slice(0, 5);
  return (
    <div className="flex w-full flex-col gap-4 text-fg">
      <div className="flex justify-center">
        <Title size="md" />
      </div>
      {EDITION.venueName && (
        <p className="t-outline-sm text-center font-display text-lg text-cream">
          {EDITION.venueName}
        </p>
      )}
      <div className="t-panel p-3">
        <GiantBar giant={ui.giant} />
      </div>
      <div className="t-panel p-4">
        <BoardHeader
          month={month}
          onLong={() => window.dispatchEvent(new Event(OPEN_ADMIN_EVENT))}
        />
        <ol className="mt-2 space-y-1.5">
          {top.length === 0 && (
            <li className="py-2 text-center font-display text-lg text-fg-muted">
              첫 번째 용사를 기다립니다
            </li>
          )}
          {top.map((row, i) => (
            <li key={`${row.at}-${i}`} className="flex items-center gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[0.1875rem] border-ink font-display text-base ${MEDAL[i] ?? "bg-cream"}`}
              >
                {i + 1}
              </span>
              <span
                className={`min-w-0 flex-1 truncate font-display text-lg ${row.name ? "" : "text-fg-muted"}`}
              >
                {row.name ?? "이름 없음"}
              </span>
              <span className="font-display text-lg tabular-nums">
                {row.score.toLocaleString("ko-KR")}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {!EDITION.showVerses && <HowToBlock compact />}
    </div>
  );
}

/** 게임 중 양손을 계속 들고 있으면 처음 화면으로 돌아가는 진행 표시. */
function HomeHold({ progress }: { progress: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-ink/40">
      <div className="relative size-40">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="rgba(42,22,12,0.85)"
            stroke="rgba(255,244,220,0.3)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--color-sun)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - progress)}
          />
        </svg>
        <Home className="absolute inset-0 m-auto size-16 text-cream" strokeWidth={2.5} />
      </div>
      <p className="t-outline mt-4 font-display text-4xl text-cream">처음 화면으로 돌아가요</p>
      <p className="t-outline-sm mt-1 font-display text-xl text-cream">계속하려면 손을 내리세요</p>
    </div>
  );
}
