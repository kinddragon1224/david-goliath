import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import "@fontsource/gowun-batang/700.css";
import { PoseController, type PoseFrame } from "@/game/pose";
import {
  isKiosk,
  isTv,
  listCameras,
  preferredCameraId,
  setPreferredCamera,
  setupKiosk,
} from "@/game/kiosk";
import {
  drawBackdrop,
  drawStar,
  FashionGame,
  GRADE_LINES,
  GRADE_NAMES,
  STAGE_W,
  type FashionUi,
  type Item,
  type Mode,
  type QueueItem,
} from "./core";
import { BRANDS, fitGarment, garmentByName, type Body, type Garment, type Pt } from "./garments";
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

/** 체험별 세 단계 안내(그림 + 한 줄). */
const STEPS: Record<FashionStation, { icon: StepIcon; text: string }[]> = {
  iron: [
    { icon: "arms", text: "양손 번쩍! 1초면 시작" },
    { icon: "iron", text: "두 손으로 쓱쓱! 점수 2배" },
    { icon: "rack", text: "주름을 다 펴면 다음 옷" },
  ],
  scissors: [
    { icon: "arms", text: "양손 번쩍! 1초면 시작" },
    { icon: "scissors", text: "빛나는 점 두 곳에 두 손을" },
    { icon: "path", text: "양쪽으로 오려 가운데서 만나요" },
  ],
  sewing: [
    { icon: "arms", text: "양손 번쩍! 1초면 시작" },
    { icon: "needle", text: "번호 구멍을 차례로 콕" },
    { icon: "combo", text: "빨리 이으면 황금실 피버" },
  ],
  rhythm: [
    { icon: "arms", text: "양손 번쩍! 1초면 시작" },
    { icon: "ring", text: "3·2·1 '지금!'에 손을 대요" },
    { icon: "music", text: "금빛 고리는 두 손 만세" },
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
  noHands: false,
  demo: false,
  camera: "off",
  model: "off",
  hint: "",
  tip: "",
  queue: [],
  meter: null,
  stats: [],
  collection: [],
  grade: 3,
  rank: 0,
  lastAt: 0,
  todayTop: [],
  todayCount: 0,
  muted: false,
  soundBlocked: false,
  resultLeft: 0,
  homeProgress: 0,
  finale: null,
};

type Rect = { x: number; y: number; w: number; h: number };
type Layout = { landscape: boolean; mirror: Rect; side: Rect; hud: Rect; stage: Rect };

/** 화면 나누기. 가로: 왼쪽 거울 열 + 오른쪽 무대. 세로(TV를 세웠을 때): 위 거울 줄 + 아래 무대. */
function computeLayout(W: number, H: number): Layout {
  const landscape = W / Math.max(1, H) >= 1.15;
  if (landscape) {
    const pad = H * 0.025;
    const colW = Math.min(W * 0.24, H * 0.44);
    const mirror = { x: pad, y: pad, w: colW, h: Math.min(colW * (4 / 3), H * 0.6) };
    const side = { x: pad, y: mirror.y + mirror.h + pad * 0.7, w: colW, h: 0 };
    side.h = H - side.y - pad;
    const hud = { x: pad * 2 + colW, y: pad, w: 0, h: H * 0.1 };
    hud.w = W - hud.x - pad;
    const stage = { x: hud.x, y: hud.y + hud.h + pad * 0.6, w: hud.w, h: 0 };
    stage.h = H - stage.y - pad;
    return { landscape, mirror, side, hud, stage };
  }
  const pad = W * 0.03;
  const mh = H * 0.21;
  const mirror = { x: pad, y: pad, w: mh * 0.75, h: mh };
  const side = { x: mirror.x + mirror.w + pad, y: pad, w: 0, h: mh };
  side.w = W - side.x - pad;
  const hud = { x: pad, y: pad + mh + pad * 0.6, w: W - pad * 2, h: H * 0.075 };
  const stage = { x: pad, y: hud.y + hud.h + pad * 0.5, w: W - pad * 2, h: 0 };
  stage.h = H - stage.y - pad;
  return { landscape, mirror, side, hud, stage };
}

const box = (r: Rect) => ({ left: r.x, top: r.y, width: r.w, height: r.h });

export function FashionApp({ station }: { station: FashionStation }) {
  const info = stationInfo(station);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mirrorRef = useRef<HTMLCanvasElement>(null);
  const finaleRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FashionGame | null>(null);
  const poseRef = useRef<PoseController | null>(null);
  const startingRef = useRef(false);
  const [ui, setUi] = useState<FashionUi>(initialUi);
  const [admin, setAdmin] = useState(false);
  const [layout, setLayout] = useState<Layout>(() => computeLayout(1920, 1080));
  const layoutRef = useRef(layout);

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

    let dpr = 1;
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      dpr = Math.min(isTv() ? 1 : 2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      const L = computeLayout(w, h);
      layoutRef.current = L;
      (window as unknown as { __stage: Rect }).__stage = L.stage;
      setLayout(L);
      game.resize(STAGE_W, Math.round((STAGE_W * L.stage.h) / Math.max(1, L.stage.w)));
      const m = mirrorRef.current;
      if (m) {
        m.width = Math.max(1, Math.floor(L.mirror.w * dpr));
        m.height = Math.max(1, Math.floor(L.mirror.h * dpr));
      }
      const k = Math.max(
        0.7,
        Math.min(3, L.landscape ? Math.min(w / 1600, h / 900) : Math.min(w / 900, h / 1600)),
      );
      document.documentElement.style.fontSize = `${(16 * k).toFixed(2)}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    const mirrorState: MirrorState = { cx: 0.5, body: null };
    const finaleState: MirrorState = { cx: 0.5, body: null };
    let raf = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      if (pose.takeDisconnect()) game.setReadiness("off", "off");
      let frame: PoseFrame | null = null;
      if (video && pose.status === "live") {
        frame = pose.tick(now);
        if (pose.poseReady) game.notePose(frame, now);
      }
      game.update(now);
      const L = layoutRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackdrop(ctx, window.innerWidth, window.innerHeight, now / 1000);
      const s = (L.stage.w / STAGE_W) * dpr;
      ctx.setTransform(s, 0, 0, s, L.stage.x * dpr, L.stage.y * dpr);
      game.render(ctx);
      const m = mirrorRef.current?.getContext("2d");
      if (m) drawMirror(m, video, pose.status === "live" ? frame : null, mirrorState, now / 1000);
      // 피날레: 큰 사진 틀에 옷을 입혀 그린다. 찰칵 뒤에는 그리지 않아 그 순간이 멈춰 보인다.
      const fc = finaleRef.current;
      if (fc && game.phase === "finale" && !game.finaleShot) {
        const fw = Math.max(1, Math.round(fc.clientWidth * dpr));
        const fh = Math.max(1, Math.round(fc.clientHeight * dpr));
        if (fc.width !== fw || fc.height !== fh) {
          fc.width = fw;
          fc.height = fh;
        }
        const f = fc.getContext("2d");
        if (f) {
          drawMirror(
            f,
            video,
            pose.status === "live" ? frame : null,
            finaleState,
            now / 1000,
            game.outfit,
          );
        }
      } else if (game.phase !== "finale") finaleState.body = null;
    };
    raf = requestAnimationFrame(loop);

    const toStage = (e: PointerEvent) => {
      const L = layoutRef.current;
      const k = STAGE_W / Math.max(1, L.stage.w);
      return { x: (e.clientX - L.stage.x) * k, y: (e.clientY - L.stage.y) * k };
    };
    let down = false;
    const onDown = (e: PointerEvent) => {
      down = true;
      const p = toStage(e);
      game.pointerMove(p.x, p.y, performance.now());
    };
    const onMove = (e: PointerEvent) => {
      if (!down && e.pointerType !== "mouse") return;
      const p = toStage(e);
      game.pointerMove(p.x, p.y, performance.now());
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

  // 켜지면 바로 대기 화면 + 카메라. 5초마다 카메라·인식을 다시 살핀다.
  useEffect(() => {
    gameRef.current?.begin();
    void startRef.current();
    const cleanup = isKiosk() ? setupKiosk() : () => {};
    const id = window.setInterval(() => {
      const pose = poseRef.current;
      if (!pose || startingRef.current) return;
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
  const ready = ui.camera === "live" && ui.model === "ready";
  const status =
    ui.camera === "denied"
      ? { text: "카메라 없음 · 화면을 눌러요", tone: "warn" }
      : ui.camera !== "live"
        ? { text: "카메라 준비 중", tone: "idle" }
        : ui.model === "failed"
          ? { text: "동작 인식 다시 시도 중", tone: "warn" }
          : ui.model !== "ready"
            ? { text: "동작 인식 준비 중", tone: "idle" }
            : ui.present
              ? { text: "인식됐어요!", tone: "ok" }
              : { text: "거울 앞에 서 주세요", tone: "idle" };

  return (
    <div className="f-root fixed inset-0 overflow-hidden select-none">
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" />
      {/* 영상은 거울 캔버스로 옮겨 그린다. 숨겨도 재생은 계속되게 아주 작게 둔다. */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute top-0 left-0 size-px opacity-0"
        playsInline
        muted
        autoPlay
      />

      {/* 피팅룸 거울 */}
      <div className="pointer-events-none absolute z-10" style={box(layout.mirror)}>
        <div className={`f-mirror size-full ${ui.present && ready ? "f-mirror-on" : ""}`}>
          <canvas ref={mirrorRef} className="size-full" />
        </div>
        <span
          className={`absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-sm font-bold whitespace-nowrap ${
            status.tone === "ok"
              ? "bg-[var(--f-mint)] text-[#1b1526]"
              : status.tone === "warn"
                ? "bg-[var(--f-pink)] text-[#1b1526]"
                : "bg-black/60 text-[var(--f-ink)]"
          }`}
        >
          {status.text}
        </span>
        {ui.phase === "attract" && ready && (
          <div className="absolute inset-x-0 top-[38%] flex flex-col items-center">
            <HandsUpRing value={ui.handsUp} />
          </div>
        )}
      </div>

      {/* 거울 아래 패널 */}
      <div className="absolute z-10 overflow-hidden" style={box(layout.side)}>
        {ui.phase === "play" || ui.phase === "countdown" ? (
          <MeterCard ui={ui} landscape={layout.landscape} step={STEPS[station][1]} />
        ) : ui.phase === "result" || ui.phase === "finale" ? (
          <Ranking ui={ui} highlight={ui.lastAt} compact={!layout.landscape} />
        ) : (
          <AttractSide station={station} ui={ui} compact={!layout.landscape} />
        )}
      </div>

      {/* 위쪽: 체험 이름 · 진행 줄 · 점수 · 시간 */}
      <div className="absolute z-10 flex items-center gap-4" style={box(layout.hud)}>
        <TitleBadge no={info.no} title={info.title} onLong={() => setAdmin(true)} />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">
          {ui.queue.map((q, i) => (
            <QueueChip key={`${q.label}-${i}`} q={q} />
          ))}
        </div>
        {ui.phase === "play" ||
        ui.phase === "countdown" ||
        ui.phase === "finale" ||
        ui.phase === "result" ? (
          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-[var(--f-muted)]">점수</p>
              <p className="f-serif f-pearl text-4xl leading-none tabular-nums">
                {ui.score.toLocaleString("ko-KR")}
              </p>
            </div>
            <TimerRing
              pct={ui.seconds > 0 ? ui.timeLeft / ui.seconds : 0}
              left={Math.ceil(ui.timeLeft)}
            />
          </div>
        ) : (
          <p className="shrink-0 text-sm text-[var(--f-muted)]">오늘 {ui.todayCount}명 참여</p>
        )}
      </div>

      {/* 무대 위 안내 */}
      <div className="pointer-events-none absolute z-20" style={box(layout.stage)}>
        {ui.phase === "attract" && (
          <AttractOverlay
            station={station}
            ui={ui}
            ready={ready}
            onStart={() => g()?.pressStart()}
          />
        )}
        {ui.phase === "countdown" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] bg-black/45">
            <p key={ui.countdown} className="f-serif f-pearl animate-pop text-[9rem] leading-none">
              {ui.countdown}
            </p>
            <p className="f-serif mt-4 px-6 text-center text-3xl">{ui.tip}</p>
          </div>
        )}
        {ui.phase === "play" && (
          <>
            <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
              <p className="f-card f-serif max-w-full truncate px-7 py-2.5 text-center text-xl">
                {ui.hint}
              </p>
            </div>
            {ui.noHands && (
              <div className="absolute inset-x-0 top-[40%] flex justify-center px-4">
                <p className="f-serif animate-pop rounded-3xl bg-[var(--f-pink)] px-8 py-4 text-center text-2xl text-[#1b1526] shadow-2xl">
                  손이 안 보여요! 거울에 상반신이 다 나오게 서서 팔을 펴 주세요
                </p>
              </div>
            )}
          </>
        )}
        {(ui.phase === "play" || ui.phase === "countdown") && (
          <button
            type="button"
            onClick={() => g()?.goHome()}
            className="f-ghost pointer-events-auto absolute top-3 left-3 z-10 bg-black/50 px-4 py-2 text-base"
          >
            처음으로
          </button>
        )}
        {ui.homeProgress > 0 && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-[2rem] bg-black/55">
            <div className="relative size-36">
              <svg viewBox="0 0 100 100" className="size-full -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="rgba(13,11,20,0.7)"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="7"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#ffe08a"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={276.5}
                  strokeDashoffset={276.5 * (1 - ui.homeProgress)}
                />
              </svg>
              <StepGlyph
                icon="arms"
                className="absolute inset-0 m-auto size-16 text-[var(--f-gold)]"
              />
            </div>
            <p className="f-serif mt-4 text-4xl">처음 화면으로 돌아가요</p>
            <p className="mt-1 text-lg text-[var(--f-muted)]">계속하려면 손을 내리세요</p>
          </div>
        )}
        <FinaleOverlay ui={ui} canvasRef={finaleRef} />
        {ui.phase === "result" && (
          <ResultOverlay
            ui={ui}
            onAgain={() => g()?.pressStart()}
            onHome={() => g()?.goAttract()}
          />
        )}
      </div>

      {ui.soundBlocked && (
        <p className="f-ghost pointer-events-none absolute right-4 bottom-4 z-30 px-4 py-2 text-sm">
          화면을 한 번 눌러 소리를 켜 주세요
        </p>
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

/* ───────── 거울 ───────── */

type MirrorState = { cx: number; body: Body | null };

/** 카메라 영상을 거울처럼(좌우 반전) 세로로 잘라 사람을 따라가며 그린다. 손에는 빛 고리.
 * outfit을 주면 손 고리 대신 그 옷을 몸에 입혀 그린다(피팅 피날레). */
function drawMirror(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  frame: PoseFrame | null,
  st: MirrorState,
  t: number,
  outfit?: Garment[],
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  const vw = video?.videoWidth ?? 0;
  const vh = video?.videoHeight ?? 0;
  if (!video || vw < 2 || vh < 2 || video.readyState < 2) {
    // 카메라 없음: 실루엣 자리표시
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.36, w * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.78, w * 0.3, h * 0.28, 0, Math.PI, 0);
    ctx.fill();
    return;
  }
  const a = w / h;
  let cw = vh * a;
  let ch = vh;
  if (cw > vw) {
    cw = vw;
    ch = vw / a;
  }
  // 사람 가운데로 천천히 따라간다(거울 좌표)
  const target = frame?.bodyX ?? st.cx;
  st.cx += (target - st.cx) * 0.08;
  const msx = Math.max(0, Math.min(vw - cw, st.cx * vw - cw / 2));
  const sy = (vh - ch) / 2;
  const sx = vw - (msx + cw);
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, cw, ch, 0, 0, w, h);
  ctx.restore();
  // 진주빛 막
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "rgba(255,214,234,0.12)");
  g.addColorStop(1, "rgba(196,244,234,0.12)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const sk = frame?.skeleton;
  if (!sk || !frame?.present) return;
  const P = (p: { x: number; y: number }) => ({
    x: ((p.x * vw - msx) / cw) * w,
    y: ((p.y * vh - sy) / ch) * h,
  });
  if (outfit) {
    const ls = sk[1];
    const rs = sk[2];
    if (!ls || !rs || ls.v < 0.3 || rs.v < 0.3) return;
    const A = P(ls);
    const B = P(rs);
    const pt = (p: { x: number; y: number }): Pt => [p.x, p.y];
    // 골반이 화면 밖이면 어깨 폭으로 어림한다(카메라에 가까이 선 아이)
    const span = Math.hypot(B.x - A.x, B.y - A.y);
    const hip = (s: { x: number; y: number }, raw: (typeof sk)[number]): Pt =>
      raw && raw.v >= 0.3
        ? pt(P(raw))
        : [s.x + (B.x - A.x) * 0.1 * (s === A ? 1 : -1), s.y + span * 1.5];
    const next: Body = { ls: pt(A), rs: pt(B), lh: hip(A, sk[7]), rh: hip(B, sk[8]) };
    // 떨림을 줄이려고 조금씩 따라간다
    const prev = st.body;
    const lerp = (p: Pt, q: Pt): Pt => [p[0] + (q[0] - p[0]) * 0.35, p[1] + (q[1] - p[1]) * 0.35];
    st.body = prev
      ? {
          ls: lerp(prev.ls, next.ls),
          rs: lerp(prev.rs, next.rs),
          lh: lerp(prev.lh, next.lh),
          rh: lerp(prev.rh, next.rh),
        }
      : next;
    for (const g of outfit) drawWorn(ctx, g, st.body, t);
    return;
  }
  // 팔 선
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(3, w * 0.012);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  for (const [a1, b1, c1] of [
    [1, 3, 5],
    [2, 4, 6],
  ]) {
    const pa = sk[a1];
    const pb = sk[b1];
    const pc = sk[c1];
    if (!pa || !pb || !pc || pa.v < 0.3 || pb.v < 0.3 || pc.v < 0.3) continue;
    const A = P(pa);
    const B = P(pb);
    const C = P(pc);
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.stroke();
  }
  // 손 고리: 화면 왼쪽 손 분홍, 오른쪽 민트
  const hands = [sk[5], sk[6]].filter((p) => p && p.v > 0.3).sort((p, q) => p.x - q.x);
  hands.forEach((p, i) => {
    const q = P(p);
    const r = w * (0.06 + Math.sin(t * 6) * 0.006);
    ctx.lineWidth = Math.max(4, w * 0.018);
    ctx.strokeStyle = i === 0 && hands.length === 2 ? "#ffb8dc" : "#a8f0e0";
    ctx.beginPath();
    ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** 몸에 입힌 옷 한 벌: 원단 그라디언트 + 지나가는 광택 + 테두리 반짝이. */
function drawWorn(ctx: CanvasRenderingContext2D, g: Garment, body: Body, t: number): void {
  const f = fitGarment(g, body);
  ctx.save();
  ctx.translate(f.cx, f.y);
  ctx.rotate(f.angle);
  const path = new Path2D();
  g.pts.forEach(([x, y], i) => {
    const px = (x - 0.5) * f.w;
    const py = y * f.h;
    if (i) path.lineTo(px, py);
    else path.moveTo(px, py);
  });
  path.closePath();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = f.w * 0.06;
  const fill = ctx.createLinearGradient(-f.w / 2, 0, f.w / 2, f.h);
  fill.addColorStop(0, g.color);
  fill.addColorStop(1, g.shade);
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = fill;
  ctx.fill(path);
  ctx.shadowBlur = 0;
  // 비단 광택이 사선으로 지나간다
  ctx.save();
  ctx.clip(path);
  const k = ((t * 0.45) % 1.6) - 0.3;
  const sx = -f.w / 2 + k * f.w * 1.4;
  const shine = ctx.createLinearGradient(sx - f.w * 0.2, 0, sx + f.w * 0.2, f.h * 0.4);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.45)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(-f.w / 2, 0, f.w, f.h);
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, f.w * 0.015);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke(path);
  // 테두리를 따라 반짝이
  ctx.fillStyle = "#fff4d6";
  g.pts.forEach(([x, y], i) => {
    const tw = (Math.sin(t * 5 + i * 1.7) + 1) / 2;
    if (tw < 0.6) return;
    drawStar(ctx, (x - 0.5) * f.w, y * f.h, f.w * 0.03 * tw);
  });
  ctx.restore();
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
      className="flex shrink-0 items-baseline gap-2.5 rounded-full px-1 text-left text-[var(--f-ink)]"
      aria-label={`${title} (길게 누르면 운영자 화면)`}
    >
      <span className="f-serif f-pearl text-4xl">{no}</span>
      <span className="f-serif text-3xl whitespace-nowrap">{title}</span>
    </button>
  );
}

/** 옷본 실루엣(단위 좌표 → SVG). */
function GarmentIcon({
  shape,
  aspect = 1,
  color,
  className,
}: {
  shape: Pt[];
  aspect?: number;
  color: string;
  className?: string;
}) {
  const pts = shape
    .map(([x, y]) => `${(x * aspect * 100).toFixed(1)},${(y * 100).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`-6 -6 ${aspect * 100 + 12} 112`} className={className} aria-hidden="true">
      <polygon
        points={pts}
        fill={color}
        stroke="rgba(27,21,38,0.6)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QueueChip({ q }: { q: QueueItem }) {
  const now = q.state === "now";
  return (
    <div
      className={`relative flex shrink-0 items-center gap-2 rounded-2xl border px-2.5 py-1.5 transition-all ${
        now
          ? "border-[var(--f-gold)] bg-white/12 shadow-[0_0_1.2rem_rgba(255,224,138,0.35)]"
          : q.state === "done"
            ? "border-[var(--f-mint)]/60 bg-white/5"
            : "border-white/15 bg-white/[0.03] opacity-60"
      }`}
    >
      {q.shape ? (
        <GarmentIcon
          shape={q.shape}
          aspect={q.aspect}
          color={q.state === "next" ? "rgba(255,255,255,0.35)" : (q.color ?? "#fff")}
          className="h-9 w-9"
        />
      ) : null}
      <div className="leading-tight">
        <p
          className={`text-sm font-bold whitespace-nowrap ${now ? "text-[var(--f-ink)]" : "text-[var(--f-muted)]"}`}
        >
          {q.label}
        </p>
        {now && q.pct !== undefined && (
          <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-[var(--f-gold)] transition-[width]"
              style={{ width: `${q.pct}%` }}
            />
          </div>
        )}
        {q.state === "done" && (
          <p className="text-xs font-bold text-[var(--f-mint)]">
            완성{q.pct !== undefined ? ` ${q.pct}%` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function TimerRing({ pct, left }: { pct: number; left: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const urgent = left <= 5;
  return (
    <div className={`relative size-[4.4rem] ${urgent ? "animate-throb" : ""}`}>
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="rgba(18,14,28,0.85)"
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

function HandsUpRing({ value }: { value: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative size-[5.5rem]">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="rgba(13,11,20,0.6)"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="7"
          />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="#ffe08a"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - value)}
          />
        </svg>
        <StepGlyph icon="arms" className="absolute inset-0 m-auto size-12 text-[var(--f-gold)]" />
      </div>
      <p className="f-serif rounded-full bg-black/60 px-3 py-0.5 text-base whitespace-nowrap">
        양손 번쩍!
      </p>
    </div>
  );
}

function MeterCard({
  ui,
  landscape,
  step,
}: {
  ui: FashionUi;
  landscape: boolean;
  step: { icon: StepIcon; text: string };
}) {
  const m = ui.meter;
  const best = ui.todayTop[0]?.s ?? 0;
  return (
    <div className={`f-card flex h-full flex-col gap-3 ${landscape ? "p-5" : "p-3"}`}>
      {landscape && (
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5">
          <StepGlyph icon={step.icon} className="size-11 shrink-0 text-[var(--f-gold)]" />
          <p className="f-serif text-xl leading-snug">{step.text}</p>
        </div>
      )}
      {m && (
        <div>
          <div className="flex items-baseline justify-between">
            <p className={`f-serif text-2xl ${m.hot ? "f-pearl" : ""}`}>{m.label}</p>
          </div>
          <div
            className={`mt-2 h-4 overflow-hidden rounded-full bg-white/10 ${m.hot ? "shadow-[0_0_1rem_rgba(255,224,138,0.6)]" : ""}`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-150 ${m.hot ? "animate-pulse bg-[var(--f-gold)]" : "bg-gradient-to-r from-[var(--f-pink)] via-[var(--f-lilac)] to-[var(--f-mint)]"}`}
              style={{ width: `${Math.round(Math.max(0, Math.min(1, m.value)) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-sm text-[var(--f-muted)]">{m.text}</p>
        </div>
      )}
      {best > 0 && (
        <div className="rounded-2xl border border-white/15 px-4 py-2">
          <p className="text-xs text-[var(--f-muted)]">오늘 1등 점수</p>
          <p className="f-serif text-2xl tabular-nums">
            {best.toLocaleString("ko-KR")}
            {ui.score > best && (
              <span className="ml-2 text-base text-[var(--f-gold)]">넘었어요!</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Ranking({
  ui,
  highlight,
  compact,
}: {
  ui: FashionUi;
  highlight: number;
  compact: boolean;
}) {
  return (
    <div className={`f-card h-full ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-baseline justify-between">
        <h2 className="f-serif text-2xl">오늘의 디자이너</h2>
        <span className="text-sm text-[var(--f-muted)]">{ui.todayCount}명</span>
      </div>
      <ol className="mt-3 space-y-1.5">
        {ui.todayTop.length === 0 && (
          <li className="f-serif py-3 text-center text-lg text-[var(--f-muted)]">
            첫 번째 주인공이 되어 보세요
          </li>
        )}
        {ui.todayTop.slice(0, compact ? 3 : 5).map((r, i) => (
          <li
            key={r.at}
            className={`flex items-center gap-3 rounded-xl px-2 py-1 ${r.at === highlight ? "bg-[var(--f-gold)]/20 ring-1 ring-[var(--f-gold)]" : ""}`}
          >
            <span
              className={`f-serif flex size-8 shrink-0 items-center justify-center rounded-full text-lg ${i === 0 ? "bg-[var(--f-gold)] text-[#1b1526]" : "border border-white/40"}`}
            >
              {i + 1}
            </span>
            <span className="flex-1 text-sm text-[var(--f-muted)]">
              {r.at === highlight
                ? "방금 나!"
                : new Date(r.at).toLocaleTimeString("ko-KR", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
            </span>
            <span className="f-serif text-2xl tabular-nums">{r.s.toLocaleString("ko-KR")}</span>
          </li>
        ))}
      </ol>
      {highlight > 0 && ui.rank > 5 && (
        <p className="mt-2 text-center text-sm text-[var(--f-gold)]">
          방금 기록은 오늘 {ui.rank}위
        </p>
      )}
    </div>
  );
}

/** 대기 화면 거울 아래: 세 단계 안내 + 오늘 1~3등. */
function AttractSide({
  station,
  ui,
  compact,
}: {
  station: FashionStation;
  ui: FashionUi;
  compact: boolean;
}) {
  return (
    <div className={`f-card flex h-full flex-col ${compact ? "gap-2 p-3" : "gap-4 p-5"}`}>
      <p className="f-serif text-2xl">이렇게 해요</p>
      <ol className={compact ? "space-y-1.5" : "space-y-3"}>
        {STEPS[station].map((s, i) => (
          <li key={s.text} className="flex items-center gap-3">
            <span className="relative shrink-0">
              <StepGlyph
                icon={s.icon}
                className={`${compact ? "size-9" : "size-11"} text-[var(--f-ink)]`}
              />
              <span className="f-serif absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--f-gold)] text-xs text-[#1b1526]">
                {i + 1}
              </span>
            </span>
            <span className="f-serif text-lg leading-snug">{s.text}</span>
          </li>
        ))}
      </ol>
      {!compact && (
        <div className="mt-auto border-t border-white/15 pt-3">
          <div className="flex items-baseline justify-between">
            <p className="f-serif text-lg">오늘의 디자이너</p>
            <span className="text-sm text-[var(--f-muted)]">{ui.todayCount}명</span>
          </div>
          {ui.todayTop.length === 0 && (
            <p className="py-1 text-sm text-[var(--f-muted)]">첫 번째 주인공이 되어 보세요</p>
          )}
          {ui.todayTop.slice(0, 3).map((r, i) => (
            <p key={r.at} className="mt-1 flex items-center gap-2">
              <span
                className={`f-serif flex size-6 items-center justify-center rounded-full text-sm ${i === 0 ? "bg-[var(--f-gold)] text-[#1b1526]" : "border border-white/40"}`}
              >
                {i + 1}
              </span>
              <span className="f-serif ml-auto text-xl tabular-nums">
                {r.s.toLocaleString("ko-KR")}
              </span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function AttractOverlay({
  station,
  ui,
  ready,
  onStart,
}: {
  station: FashionStation;
  ui: FashionUi;
  ready: boolean;
  onStart: () => void;
}) {
  const info = stationInfo(station);
  // 지나가는 사람을 끌어당기는 문구: 3.5초마다 바뀐다
  const top = ui.todayTop[0]?.s;
  const teasers = [
    TEASER[station],
    "완성한 옷을 거울 속 내 몸에 입혀 줘요!",
    "창작자×예술인 콜라보 6팀의 옷을 만들어요",
    ...(top ? [`오늘 최고 ${top.toLocaleString("ko-KR")}점 · 도전!`] : []),
  ];
  const [ti, setTi] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTi((i) => i + 1), 3500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden rounded-[2rem] p-[3%]">
      {/* 무대 조명 빛줄기 + 반짝이 */}
      <div className="pointer-events-none absolute inset-0">
        {[8, 30, 52, 74].map((l, i) => (
          <div
            key={l}
            className="f-beam"
            style={{
              left: `${l}%`,
              animationDelay: `${-i * 1.3}s`,
              animationDuration: `${4 + i}s`,
            }}
          />
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="f-twinkle text-2xl"
            style={{
              left: `${(i * 37) % 96}%`,
              top: `${(i * 53) % 70}%`,
              animationDelay: `${-(i * 0.37) % 1.8}s`,
            }}
          >
            ✦
          </span>
        ))}
      </div>
      <div className="f-card pointer-events-auto relative px-8 py-3 text-center">
        <div className="flex items-center justify-center gap-3">
          <img src="/brand/weaveon-logo.webp" alt="위브온 중촌" className="size-12 rounded-xl" />
          <p className="text-xs tracking-[0.35em] text-[var(--f-muted)]">
            ×{" "}
            <span className="f-serif text-base tracking-[0.2em] text-[var(--f-ink)]">바르지음</span>{" "}
            · AX 패션체험 {info.no}
          </p>
        </div>
        <h1 className="f-serif f-pearl mt-0.5 text-5xl leading-tight">{info.title}</h1>
        <p className="f-serif mt-1 text-xl text-[var(--f-muted)]">{info.line}</p>
      </div>
      <div key={ti} className="f-card animate-pop relative px-8 py-3">
        <p className="f-serif f-pearl text-center text-5xl leading-tight">
          {teasers[ti % teasers.length]}
        </p>
        {ti % teasers.length === 2 && (
          // 6팀 룩북 사진을 부채처럼
          <div className="mt-3 flex justify-center gap-2">
            {BRANDS.map((g, i) => (
              <figure key={g.name} className="w-[6.5rem]" style={{ rotate: `${(i - 2.5) * 3}deg` }}>
                <img
                  src={`/brand/${g.photo}.webp`}
                  alt=""
                  className="aspect-[3/4] w-full rounded-xl border-[0.2rem] border-[var(--f-frame)] object-cover shadow-lg"
                />
                <figcaption className="mt-1 text-center text-xs whitespace-nowrap text-[var(--f-muted)]">
                  {g.brand}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
      <div className="relative w-full max-w-[56rem]">
        <div className="flex items-center gap-4">
          <HandsUpFigure />
          <p className="f-serif f-cta flex-1 rounded-full border-[0.2rem] border-[var(--f-frame)] bg-[#241638]/90 px-5 py-2.5 text-center text-2xl">
            {!ready
              ? "카메라를 준비하고 있어요"
              : ui.present
                ? ui.handsUp > 0
                  ? "좋아요, 그대로 1초!"
                  : "양손을 머리 위로 번쩍 들면 시작!"
                : "거울 앞 발자국에 서 주세요"}
          </p>
          <button
            type="button"
            onClick={onStart}
            className="f-btn pointer-events-auto h-14 shrink-0 px-10 text-2xl"
          >
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

const TEASER: Record<FashionStation, string> = {
  iron: "두 손으로 다리면 점수 2배!",
  scissors: "두 손으로 양쪽에서 오리면 2배 빨라요!",
  sewing: "빨리 이어 꿰매면 황금실 피버!",
  rhythm: "음악에 맞춰 브랜드 런칭 쇼 주인공!",
};

/** 대기 화면: 양손을 번쩍 들었다 내리는 사람(따라 하면 시작). */
function HandsUpFigure() {
  const arm = "#fff1b8";
  return (
    <svg viewBox="0 0 60 80" className="h-24 w-18 shrink-0" aria-hidden="true">
      <circle cx="30" cy="14" r="9" fill={arm} />
      <rect x="22" y="25" width="16" height="30" rx="7" fill={arm} />
      <rect x="23" y="54" width="6" height="22" rx="3" fill={arm} />
      <rect x="31" y="54" width="6" height="22" rx="3" fill={arm} />
      {/* 어깨를 축으로 팔이 위로 올라간다 */}
      <rect
        className="f-arm"
        style={{ transformOrigin: "50% 0%", ["--up" as string]: "165deg" }}
        x="16"
        y="27"
        width="6"
        height="20"
        rx="3"
        fill={arm}
      />
      <rect
        className="f-arm"
        style={{ transformOrigin: "50% 0%", ["--up" as string]: "-165deg" }}
        x="38"
        y="27"
        width="6"
        height="20"
        rx="3"
        fill={arm}
      />
    </svg>
  );
}

/** 피팅 피날레: 사진 틀 속 내 모습에 완성한 옷 → 3·2·1 → 찰칵. 사진은 화면에만, 저장하지 않는다. */
function FinaleOverlay({
  ui,
  canvasRef,
}: {
  ui: FashionUi;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}) {
  const f = ui.finale;
  // 캔버스는 늘 붙여 두고 숨긴다(그리기 고리가 ref를 계속 잡도록)
  return (
    <div
      className={`absolute inset-0 flex items-center justify-center gap-[3%] overflow-hidden rounded-[2rem] p-[2.5%] ${f ? "" : "invisible"}`}
      style={{
        background:
          "radial-gradient(ellipse 45% 70% at 50% 45%, rgba(255,236,170,0.3), transparent 70%), linear-gradient(rgba(12,10,20,0.72), rgba(12,10,20,0.82)), url(/art/rhythm.webp) center/cover, #0c0a14",
      }}
    >
      <div className="flex w-[24%] flex-col items-end gap-3 text-right">
        <p className="text-sm tracking-[0.35em] text-[var(--f-muted)]">FITTING FINALE</p>
        <p className="f-serif f-pearl text-5xl leading-tight">
          {f?.shot ? `${GRADE_NAMES[ui.grade]} 탄생!` : "런웨이 데뷔!"}
        </p>
        <p className="f-serif text-xl text-[var(--f-muted)]">
          {f?.shot ? GRADE_LINES[ui.grade] : "내가 만든 옷을 입어 봐요"}
        </p>
        {/* 입혀 준 옷의 진짜 룩북 사진 */}
        {f?.outfit.map((name) => {
          const g = garmentByName(name);
          return g?.photo ? (
            <div key={name} className="mt-2 w-[70%] rounded-2xl bg-[#fffaf0] p-2 pb-1 shadow-lg">
              <img
                src={`/brand/${g.photo}.webp`}
                alt=""
                className="aspect-[3/4] w-full rounded-xl object-cover"
              />
              <p className="f-serif mt-1 text-center text-sm text-[#1b1526]">진짜 옷 · {g.brand}</p>
            </div>
          ) : null;
        })}
      </div>
      <div className="relative h-full">
        <div className="h-full rounded-[1.4rem] bg-[#fffaf0] p-[0.9rem] pb-[3.6rem] shadow-[0_0_4rem_rgba(255,224,138,0.45)]">
          <canvas ref={canvasRef} className="aspect-[3/4] h-full rounded-[0.8rem] bg-[#1b1526]" />
          <p className="f-serif absolute inset-x-0 bottom-3 text-center text-2xl text-[#1b1526]">
            WEAVE ON ·{" "}
            {f?.outfit
              .map((n) => [garmentByName(n)?.brand, n].filter(Boolean).join(" "))
              .join(" + ")}
          </p>
        </div>
        {f && f.count > 0 && (
          <p
            key={f.count}
            className="f-serif f-pearl animate-pop absolute inset-0 flex items-center justify-center text-[11rem] leading-none drop-shadow-[0_0_2rem_rgba(0,0,0,0.8)]"
          >
            {f.count}
          </p>
        )}
        {f?.shot && <div className="animate-flash absolute inset-0 rounded-[1.4rem] bg-white" />}
      </div>
      <div className="flex w-[24%] flex-col gap-3">
        <p className="f-serif rounded-full bg-black/55 px-5 py-2.5 text-center text-xl">
          {f?.shot ? "찰칵! 멋져요" : f && f.count > 0 ? "그대로 멈춰요!" : "멋진 포즈를 잡아요"}
        </p>
        <p className="text-center text-sm text-[var(--f-muted)]">사진은 저장되지 않아요</p>
      </div>
    </div>
  );
}

function ResultOverlay({
  ui,
  onAgain,
  onHome,
}: {
  ui: FashionUi;
  onAgain: () => void;
  onHome: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-[2rem] bg-black/55 p-[3%]">
      <div className="f-card animate-pop pointer-events-auto flex max-h-full w-full max-w-[52rem] flex-col gap-5 overflow-hidden p-7">
        <div className="flex items-center gap-6">
          <GradeBadge grade={ui.grade} />
          <div className="min-w-0 flex-1">
            <p className="text-sm tracking-[0.3em] text-[var(--f-muted)]">오늘의 등급</p>
            <p className="f-serif f-pearl text-5xl leading-tight">{GRADE_NAMES[ui.grade]}</p>
            <p className="f-serif mt-1 text-lg text-[var(--f-muted)]">{GRADE_LINES[ui.grade]}</p>
          </div>
          <div className="text-right">
            <p className="f-serif text-6xl leading-none tabular-nums">
              {ui.score.toLocaleString("ko-KR")}
            </p>
            <p className="mt-2 text-base text-[var(--f-gold)]">
              {ui.rank > 0 ? `오늘 ${ui.todayCount}명 중 ${ui.rank}위` : "다시 도전해 보세요!"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          {ui.stats.map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-center"
            >
              <p className="text-sm text-[var(--f-muted)]">{s.label}</p>
              <p className="f-serif text-3xl">{s.value}</p>
            </div>
          ))}
        </div>
        {ui.collection.length > 0 && (
          <div>
            <p className="f-serif mb-2 text-xl">나의 컬렉션</p>
            <div className="flex flex-wrap gap-3">
              {/* 너무 많으면 최근 6개만, 나머지는 +N */}
              {ui.collection.slice(-6).map((c, i) => (
                <CollectionCard key={`${c.label}-${i}`} item={c} />
              ))}
              {ui.collection.length > 6 && (
                <div className="f-serif flex w-[6.5rem] items-center justify-center rounded-2xl border border-white/20 bg-white/5 text-2xl text-[var(--f-gold)]">
                  +{ui.collection.length - 6}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onAgain} className="f-btn h-14 flex-1 text-2xl" autoFocus>
            다시 하기
          </button>
          <button type="button" onClick={onHome} className="f-ghost h-14 flex-1 text-xl">
            처음으로
          </button>
        </div>
        <p className="-mt-2 text-center text-sm text-[var(--f-muted)]">
          양손을 들면 바로 다시 · {ui.resultLeft}초 뒤 처음 화면
        </p>
      </div>
    </div>
  );
}

function CollectionCard({ item }: { item: Item }) {
  const photo = garmentByName(item.label)?.photo;
  return (
    <div className="flex w-[6.5rem] flex-col items-center rounded-2xl border border-white/20 bg-white/5 px-2 py-2">
      {photo ? (
        // 브랜드 옷이면 룩북 실제 사진
        <img
          src={`/brand/${photo}.webp`}
          alt=""
          className="h-[7.5rem] w-full rounded-xl border-2 border-[var(--f-frame)] object-cover"
        />
      ) : item.shape ? (
        <GarmentIcon
          shape={item.shape}
          aspect={item.aspect}
          color={item.color}
          className="h-14 w-14"
        />
      ) : (
        <span className="f-serif flex h-14 items-center text-2xl text-[var(--f-gold)]">
          {item.note}
        </span>
      )}
      <p className="mt-1 text-center text-xs font-bold whitespace-nowrap">{item.label}</p>
      {item.shape && item.note && (
        <p className="text-center text-[0.65rem] whitespace-nowrap text-[var(--f-gold)]">
          {item.note}
        </p>
      )}
    </div>
  );
}

function GradeBadge({ grade }: { grade: number }) {
  const ring = ["#ffe08a", "#d8ccff", "#c4f4ea", "#ffd6ea"][grade];
  const stars = 3 - Math.min(3, grade);
  return (
    <div
      className="relative flex size-28 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `radial-gradient(circle, ${ring}44, transparent 70%)`,
        boxShadow: `inset 0 0 0 0.25rem ${ring}`,
      }}
    >
      <svg viewBox="0 0 64 64" className="size-14" aria-hidden="true">
        <path
          d="M18 14 L26 10 Q32 16 38 10 L46 14 L54 26 L46 30 L46 54 L18 54 L18 30 L10 26 Z"
          fill={ring}
          stroke="#1b1526"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute -bottom-2 rounded-full bg-[#1b1526] px-2 text-base text-[var(--f-gold)]">
        {"★".repeat(stars) + "☆".repeat(3 - stars)}
      </span>
    </div>
  );
}

type StepIcon =
  "arms" | "iron" | "rack" | "scissors" | "path" | "needle" | "combo" | "ring" | "music";

function StepGlyph({ icon, className }: { icon: StepIcon; className?: string }) {
  const paths: Record<StepIcon, ReactNode> = {
    arms: (
      <>
        <circle cx="24" cy="12" r="5" fill="currentColor" />
        <path
          d="M24 18 L24 32 M24 32 L18 44 M24 32 L30 44 M24 21 L13 8 M24 21 L35 8"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      </>
    ),
    iron: (
      <>
        <path d="M6 34 Q8 20 24 18 L40 18 Q43 26 42 34 Z" fill="currentColor" />
        <path
          d="M18 18 Q18 10 28 10 L36 10"
          stroke="currentColor"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M14 40 Q16 44 14 47 M24 40 Q26 44 24 47 M34 40 Q36 44 34 47"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          opacity="0.6"
        />
      </>
    ),
    rack: (
      <>
        <path
          d="M24 8 Q28 8 28 12 Q28 15 24 17 L8 26 L40 26 L24 17"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
        <path d="M12 26 L12 42 L36 42 L36 26" fill="currentColor" opacity="0.6" />
      </>
    ),
    scissors: (
      <>
        <circle cx="12" cy="36" r="6" stroke="currentColor" strokeWidth="3" fill="none" />
        <circle cx="26" cy="40" r="6" stroke="currentColor" strokeWidth="3" fill="none" />
        <path
          d="M16 31 L40 8 M22 35 L42 14"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </>
    ),
    path: (
      <>
        <path
          d="M8 38 Q8 10 24 10 Q40 10 40 38 Z"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="5 5"
          fill="none"
        />
        <circle cx="8" cy="38" r="4" fill="#ffe08a" />
      </>
    ),
    needle: (
      <>
        <path d="M10 40 L38 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <ellipse
          cx="36"
          cy="12"
          rx="2"
          ry="4"
          transform="rotate(45 36 12)"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="12" cy="20" r="3" fill="#ffe08a" />
        <circle cx="22" cy="40" r="3" fill="#ffe08a" />
      </>
    ),
    combo: (
      <>
        <path
          d="M6 30 Q14 18 20 30 Q26 42 32 30 Q38 18 44 30"
          stroke="#ffe08a"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M24 6 L26 12 L32 12 L27 16 L29 22 L24 18 L19 22 L21 16 L16 12 L22 12 Z"
          fill="currentColor"
        />
      </>
    ),
    ring: (
      <>
        <circle
          cx="24"
          cy="24"
          r="18"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          opacity="0.6"
        />
        <circle cx="24" cy="24" r="10" stroke="currentColor" strokeWidth="3.5" fill="none" />
        <circle cx="24" cy="24" r="4" fill="#ffe08a" />
      </>
    ),
    music: (
      <>
        <path
          d="M18 36 L18 12 L38 8 L38 32"
          stroke="currentColor"
          strokeWidth="3.5"
          fill="none"
          strokeLinejoin="round"
        />
        <circle cx="14" cy="36" r="5" fill="currentColor" />
        <circle cx="34" cy="32" r="5" fill="currentColor" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      {paths[icon]}
    </svg>
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
