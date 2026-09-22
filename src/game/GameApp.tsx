import { useEffect, useRef, useState } from "react";
import { GameAudio } from "./audio";
import { WORLD_H, WORLD_W, ROUND_SECONDS } from "./constants";
import { drawPip } from "./draw";
import { Game } from "./engine";
import { Overlays } from "./overlays";
import { PoseController } from "./pose";
import type { UiSnap } from "./types";
import { randomVerse } from "./verses";

const initialUi = (): UiSnap => ({
  phase: "boot",
  score: 0,
  combo: 0,
  maxCombo: 0,
  timeLeft: ROUND_SECONDS,
  countdown: 3,
  verse: randomVerse(),
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
  armed: false,
  cameraError: null,
  foreheadHits: 0,
  comboLeft: 0,
  bestScore: 0,
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

    const bg = new Image();
    bg.src = "/valley.jpg";
    bg.onload = () => game.setBackground(bg);

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
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const video = videoRef.current;
      if (video && (pose.status === "live" || pose.hasStream())) {
        const frame = pose.status === "live" ? pose.tick(now) : pose.lastFrame;
        if (pose.poseReady) game.notePose(frame);
        const pip = pipRef.current;
        if (pip) {
          const pctx = pip.getContext("2d");
          if (pctx) drawPip(pctx, video, frame.skeleton, frame.present);
        }
      }
      game.update(dt);
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
    const isChrome = (t: EventTarget | null) =>
      t instanceof HTMLElement && Boolean(t.closest("button"));

    const onDown = (e: PointerEvent) => {
      if (isChrome(e.target)) return;
      e.preventDefault();
      try {
        wrap.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
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
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);

    const onVis = () => {
      if (document.visibilityState === "visible") audio.unlock();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
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
    g?.setCameraState("loading");
    try {
      await pose.start(video, () => {
        g?.setCameraState("live");
      });
      if (pose.status === "denied") g?.setCameraState("denied", pose.error);
      else {
        g?.setCameraState("live");
        g?.setPoseReady(pose.poseReady);
      }
    } catch {
      pose.status = "denied";
      g?.setCameraState("denied", "카메라를 켜지 못했습니다. 다시 시도해 주세요.");
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

  const showPip =
    ui.cameraState === "live" || ui.cameraState === "loading"
      ? ui.phase === "attract" || ui.phase === "start" || ui.phase === "countdown" || ui.phase === "play"
      : false;

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-bg">
      <div
        ref={wrapRef}
        className="relative overflow-hidden bg-bg touch-none select-none"
        style={{
          width: "min(100dvw, calc(100dvh * 9 / 16))",
          height: "min(100dvh, calc(100dvw * 16 / 9))",
        }}
        data-phase={ui.phase}
      >
        <canvas ref={canvasRef} className="absolute inset-0 size-full" />
        <div
          className={`pointer-events-none absolute top-20 left-3 z-10 w-36 ${showPip ? "opacity-100" : "opacity-0"}`}
        >
          <p className="mb-1 text-center text-xs tracking-[0.16em] text-fg-muted">내 모습</p>
          <div className="relative h-28 w-36">
            <video
              ref={videoRef}
              className={`absolute inset-0 size-full rounded-md border object-cover ${ui.personPresent ? "border-fg" : "border-border"}`}
              style={{ transform: "scaleX(-1)" }}
              playsInline
              muted
              autoPlay
            />
            <canvas
              ref={pipRef}
              width={320}
              height={240}
              className="absolute inset-0 size-full rounded-md"
            />
          </div>
          <p className="mt-1 text-center text-xs text-fg-subtle">
            {ui.personPresent ? "인식됨" : "상반신을 보여 주세요"}
          </p>
        </div>
        <Overlays
          ui={ui}
          onBegin={begin}
          onStart={() => {
            if (ui.cameraState !== "live") void startCamera();
            else gameRef.current?.uiAdvance();
          }}
          onRetryCamera={() => void startCamera()}
          onOpenWindow={openNewWindow}
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
