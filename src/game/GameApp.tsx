import { useEffect, useRef, useState } from "react";
import { GameAudio } from "./audio";
import { WORLD_H, WORLD_W, ROUND_SECONDS } from "./constants";
import { drawPip } from "./draw";
import { Game } from "./engine";
import { Overlays } from "./overlays";
import { PoseController } from "./pose";
import type { UiSnap } from "./types";
import { VERSES } from "./verses";

function syncPose(g: Game | null | undefined, pose: PoseController): void {
  if (!g) return;
  if (pose.status === "denied") {
    g.setReadiness("denied", pose.error, "off", null);
    return;
  }
  if (pose.status !== "live") {
    g.setReadiness(pose.status === "loading" ? "loading" : "off", null, "off", null);
    return;
  }
  if (pose.poseReady) g.setReadiness("live", null, "ready", null);
  else if (pose.modelError) g.setReadiness("live", null, "failed", pose.modelError);
  else g.setReadiness("live", null, "loading", null);
}

const initialUi = (): UiSnap => ({
  phase: "boot",
  score: 0,
  combo: 0,
  maxCombo: 0,
  timeLeft: ROUND_SECONDS,
  countdown: 3,
  verse: VERSES[0],
  personPresent: false,
  cameraState: "off",
  lastHit: null,
  resultRank: 0,
  scores: [],
  muted: false,
  confirmReset: false,
  banner: null,
  motionHint: "",
  poseReady: false,
  modelState: "off",
  modelError: null,
  armed: false,
  cameraError: null,
  foreheadHits: 0,
  comboLeft: 0,
  bestScore: 0,
  freezeLeft: 0,
  freezeCd: 0,
  freezeFound: false,
  inputVia: "webcam",
  checkMode: false,
});

