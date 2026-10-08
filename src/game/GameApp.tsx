import { useEffect, useRef, useState } from "react";
import "@fontsource/jua";
import { GameAudio } from "./audio";
import { WORLD_H, WORLD_W, ROUND_SECONDS } from "./constants";
import { drawPip } from "./draw";
import { Game } from "./engine";
import { Overlays } from "./overlays";
import { PoseController } from "./pose";
import type { UiSnap } from "./types";
import { VERSES } from "./verses";
import { isKiosk, setupKiosk } from "./kiosk";

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
  monthRank: 0,
  naming: false,
  savedName: null,
  scores: [],
  muted: false,
  sound: "none",
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
  handsUpProgress: 0,
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
  // 내 모습은 실제 카메라 영상으로 보여 준다. 얼굴을 숨겨야 하는 행사는 주소 끝에 ?camera=0
  const [showVideo, setShowVideo] = useState(true);
  useEffect(() => {
    setShowVideo(new URLSearchParams(window.location.search).get("camera") !== "0");
  }, []);

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
      // 화면 UI는 rem 단위라 글자 크기 하나로 통째로 커진다.
      // 휴대폰(약 430px 폭)을 기준으로, 1080px 세로 키오스크에서는 약 2.5배.
      const ui = Math.max(0.85, Math.min(3, r.width / 430));
      document.documentElement.style.fontSize = `${(16 * ui).toFixed(2)}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let lastPhase = game.phase;
    let throwFlashUntil = 0;
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
          if (frame.throwEvent) throwFlashUntil = now + 450;
          const flash = Math.max(0, (throwFlashUntil - now) / 450);
          if (pctx) drawPip(pctx, video, frame.skeleton, frame.present, frame.armed, flash);
        }
      }
      if (game.phase !== lastPhase) {
        // 시작 동작(양손 번쩍) 직후 팔을 내리는 것이 던지기로 읽히지 않게, 카운트다운에서 초기화한다
        if (game.phase === "countdown" || game.phase === "attract") pose.resetMotion();
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
    // 어디든 처음 누르거나 키를 치면 막힌 소리를 푼다(무인 자동 시작 대비)
    const wake = () => {
      audio.unlock();
      window.setTimeout(() => game.nudgeUi(), 150);
    };
    window.addEventListener("pointerdown", wake, { capture: true });
    window.addEventListener("keydown", wake, { capture: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointerdown", wake, { capture: true });
      window.removeEventListener("keydown", wake, { capture: true });
      document.documentElement.style.fontSize = "";
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

  // 키오스크: 켜지자마자 대기 화면, 카메라가 빠지거나 실패하면 5초마다 다시 시도
  const startRef = useRef(startCamera);
  const retryRef = useRef(retryMotion);
  startRef.current = startCamera;
  retryRef.current = retryMotion;
  useEffect(() => {
    if (!isKiosk()) return;
    const cleanup = setupKiosk();
    const g = gameRef.current;
    if (g && g.phase === "boot") {
      g.begin();
      void startRef.current();
    }
    const id = window.setInterval(() => {
      const game = gameRef.current;
      if (!game || startingRef.current) return;
      if (game.cameraState === "off" || game.cameraState === "denied") void startRef.current();
      else if (game.cameraState === "live" && game.modelState === "failed") void retryRef.current();
    }, 5000);
    return () => {
      cleanup();
      window.clearInterval(id);
    };
  }, []);

  const openNewWindow = () => {
    window.open(window.location.href, "_blank", "noopener,noreferrer");
  };

  const pipLow = ui.phase === "play" || ui.phase === "practice" || ui.phase === "countdown";
  const pipLabel =
    ui.modelState === "failed"
      ? "모션 실패"
      : ui.modelState === "loading" || ui.cameraState === "loading"
        ? "준비 중"
        : !ui.personPresent
          ? "어디 있나요?"
          : ui.armed && pipLow
            ? "던질 준비!"
            : "인식됨";
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
          className={`pointer-events-none absolute z-10 transition-opacity ${pipLow ? "bottom-24 left-3" : "top-[35%] left-3"} ${showPip ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className="relative h-48 w-36 overflow-hidden rounded-2xl border-[0.3125rem] border-ink bg-ink shadow-[0_0.3125rem_0_var(--color-ink)]"
          >
            <video
              ref={videoRef}
              className="absolute inset-0 size-full object-cover"
              style={{ transform: "scaleX(-1)", opacity: showVideo ? 1 : 0 }}
              playsInline
              muted
              autoPlay
            />
            <canvas ref={pipRef} width={360} height={480} className="absolute inset-0 size-full" />
          </div>
          <p
            className={`relative mx-auto -mt-3 w-fit rounded-full border-[0.1875rem] border-ink px-2.5 py-0.5 text-center font-display text-xs whitespace-nowrap ${ui.armed && pipLow ? "bg-don text-cream" : ui.personPresent ? "bg-sun text-ink" : "bg-cream text-ink"}`}
          >
            {pipLabel}
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
          onSaveName={(name) => gameRef.current?.saveName(name)}
          onSkipName={() => gameRef.current?.skipName()}
          onRemoveRecord={(at) => gameRef.current?.removeRecord(at)}
          onTestSound={() => gameRef.current?.testSound()}
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
