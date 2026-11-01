import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import "@fontsource/gowun-batang/700.css";
import { PoseController } from "@/game/pose";
import {
  isKiosk,
  isTv,
  listCameras,
  preferredCameraId,
  setPreferredCamera,
  setupKiosk,
} from "@/game/kiosk";
import { FashionGame, GRADE_NAMES, type FashionUi, type Mode } from "./core";
import { FashionSound } from "./sound";
import { resetStation, stationInfo, type StationId } from "./stations";
import { IronMode } from "./modes/iron";
import { ScissorsMode } from "./modes/scissors";
import { SewingMode } from "./modes/sewing";
import { RhythmMode } from "./modes/rhythm";

type FashionStation = Exclude<StationId, "goliath">;

function makeMode(id: FashionStation): Mode {
  if (id === "iron") return new IronMode();
  if (id === "scissors") return new ScissorsMode();
  if (id === "sewing") return new SewingMode();
  return new RhythmMode();
}

const HOW: Record<FashionStation, string[]> = {
  iron: [
    "양손을 머리 위로 번쩍! 1초 유지하면 시작",
    "손이 다리미가 돼요. 옷 위를 쓱쓱 문질러요",
    "주름을 다 펴면 다음 옷! 많이 완성할수록 높은 점수",
  ],
  scissors: [
    "양손을 머리 위로 번쩍! 1초 유지하면 시작",
    "손이 가위가 돼요. 빛나는 점에 손을 대요",
    "점선을 따라 한 바퀴! 옷본을 많이 오릴수록 높은 점수",
  ],
  sewing: [
    "양손을 머리 위로 번쩍! 1초 유지하면 시작",
    "손이 바늘이 돼요. 반짝이는 구멍을 번호 순서대로 콕",
    "빨리 이어 찍으면 콤보! 솔기를 다 꿰매면 보너스",
  ],
  rhythm: [
    "양손을 머리 위로 번쩍! 1초 유지하면 시작",
    "바깥 고리가 줄어들어 원에 닿을 때 손을 대요",
    "금빛 고리는 만세! 두 손 모두 위로",
  ],
};

const initialUi: FashionUi = {
  phase: "boot",
  score: 0,
  timeLeft: 30,
  seconds: 30,
  countdown: 3,
  handsUp: 0,
  present: false,
  camera: "off",
  model: "off",
  hint: "",
  stats: [],
  grade: 3,
  rank: 0,
  todayTop: [],
  todayCount: 0,
  muted: false,
  soundBlocked: false,
  resultLeft: 0,
};

const WORLD_W = 1920;