export function GameApp() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const gameRef = useRef<Game | null>(null);
  const poseRef = useRef<PoseController | null>(null);
  const startingRef = useRef(false);
  const [ui, setUi] = useState<UiSnap>(initialUi);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const audio = new GameAudio();
    const game = new Game(audio, (snap) => setUi(snap));
    gameRef.current = game;
    (window as unknown as { __game: Game }).__game = game;
    const pose = new PoseController();
    poseRef.current = pose;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let lastPhase = game.phase;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      if (pose.takeDisconnect()) {
        game.setReadiness("off", null, "off", null);
      }
      if (video && (pose.status === "live" || pose.hasStream())) {
        const frame = pose.status === "live" ? pose.tick(now) : pose.lastFrame;
        if (pose.poseReady) game.notePose(frame);
        const pip = pipRef.current;
        if (pip) {
          const pctx = pip.getContext("2d");
          if (pctx) drawPip(pctx, video, frame.skeleton, frame.present);
        }
      }
      if (game.phase !== lastPhase) {
        if (game.phase === "play" || game.phase === "practice" || game.phase === "attract") pose.resetMotion();
        lastPhase = game.phase;
      }
      game.update(now);
      const r = wrap.getBoundingClientRect();
      ctx.setTransform(dprScale(canvas), 0, 0, dprScale(canvas), 0, 0);
      ctx.clearRect(0, 0, r.width, r.height);
      ctx.save();
      ctx.scale(r.width / WORLD_W, r.height / WORLD_H);
      game.render(ctx);
      ctx.restore();
    };
    raf = requestAnimationFrame(loop);

    const toWorld = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / Math.max(1, r.width)) * WORLD_W,
        y: ((e.clientY - r.top) / Math.max(1, r.height)) * WORLD_H,
      };
    };
    const onDown = (e: PointerEvent) => {
      const p = toWorld(e);
      game.pointerDown(p.x, p.y, e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const p = toWorld(e);
      game.pointerMove(p.x, p.y, e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      const p = toWorld(e);
      game.pointerUp(p.x, p.y, e.pointerId);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);

    const onVis = () => {
      if (document.visibilityState === "visible") audio.unlock();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVis);
      pose.stop();
    };
  }, []);

  const startCamera = async () => {
    const g = gameRef.current;
    const pose = poseRef.current;
    const video = videoRef.current;
    if (!pose || !video || startingRef.current) return;
    startingRef.current = true;
    g?.setReadiness("loading", null, "off", null);
    try {
      await pose.start(video, () => {
        g?.setReadiness("live", null, "loading", null);
      });
      syncPose(g, pose);
    } catch {
      pose.status = "denied";
      g?.setReadiness("denied", "카메라를 켜지 못했습니다. 다시 시도해 주세요.", "off", null);
    } finally {
      startingRef.current = false;
    }
  };

  const retryMotion = async () => {
    const g = gameRef.current;
    const pose = poseRef.current;
    if (!pose || pose.status !== "live") {
      await startCamera();
      return;
    }
    if (startingRef.current) return;
    startingRef.current = true;
    g?.setReadiness("live", null, "loading", null);
    try {
      await pose.loadModel();
      syncPose(g, pose);
    } finally {
      startingRef.current = false;
    }
  };

  const begin = () => {
    const g = gameRef.current;
    g?.begin();
    void startCamera();
  };

  const openNewWindow = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  const pipLow = ui.phase === "play" || ui.phase === "practice" || ui.phase === "countdown";
  const showPip =
    ui.cameraState === "live" || ui.cameraState === "loading"
      ? ui.phase === "attract" ||
        ui.phase === "start" ||
        ui.phase === "practice" ||
        ui.phase === "countdown" ||
        ui.phase === "play"
      : false;

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-bg">
      <div
        ref={wrapRef}
        className="relative overflow-hidden bg-bg touch-manipulation select-none"
        style={{
          width: "min(100dvw, calc(100dvh * 9 / 16))",
          height: "min(100dvh, calc(100dvw * 16 / 9))",
        }}
        data-phase={ui.phase}
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />
        <div
          className={`pointer-events-none absolute z-10 w-32 ${pipLow ? "bottom-24 left-3" : "top-24 left-3"} ${showPip ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className={`relative h-24 w-32 overflow-hidden rounded-2xl border-[5px] bg-ink shadow-[0_5px_0_var(--color-ink)] ${ui.personPresent ? "border-ink" : "border-ink/70"}`}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 size-full object-cover"
              style={{ transform: "scaleX(-1)" }}
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={pipRef}
              width={320}
              height={240}
              className="absolute inset-0 size-full"
            />
          </div>
          <p
            className={`mx-auto -mt-3 w-fit rounded-full border-[3px] border-ink px-2.5 py-0.5 text-center font-display text-xs ${ui.personPresent ? "bg-sun text-ink" : "bg-cream text-ink"}`}
          >
            {ui.modelState === "failed"
              ? "모션 실패"
              : ui.modelState === "loading"
                ? "모션 준비 중"
                : ui.personPresent
                  ? "인식됨"
                  : "상반신을 보여 주세요"}
          </p>
        </div>
        <Overlays
          ui={ui}
          onBegin={begin}
          onStart={() => {
            const g = gameRef.current;
            if (!g) return;
            if (g.cameraState !== "live") void startCamera();
            g.pressStart();
          }}
          onRetryCamera={() => void startCamera()}
          onRetryMotion={() => void retryMotion()}
          onOpenWindow={openNewWindow}
          onSkipPractice={() => gameRef.current?.skipPractice()}
          onNext={() => gameRef.current?.nextPlayer()}
          onMute={() => gameRef.current?.toggleMute()}
          onAskReset={() => gameRef.current?.askReset()}
          onConfirmReset={() => gameRef.current?.confirmClear()}
          onCancelReset={() => gameRef.current?.cancelClear()}
        />
      </div>
    </div>
  );
}

function dprScale(canvas: HTMLCanvasElement): number {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cssW = canvas.getBoundingClientRect().width;
  if (cssW <= 0) return dpr;
  return canvas.width / cssW;
}