export function FashionApp({ station }: { station: FashionStation }) {
  const info = stationInfo(station);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pipRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FashionGame | null>(null);
  const poseRef = useRef<PoseController | null>(null);
  const startingRef = useRef(false);
  const [ui, setUi] = useState<FashionUi>(initialUi);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sound = new FashionSound();
    const game = new FashionGame(station, makeMode(station), sound, setUi);
    gameRef.current = game;
    (window as unknown as { __fashion: FashionGame }).__fashion = game;
    const pose = new PoseController();
    poseRef.current = pose;

    let scale = 1;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(isTv() ? 1 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      scale = (w * dpr) / WORLD_W;
      game.resize(WORLD_W, Math.round((WORLD_W * h) / Math.max(1, w)));
      const k = Math.max(0.75, Math.min(3, Math.min(w / 1280, h / 720)));
      document.documentElement.style.fontSize = `${(16 * k).toFixed(2)}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      if (pose.takeDisconnect()) game.setReadiness("off", "off");
      if (video && pose.status === "live") {
        const frame = pose.tick(now);
        if (pose.poseReady) game.notePose(frame, now);
        const pip = pipRef.current?.getContext("2d");
        if (pip) drawPipDots(pip, video, frame.skeleton, frame.present);
      }
      game.update(now);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      game.render(ctx);
    };
    raf = requestAnimationFrame(loop);

    const toWorld = (e: PointerEvent) => ({
      x: (e.clientX / Math.max(1, window.innerWidth)) * game.W,
      y: (e.clientY / Math.max(1, window.innerHeight)) * game.H,
    });
    let down = false;
    const onDown = (e: PointerEvent) => {
      down = true;
      const p = toWorld(e);
      game.pointerMove(p.x, p.y, performance.now(), true);
    };
    const onMove = (e: PointerEvent) => {
      if (!down && e.pointerType !== "mouse") return;
      const p = toWorld(e);
      game.pointerMove(p.x, p.y, performance.now(), down || e.pointerType === "mouse");
    };
    const onUp = () => {
      down = false;
      game.pointerUp();
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onUp);
    const wake = () => sound.unlock();
    window.addEventListener("pointerdown", wake, { capture: true });
    window.addEventListener("keydown", wake, { capture: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onUp);
      window.removeEventListener("pointerdown", wake, { capture: true });
      window.removeEventListener("keydown", wake, { capture: true });
      sound.stopMusic();
      pose.stop();
      document.documentElement.style.fontSize = "";
    };
  }, [station]);

  const sync = () => {
    const g = gameRef.current;
    const pose = poseRef.current;
    if (!g || !pose) return;
    if (pose.status === "denied") g.setReadiness("denied", "off");
    else if (pose.status !== "live")
      g.setReadiness(pose.status === "loading" ? "loading" : "off", "off");
    else g.setReadiness("live", pose.poseReady ? "ready" : pose.modelError ? "failed" : "loading");
  };

  const startCamera = async () => {
    const pose = poseRef.current;
    const video = videoRef.current;
    const g = gameRef.current;
    if (!pose || !video || startingRef.current) return;
    startingRef.current = true;
    g?.setReadiness("loading", "off");
    try {
      await pose.start(video, () => g?.setReadiness("live", "loading"));
    } catch {
      pose.status = "denied";
    } finally {
      startingRef.current = false;
      sync();
    }
  };

  const startRef = useRef(startCamera);
  startRef.current = startCamera;

  // 켜지면 바로 대기 화면 + 카메라. 키오스크면 5초마다 카메라·인식을 다시 살핀다.
  useEffect(() => {
    gameRef.current?.begin();
    void startRef.current();
    const cleanup = isKiosk() ? setupKiosk() : () => {};
    const id = window.setInterval(() => {
      const g = gameRef.current;
      const pose = poseRef.current;
      if (!g || !pose || startingRef.current) return;
      if (pose.status === "off" || pose.status === "denied") void startRef.current();
      else if (pose.status === "live" && !pose.poseReady && pose.modelError) {
        startingRef.current = true;
        void pose.loadModel().finally(() => {
          startingRef.current = false;
          sync();
        });
      } else sync();
    }, 5000);
    return () => {
      cleanup();
      window.clearInterval(id);
    };
  }, []);

  const g = () => gameRef.current;
  const playing = ui.phase === "play";
  const timePct = ui.seconds > 0 ? ui.timeLeft / ui.seconds : 0;
  const cameraLabel =
    ui.camera === "denied"
      ? "카메라 없음 · 화면을 눌러요"
      : ui.camera !== "live"
        ? "카메라 준비 중"
        : ui.model === "failed"
          ? "동작 인식 다시 시도 중"
          : ui.model !== "ready"
            ? "동작 인식 준비 중"
            : ui.present
              ? "인식됨"
              : "카메라 앞에 서 주세요";

  return (
    <div className="f-root fixed inset-0 overflow-hidden select-none">
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />

      {/* 내 모습 */}
      <div className="pointer-events-none absolute top-4 right-4 z-10 w-[11rem]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/40 bg-black/60 shadow-lg">
          <video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover"
            style={{ transform: "scaleX(-1)" }}
            playsInline
            muted
            autoPlay
          />
          <canvas ref={pipRef} width={320} height={240} className="absolute inset-0 size-full" />
        </div>
        <p
          className={`mt-1.5 text-center text-xs font-bold ${ui.present ? "text-[var(--f-mint)]" : "text-[var(--f-muted)]"}`}
        >
          {cameraLabel}
        </p>
      </div>

      {/* 체험 이름(길게 누르면 운영자 화면) */}
      <TitleBadge no={info.no} title={info.title} onLong={() => setAdmin(true)} />

      {(playing || ui.phase === "countdown") && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-5">
          <div className="f-card flex items-center gap-3 px-6 py-2">
            <span className="text-sm text-[var(--f-muted)]">점수</span>
            <span className="f-serif f-pearl text-4xl tabular-nums">
              {ui.score.toLocaleString("ko-KR")}
            </span>
          </div>
          <TimerRing pct={timePct} left={Math.ceil(ui.timeLeft)} />
        </div>
      )}

      {playing && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2">
          <p className="f-card f-serif px-7 py-2.5 text-center text-xl whitespace-nowrap">
            {ui.hint}
          </p>
        </div>
      )}

      {ui.phase === "attract" && (
        <Attract station={station} ui={ui} onStart={() => g()?.pressStart()} />
      )}

      {ui.phase === "countdown" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/35">
          <p key={ui.countdown} className="f-serif f-pearl animate-pop text-[10rem] leading-none">
            {ui.countdown}
          </p>
          <p className="f-serif mt-4 text-2xl">{HOW[station][1]}</p>
        </div>
      )}

      {ui.phase === "result" && (
        <Result ui={ui} onAgain={() => g()?.pressStart()} onHome={() => g()?.goAttract()} />
      )}

      {ui.soundBlocked && (
        <button
          type="button"
          onClick={() => undefined}
          className="f-ghost absolute bottom-4 left-4 z-30 px-4 py-2 text-sm"
        >
          화면을 한 번 눌러 소리를 켜 주세요
        </button>
      )}

      {admin && (
        <AdminPanel
          muted={ui.muted}
          onClose={() => setAdmin(false)}
          onMute={() => {
            const game = g();
            if (!game) return;
            game.sound.setMuted(!game.sound.muted);
            game.emit(true);
          }}
          onClearToday={() => g()?.clearToday()}
          onCamera={async (id) => {
            setPreferredCamera(id);
            poseRef.current?.stop();
            await startCamera();
          }}
        />
      )}
    </div>
  );
}

/* ───────── 조각들 ───────── */

function TitleBadge({ no, title, onLong }: { no: string; title: string; onLong: () => void }) {
  const started = useRef(0);
  const begin = () => {
    started.current = performance.now();
  };
  const end = () => {
    if (started.current && performance.now() - started.current > 1400) onLong();
    started.current = 0;
  };
  return (
    <button
      type="button"
      onPointerDown={begin}
      onPointerUp={end}
      onKeyDown={(e: KeyboardEvent) => {
        if ((e.key === "Enter" || e.key === " ") && !started.current) begin();
      }}
      onKeyUp={(e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") end();
      }}
      className="absolute top-4 left-4 z-10 flex items-baseline gap-3 rounded-full px-2 text-left text-[var(--f-ink)]"
      aria-label={`${title} (길게 누르면 운영자 화면)`}
    >
      <span className="f-serif f-pearl text-3xl">{no}</span>
      <span className="f-serif text-2xl">{title}</span>
    </button>
  );
}

function TimerRing({ pct, left }: { pct: number; left: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const urgent = left <= 5;
  return (
    <div className="relative size-[4.2rem]">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="rgba(18,14,28,0.8)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={urgent ? "#ff6fa8" : "#c8b8ff"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))}
        />
      </svg>
      <span
        className={`f-serif absolute inset-0 flex items-center justify-center text-2xl tabular-nums ${urgent ? "text-[var(--f-pink)]" : ""}`}
      >
        {left}
      </span>
    </div>
  );
}

function Attract({
  station,
  ui,
  onStart,
}: {
  station: FashionStation;
  ui: FashionUi;
  onStart: () => void;
}) {
  const info = stationInfo(station);
  const ready = ui.camera === "live" && ui.model === "ready";
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-between gap-6 bg-gradient-to-r from-black/70 via-black/20 to-black/70 px-[4%] portrait:flex-col portrait:justify-center portrait:gap-4 portrait:bg-black/55">
      <div className="f-card pointer-events-auto w-[26rem] max-w-[42%] p-7 portrait:w-full portrait:max-w-[26rem] portrait:p-5">
        <p className="text-sm tracking-[0.3em] text-[var(--f-muted)]">WEAVE ON · AX 패션체험</p>
        <h1 className="f-serif mt-2 text-5xl leading-tight">
          <span className="f-pearl">{info.title}</span>
        </h1>
        <p className="f-serif mt-2 text-xl text-[var(--f-muted)]">{info.line}</p>
        <ol className="mt-5 space-y-3">
          {HOW[station].map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="f-serif flex size-8 shrink-0 items-center justify-center rounded-full border border-white/50 text-lg">
                {i + 1}
              </span>
              <span className="pt-1 text-base leading-snug">{s}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--f-pink)] via-[var(--f-lilac)] to-[var(--f-mint)]"
              style={{ width: `${ui.handsUp * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-sm text-[var(--f-muted)]">
            {ready
              ? ui.present
                ? "양손을 머리 위로 번쩍 들어 주세요!"
                : "화면 앞 발자국에 서 주세요"
              : "카메라를 준비하고 있어요"}
          </p>
        </div>
        <button type="button" onClick={onStart} className="f-btn mt-4 h-14 w-full text-2xl">
          시작하기
        </button>
      </div>

      <div className="f-card w-[20rem] max-w-[34%] p-6 portrait:w-full portrait:max-w-[26rem] portrait:p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="f-serif text-2xl">오늘의 디자이너</h2>
          <span className="text-sm text-[var(--f-muted)]">참여 {ui.todayCount}명</span>
        </div>
        <ol className="mt-4 space-y-2">
          {ui.todayTop.length === 0 && (
            <li className="f-serif py-4 text-center text-lg text-[var(--f-muted)]">
              첫 번째 주인공이 되어 보세요
            </li>
          )}
          {ui.todayTop.map((r, i) => (
            <li key={r.at} className="flex items-center gap-3">
              <span
                className={`f-serif flex size-8 items-center justify-center rounded-full text-lg ${i === 0 ? "bg-[var(--f-gold)] text-[#1b1526]" : "border border-white/40"}`}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-sm text-[var(--f-muted)]">
                {new Date(r.at).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })}
              </span>
              <span className="f-serif text-2xl tabular-nums">{r.s.toLocaleString("ko-KR")}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Result({
  ui,
  onAgain,
  onHome,
}: {
  ui: FashionUi;
  onAgain: () => void;
  onHome: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
      <div className="f-card animate-pop w-[34rem] max-w-[92%] p-8 text-center">
        <p className="text-sm tracking-[0.3em] text-[var(--f-muted)]">오늘의 등급</p>
        <p className="f-serif f-pearl mt-1 text-5xl">{GRADE_NAMES[ui.grade]}</p>
        <p className="f-serif mt-4 text-7xl tabular-nums">{ui.score.toLocaleString("ko-KR")}</p>
        <p className="mt-1 text-base text-[var(--f-muted)]">
          {ui.rank > 0 ? `오늘 ${ui.todayCount}명 중 ${ui.rank}위` : "다시 도전해 보세요!"}
        </p>
        <div className="mt-5 flex justify-center gap-3">
          {ui.stats.map((s) => (
            <div
              key={s.label}
              className="min-w-[7rem] rounded-2xl border border-white/25 bg-white/5 px-4 py-3"
            >
              <p className="text-sm text-[var(--f-muted)]">{s.label}</p>
              <p className="f-serif text-3xl">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onAgain} className="f-btn h-13 flex-1 py-3 text-xl">
            다시 하기
          </button>
          <button type="button" onClick={onHome} className="f-ghost h-13 flex-1 py-3 text-xl">
            처음으로
          </button>
        </div>
        <p className="mt-3 text-sm text-[var(--f-muted)]">
          양손을 들면 바로 다시 · {ui.resultLeft}초 뒤 처음 화면
        </p>
      </div>
    </div>
  );
}

function AdminPanel({
  muted,
  onClose,
  onMute,
  onClearToday,
  onCamera,
}: {
  muted: boolean;
  onClose: () => void;
  onMute: () => void;
  onClearToday: () => void;
  onCamera: (id: string | null) => void;
}) {
  const [cams, setCams] = useState<{ id: string; label: string }[]>([]);
  const [confirm, setConfirm] = useState(false);
  const current = useMemo(() => preferredCameraId(), []);
  useEffect(() => {
    void listCameras().then(setCams);
  }, []);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70">
      <div className="f-card w-[30rem] max-w-[92%] space-y-4 p-7">
        <h2 className="f-serif text-3xl">운영자 화면</h2>
        <button
          type="button"
          onClick={resetStation}
          className="f-btn w-full py-3 text-xl"
          autoFocus
        >
          체험 바꾸기
        </button>
        <button type="button" onClick={onMute} className="f-ghost w-full py-3 text-lg">
          {muted ? "소리 켜기" : "소리 끄기"}
        </button>
        <div>
          <p className="mb-2 text-sm text-[var(--f-muted)]">카메라 고르기</p>
          <div className="space-y-2">
            {cams.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onCamera(c.id)}
                className={`f-ghost w-full px-4 py-2 text-left text-sm ${c.id === current ? "border-[var(--f-mint)]" : ""}`}
              >
                {c.label}
              </button>
            ))}
            {cams.length === 0 && (
              <p className="text-sm text-[var(--f-muted)]">찾은 카메라가 없어요</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!confirm) setConfirm(true);
            else {
              onClearToday();
              setConfirm(false);
            }
          }}
          className="f-ghost w-full py-3 text-lg"
        >
          {confirm ? "한 번 더 누르면 오늘 기록을 지웁니다" : "오늘 기록 지우기"}
        </button>
        <button type="button" onClick={onClose} className="f-ghost w-full py-3 text-lg">
          닫기
        </button>
      </div>
    </div>
  );
}

/** 내 모습 위에 두 손 위치를 점으로. */
function drawPipDots(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  skeleton: { x: number; y: number; v: number }[] | null,
  present: boolean,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!skeleton || !present) return;
  const vw = video.videoWidth || 4;
  const vh = video.videoHeight || 3;
  const k = Math.max(w / vw, h / vh);
  const ox = (w - vw * k) / 2;
  const oy = (h - vh * k) / 2;
  [skeleton[5], skeleton[6]].forEach((p, i) => {
    if (!p || p.v < 0.3) return;
    ctx.beginPath();
    ctx.arc(ox + p.x * vw * k, oy + p.y * vh * k, 12, 0, Math.PI * 2);
    ctx.fillStyle = i ? "#a8f0e0" : "#ffb8dc";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  });
}
