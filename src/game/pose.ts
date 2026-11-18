import { EDITION } from "./edition";
import { isTv, preferredCameraId } from "./kiosk";
import { SLOW_PC } from "./perf";
import { reachHands, type ReachHand } from "./reach";
import { isUvcId, openUvc, tvToast, uvcCanvas, uvcDevices } from "./uvc";
import {
  MOTION,
  MotionTracker,
  pickPlayer,
  PLAYER_GAP,
  type Aim,
  type BodyInput,
  type Landmark,
  type PlayZone,
  type ThrowEvent,
} from "./motion";

export type { Aim, Landmark, ThrowEvent };

/* ── 놀이 자리: PC마다 한 번 맞춘다. 같은 PC의 모든 게임이 같이 쓴다(이 PC 브라우저에 저장). ── */
const ZONE_KEY = "weaveon-play-zone";
function loadZone(): PlayZone | null {
  try {
    const z = JSON.parse(localStorage.getItem(ZONE_KEY) ?? "null") as PlayZone | null;
    return z && z.minWidth > 0 && z.halfX > 0 ? z : null;
  } catch {
    return null;
  }
}
let zone: PlayZone | null = typeof window === "undefined" ? null : loadZone();
/** 지금 돌고 있는 인식. 운영자 화면 버튼이 지금 선 사람을 읽는다. */
let active: PoseController | null = null;

export function playZone(): PlayZone | null {
  return zone;
}

/** 지금 자리에 선 사람(어른 권장) 기준으로 맞춘다. 같은 자리의 아이(어른의 0.6배쯤)는 잡히고,
 * 그 두 배쯤 뒤에 선 사람과 옆으로 크게 비켜 선 사람은 안 잡힌다. 맞춘 사람이 없으면 null. */
export function calibratePlayZone(): PlayZone | null {
  const p = active?.lastPick;
  if (!p || performance.now() - p.at > 1000) return null;
  // ponytail: 비율 두 개로만 가른다. 줄이 너무 가까우면(플레이어의 2배 거리 안) 줄 선 사람도 잡힌다 → 줄을 뒤로
  zone = { minWidth: p.width * 0.5, halfX: Math.min(0.5, Math.abs(p.cx - 0.5) + 0.22) };
  try {
    localStorage.setItem(ZONE_KEY, JSON.stringify(zone));
  } catch {
    /* 저장이 막히면 이번 실행에만 */
  }
  return zone;
}

export function clearPlayZone(): void {
  zone = null;
  try {
    localStorage.removeItem(ZONE_KEY);
  } catch {
    /* 무시 */
  }
}

export type PoseFrame = {
  present: boolean;
  handsUp: boolean;
  throwEvent: ThrowEvent | null;
  skeleton: Landmark[] | null;
  /** 던질 손이 머리 위(또는 뒤)로 장전된 상태. */
  armed: boolean;
  chestStill: boolean;
  /** 지금 손 위치가 가리키는 조준. 사람이 없으면 null. */
  aim: Aim | null;
  tooFar: boolean;
  lowInFrame: boolean;
  bodyX: number | null;
  offCenter: boolean;
  /** 몸 기준으로 옮긴 두 손 위치(화면 0~1). [화면 왼쪽 손, 오른쪽 손]. 패션 체험이 쓴다. */
  reach: (ReachHand | null)[];
};

export { REACH, reachHands, type ReachHand } from "./reach";

const EMPTY: PoseFrame = {
  present: false,
  handsUp: false,
  throwEvent: null,
  skeleton: null,
  armed: false,
  chestStill: false,
  aim: null,
  tooFar: false,
  lowInFrame: false,
  bodyX: null,
  offCenter: false,
  reach: [null, null],
};

type RawPoint = { x: number; y: number; z?: number; visibility?: number };

/** 초당 추론 횟수 상한. 빠른 팔 동작을 놓치지 않을 만큼. */
const INFER_MS = 30;
/** 추론용으로 줄인 영상의 긴 변. 멀리 서거나 작은 아이의 손목까지 보이게. */
const INFER_LONG = 640;
/** TV는 칩이 약해 작게 읽는다. 모델 입력이 256이라 이보다 커도 인식은 나아지지 않는다. */
const TV_INFER_LONG = 320;
/* 약한 PC 초저사양 모드: 1명만 찾고(찾을 수보다 적게 보이면 매 프레임 사람 찾기를 다시 돌려 몇 배 느려진다),
 * 320으로 읽고, 카메라도 640×480으로 받고, 화면은 dpr 1·그림자 없이·초당 30장으로 그린다. */
export { SLOW_PC };
// 약한 PC: 인식이 초당 5~8번이라 던지는 순간 속도가 덜 잡힌다. 던지기 판정을 낮추고 장전을 오래 기다린다
if (SLOW_PC) {
  Object.assign(MOTION, {
    cockHoldMs: 1100,
    releaseDownSpeed: 3,
    releaseDrop: 0.55,
    releaseForwardSpeed: 1.2,
    swingSpeed: 6,
    swingTravel: 1.1,
    // 초당 5번(0.2초 간격)이면 한 번만 늦어도 0.25초를 넘어 던지기가 통째로 안 잡혔다
    velocityGapS: 0.4,
  });
}
// ponytail: 코어 수로만 가린다. 코어는 많은데 그래픽이 약한 기기가 나오면 실제 인식 시간(ms)을 재서 고르게 바꾼다
/** 약한 PC는 화면을 초당 30장까지만 그린다. 남는 힘을 인식에 준다. */
export const FRAME_MS = SLOW_PC ? 32 : 0;
/** 약한 PC: 인식을 GPU·CPU로 한 번씩 재 보고 빠른 쪽을 이 PC에 저장한다(6세대 내장 그래픽은 CPU가 더 빠를 수 있다).
 * v2: 재는 방법이 바뀌어(아래 benchDelegates) 예전 방법으로 저장한 값은 버리고 한 번 다시 잰다. */
const DELEGATE_KEY = "weaveon-delegate-v2";
/** 주소에 ?delegate=cpu 또는 gpu 를 붙이면 재지 않고 그쪽으로 고정한다(현장 시험용, 저장하지 않는다). */
const forcedDelegate = ((): "GPU" | "CPU" | null => {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("delegate")?.toUpperCase();
  return v === "GPU" || v === "CPU" ? v : null;
})();
function savedDelegate(): "GPU" | "CPU" | null {
  if (forcedDelegate) return forcedDelegate;
  try {
    const v = localStorage.getItem(DELEGATE_KEY);
    return v === "GPU" || v === "CPU" ? v : null;
  } catch {
    return null;
  }
}
/** 재 볼 때 읽힐 그림(사람 한 명)과 횟수. 처음 몇 번은 준비(셰이더·캐시) 때문에 느려서 버린다. */
const BENCH_IMAGE = "/goliath-idle.png";
const BENCH_RUNS = 9;
const BENCH_SKIP = 3;
/** 한 PC에서 한 번만 잰다. 고르는 화면과 체험 화면이 동시에 재지 않게 같은 약속을 나눠 쓴다. */
let benching: Promise<"GPU" | "CPU" | null> | null = null;

/** 작업자에 한 번 묻고 다음 답을 기다린다. */
function askWorker<T>(w: Worker, msg: unknown, transfer: Transferable[], ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    w.onerror = (e) => {
      window.clearTimeout(timer);
      reject(new Error(e.message || "worker"));
    };
    w.onmessage = (e) => {
      window.clearTimeout(timer);
      if (e.data?.type === "fail") reject(new Error(String(e.data.message)));
      else resolve(e.data as T);
    };
    w.postMessage(msg, transfer);
  });
}

/** 약한 PC 첫 실행: 같은 그림을 GPU·CPU 작업자에 각각 읽혀 보고 빠른 쪽을 고른다(몇 초).
 * 예전에는 켜진 뒤 실제 영상으로 10초씩 쟀다: 첫 인식의 준비 시간이 GPU 쪽에 섞이고, 사람이 서 있을 때와 없을 때가 뒤섞여
 * 느린 쪽이 영영 저장될 수 있었다. 그림을 못 받거나 한쪽도 못 재면 null(예전 방식으로 넘어간다). */
async function benchDelegates(opts: { baseOptions: object }): Promise<"GPU" | "CPU" | null> {
  const blob = await fetch(BENCH_IMAGE).then((r) => (r.ok ? r.blob() : Promise.reject(new Error("image"))));
  const img = await createImageBitmap(blob);
  // 실제와 같은 크기(320×240)의 장면에 사람을 세운다
  const canvas = new OffscreenCanvas(TV_INFER_LONG, Math.round(TV_INFER_LONG * 0.75));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#667";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const h = canvas.height * 0.92;
  const w = (h * img.width) / img.height;
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  img.close();
  const timeOne = async (delegate: "GPU" | "CPU"): Promise<number> => {
    const worker = new Worker(new URL("./pose.worker.ts", import.meta.url));
    try {
      const ready = await askWorker<{ delegate: string }>(
        worker,
        { type: "init", opts: { ...opts, baseOptions: { ...opts.baseOptions, delegate } } },
        [],
        30000,
      );
      if (ready.delegate !== delegate) return Infinity; // GPU를 못 만들어 CPU로 바뀌었다
      const times: number[] = [];
      for (let i = 0; i < BENCH_RUNS; i++) {
        const bitmap = await createImageBitmap(canvas);
        const r = await askWorker<{ ms: number }>(
          worker,
          { type: "frame", bitmap, ts: (i + 1) * 100, at: 0, aspect: canvas.width / canvas.height },
          [bitmap],
          15000,
        );
        if (!(r.ms > 0)) return Infinity; // 작업자가 읽다 터지면 0을 돌려준다
        if (i >= BENCH_SKIP) times.push(r.ms);
      }
      times.sort((a, b) => a - b);
      return times[Math.floor(times.length / 2)] || Infinity;
    } catch {
      return Infinity;
    } finally {
      worker.terminate();
    }
  };
  const gpu = await timeOne("GPU");
  const cpu = await timeOne("CPU");
  if (!Number.isFinite(gpu) && !Number.isFinite(cpu)) return null;
  const best = cpu < gpu ? "CPU" : "GPU";
  const show = (v: number) => (Number.isFinite(v) ? `${Math.round(v)}ms` : "안 됨");
  speedBadge(`속도 재기: GPU ${show(gpu)} · CPU ${show(cpu)} → ${best}`);
  try {
    localStorage.setItem(DELEGATE_KEY, best);
  } catch {
    /* 저장이 막히면 다음에 또 잰다 */
  }
  return best;
}
/** 약한 PC: 화면 구석에 속도를 띄운다(현장에서 숫자로 알려 주시라고). */
function speedBadge(text: string): void {
  let el = document.getElementById("pose-speed");
  if (!el) {
    el = document.createElement("div");
    el.id = "pose-speed";
    el.style.cssText =
      "position:fixed;left:6px;bottom:4px;z-index:99999;font:12px monospace;color:#fff;background:#0008;padding:2px 6px;border-radius:4px;pointer-events:none";
    document.body.appendChild(el);
  }
  el.textContent = text;
}
/** 화면 배율. TV는 1, 약한 PC는 0.7(70% 크기로 그려 늘린다: 칠할 점이 절반. 글자가 조금 흐려진다). */
export function screenDpr(): number {
  if (SLOW_PC) return 0.7;
  return Math.min(isTv() ? 1 : 2, window.devicePixelRatio || 1);
}
/** 약한 PC: 빛 번짐(shadowBlur)은 내장 그래픽에서 가장 비싼 그리기라 통째로 끈다. 모양은 그대로 남는다. */
export function lightCanvas(ctx: CanvasRenderingContext2D): void {
  // 같은 화면이 두 번 붙을 수 있다(화면 다시 붙이기·개발 모드): 이미 바꿨으면 그대로
  if (SLOW_PC && !Object.getOwnPropertyDescriptor(ctx, "shadowBlur")) {
    Object.defineProperty(ctx, "shadowBlur", { get: () => 0, set: () => {}, configurable: true });
  }
}
/** TV 속도를 이 간격(ms)으로 화면에 알려 준다. 현장엔 로그를 볼 방법이 없다. */
const STATS_MS = 10000;
const STATS_TIMES = 6;
/** 게임 중 플레이어가 이만큼(ms) 안 보이면 놓아주고 다른 사람을 잡는다. 지나가는 사람에 잠깐 가려지는 것은 기다린다. */
const PLAYER_LOST_MS = 1500;
/** 4:3을 먼저 청한다. 16:9는 많은 웹캠에서 위아래가 잘려, 높이 달린 카메라에 작은 아이가 안 담긴다. */
const CAMERA_SHAPE = {
  // 약한 PC는 1280×960 영상을 풀고 줄이는 것만으로 CPU를 꽤 먹는다. 인식은 어차피 320으로 읽는다
  width: { ideal: SLOW_PC ? 640 : 1280 },
  height: { ideal: SLOW_PC ? 480 : 960 },
  aspectRatio: { ideal: 4 / 3 },
  // 약한 PC는 인식이 초당 5~8번뿐이라 30장을 다 풀 이유가 없다: 15장만 받아 영상 푸는 일을 절반으로
  frameRate: { ideal: SLOW_PC ? 15 : 30 },
};

export class PoseController {
  video: HTMLVideoElement | null = null;
  status: "off" | "loading" | "live" | "denied" = "off";
  poseReady = false;
  modelError: string | null = null;
  error: string | null = null;
  private landmarker: {
    detectForVideo: (
      image: HTMLVideoElement | HTMLCanvasElement,
      ts: number,
    ) => {
      landmarks: RawPoint[][];
      worldLandmarks?: { x: number; y: number; z: number }[][];
    };
    close?: () => void;
  } | null = null;
  private stream: MediaStream | null = null;
  private disconnected = false;
  private motion = new MotionTracker();
  private lastCenter: number | null = null;
  private lastSeen = 0;
  /** 게임 중: 지금 플레이어를 놓지 않는다. 게임 루프가 정한다. */
  locked = false;
  private lastTs = 0;
  private lastInfer = 0;
  private inferCanvas: HTMLCanvasElement | null = null;
  /** TV: 인식을 화면과 따로 돌리는 작업자. 못 띄우면 null이고 예전처럼 화면 줄에서 돈다. */
  private worker: Worker | null = null;
  private workerBusy = false;
  /** 마지막으로 작업자에 넘긴 영상의 시각(video.currentTime). 같은 장면을 두 번 읽지 않는다. */
  private lastShotTime = -1;
  private workerOut: {
    landmarks: RawPoint[][];
    world: { x: number; y: number; z: number }[][];
    at: number;
    aspect: number;
  } | null = null;
  private tvCanvas: OffscreenCanvas | null = null;
  private delegate = "";
  /** 약한 PC: 이번에 쓸 인식 장치와, 비교용으로 잰 GPU 속도(ms). */
  private want: "GPU" | "CPU" = savedDelegate() ?? "GPU";
  private gpuMs: number | null = null;
  private stats = { at: 0, ticks: 0, infers: 0, ms: 0, told: 0 };
  present = false;
  lastFrame: PoseFrame = EMPTY;
  /** 마지막으로 고른 플레이어의 어깨 폭·가운데(놀이 자리 맞추기용). */
  lastPick: { width: number; cx: number; at: number } | null = null;

  resetMotion(): void {
    this.motion.reset();
  }

  hasStream(): boolean {
    return Boolean(this.stream);
  }

  trackLive(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    return Boolean(track && track.readyState === "live");
  }

  takeDisconnect(): boolean {
    const track = this.stream?.getVideoTracks()[0];
    if (this.status === "live" && track && track.readyState === "ended") this.disconnected = true;
    if (!this.disconnected) return false;
    this.disconnected = false;
    this.status = "off";
    this.poseReady = false;
    this.present = false;
    this.motion.reset();
    this.lastFrame = EMPTY;
    return true;
  }

  /** stop()이 늘린다. 켜는 도중에 꺼지면(고르는 화면에서 바로 체험을 고를 때) 뒤늦게 켜진 카메라·인식을 버린다.
   * 안 그러면 보이지 않는 인식이 하나 더 남아 약한 PC에서 게임 인식을 같이 깎아 먹는다. */
  private gen = 0;

  async start(video: HTMLVideoElement, onCamera?: () => void): Promise<void> {
    const gen = this.gen;
    this.video = video;
    this.status = "loading";
    this.error = null;
    try {
      await this.openCamera(video);
      if (gen !== this.gen) {
        this.stop();
        return;
      }
      this.status = "live";
      onCamera?.();
    } catch (err) {
      this.status = "denied";
      this.error = explainCameraError(err);
      this.poseReady = false;
      this.modelError = null;
      return;
    }
    await this.loadModel();
    if (gen !== this.gen) this.stop();
  }

  async loadModel(): Promise<void> {
    if (this.status !== "live") return;
    const gen = this.gen;
    this.poseReady = false;
    this.modelError = null;
    this.landmarker?.close?.();
    this.landmarker = null;
    this.stopWorker();
    // 약한 PC 첫 실행: 어느 쪽이 빠른지 먼저 잰다(이 PC에 저장된 값이 있으면 건너뛴다)
    if (SLOW_PC && !savedDelegate()) {
      benching ??= benchDelegates({
        baseOptions: { modelAssetPath: "/mediapipe/pose_landmarker_lite.task" },
        runningMode: "VIDEO",
        numPoses: 1,
      } as { baseOptions: object }).catch(() => null);
      const best = await benching;
      if (best) this.want = best;
      // 재는 사이에 꺼졌으면(고르는 화면에서 바로 체험을 골랐을 때) 여기서 멈춘다
      if (gen !== this.gen || this.status !== "live") return;
    }
    const opts = {
      baseOptions: {
        modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
        delegate: SLOW_PC ? this.want : ("GPU" as const),
      },
      runningMode: "VIDEO" as const,
      // 뒤에 지나가는 사람이 있어도 가장 가까운 사람을 고른다.
      // 위브온 현장은 줄 선 사람이 많다: 2명만 찾으면 구경꾼 둘에 밀려 플레이어가 빠진다
      // TV는 1명만: 찾을 수보다 적게 보이면 매 프레임 사람 찾기를 다시 돌려 몇 배 느려진다
      // 약한 PC도 여러 명 중 플레이어를 고르려면 2명 이상은 찾아야 한다(1명이면 누가 잡힐지 모델 마음대로)
      // ponytail: 약한 PC는 1명 — 뒤 사람이 더 또렷하면 그 사람이 잡혀 놀이 자리에서 걸러지고 잠깐 아무도 없다. 행사 뒤 PC를 바꾸면 3명으로 돌아간다
      numPoses: isTv() || SLOW_PC ? 1 : EDITION.id === "weaveon" ? 3 : 2,
      // 화면 아래쪽에 반쯤 걸친 작은 아이도 잡히게 0.5 → 0.4
      minPoseDetectionConfidence: 0.4,
      minPosePresenceConfidence: 0.4,
      minTrackingConfidence: 0.4,
    };
    // 위브온판은 PC도 작업자에서: 화면 줄에서 돌면 인식할 때마다 음표가 멈칫한다
    if ((isTv() || EDITION.id === "weaveon") && (await this.startWorker(opts))) {
      this.poseReady = true;
      this.modelError = null;
      return;
    }
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      this.delegate = "GPU·화면줄";
      try {
        this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, opts);
      } catch {
        this.delegate = "CPU·화면줄";
        this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          ...opts,
          baseOptions: { ...opts.baseOptions, delegate: "CPU" },
        });
      }
      this.poseReady = true;
      this.modelError = null;
    } catch {
      this.landmarker = null;
      this.poseReady = false;
      this.modelError =
        "카메라는 켜졌지만 모션을 준비하지 못했습니다. 아래 다시 시도를 눌러 주세요.";
    }
  }

  /** 작업자를 띄운다. 모델까지 준비되면 true, 안 되면 false(화면 줄에서 돈다). */
  private startWorker(opts: unknown): Promise<boolean> {
    const gen = this.gen;
    return new Promise((resolve) => {
      let w: Worker;
      try {
        w = new Worker(new URL("./pose.worker.ts", import.meta.url));
      } catch {
        resolve(false);
        return;
      }
      const giveUp = (why: string) => {
        window.clearTimeout(timer);
        w.terminate();
        if (this.worker === w) {
          this.worker = null;
          this.poseReady = false;
        }
        tvToast(`인식 작업자 실패: ${why}`);
        resolve(false);
      };
      const timer = window.setTimeout(() => giveUp("시간 초과"), 30000);
      w.onerror = (e) => giveUp(e.message || "오류");
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === "ready") {
          window.clearTimeout(timer);
          // 준비되는 사이에 꺼졌으면(stop) 버린다: 안 그러면 아무도 안 쓰는 작업자가 남는다
          if (gen !== this.gen) {
            w.terminate();
            resolve(false);
            return;
          }
          this.worker = w;
          this.delegate = m.delegate;
          this.watchFrames(w);
          resolve(true);
        } else if (m.type === "fail") {
          giveUp(m.message);
        } else {
          this.workerBusy = false;
          this.workerOut = m;
          this.stats.infers += 1;
          this.stats.ms += m.ms;
          // 결과가 오자마자 다음 장면을 넘긴다(화면 장면을 기다리지 않는다)
          this.pump(performance.now());
        }
      };
      w.postMessage({ type: "init", opts });
    });
  }

  private stopWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    this.workerBusy = false;
    this.workerOut = null;
  }

  private async openCamera(video: HTMLVideoElement): Promise<void> {
    this.stopStream();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error("unsupported"), { name: "SecurityError" });
    }

    video.setAttribute("playsinline", "true");
    video.setAttribute("autoplay", "true");
    video.muted = true;
    video.playsInline = true;

    const chosen = preferredCameraId();
    const useStream = async (stream: MediaStream) => {
      this.stream = stream;
      video.srcObject = stream;
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          this.disconnected = true;
        };
      });
      await playVideo(video);
    };
    // TV가 안드로이드 카메라로 못 잡는 웹캠은 USB로 직접 읽는다
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const noNative = !devices.some((d) => d.kind === "videoinput");
    if ((isUvcId(chosen) || noNative) && uvcDevices().length) {
      await useStream(await openUvc(chosen));
      return;
    }
    const tries: MediaStreamConstraints[] = [
      ...(chosen
        ? [{ audio: false, video: { deviceId: { exact: chosen }, ...CAMERA_SHAPE } }]
        : []),
      {
        audio: false,
        video: { ...CAMERA_SHAPE, facingMode: "user" },
      },
      { audio: false, video: true },
      { audio: false, video: { facingMode: { ideal: "user" } } },
    ];

    let lastErr: unknown = null;
    for (const constraints of tries) {
      try {
        await useStream(
          await withTimeout(navigator.mediaDevices.getUserMedia(constraints), 12000),
        );
        return;
      } catch (err) {
        lastErr = err;
        const name = errorName(err);
        if (
          name === "NotAllowedError" ||
          name === "PermissionDeniedError" ||
          name === "SecurityError"
        ) {
          throw err;
        }
      }
    }
    if (uvcDevices().length) {
      await useStream(await openUvc(chosen));
      return;
    }
    throw lastErr ?? Object.assign(new Error("camera"), { name: "NotFoundError" });
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  stop(): void {
    this.gen += 1;
    this.landmarker?.close?.();
    this.landmarker = null;
    this.stopWorker();
    this.stopStream();
    this.status = "off";
    this.poseReady = false;
    this.modelError = null;
  }

  tick(now: number): PoseFrame {
    const video = this.video;
    if (!video || video.readyState < 2 || (!this.landmarker && !this.worker)) {
      this.motion.reset();
      this.present = false;
      this.lastFrame = EMPTY;
      return this.lastFrame;
    }
    this.reportSpeed(now);
    if (this.worker) return this.tickWorker(now);
    if (now - this.lastInfer < INFER_MS && this.lastFrame.skeleton) {
      return { ...this.lastFrame, throwEvent: null };
    }
    this.lastInfer = now;
    const ts = now <= this.lastTs ? this.lastTs + 1 : now;
    this.lastTs = ts;

    const source = this.inferSource(video);
    const aspect = source.width && source.height ? source.width / source.height : 4 / 3;
    let poses: RawPoint[][] = [];
    let worlds: { x: number; y: number; z: number }[][] = [];
    const started = performance.now();
    try {
      const result = this.landmarker!.detectForVideo(source, ts);
      poses = result.landmarks ?? [];
      worlds = result.worldLandmarks ?? [];
    } catch {
      this.lastFrame = { ...EMPTY, present: this.present };
      return this.lastFrame;
    }
    this.stats.infers += 1;
    this.stats.ms += performance.now() - started;
    return this.readPoses(poses, worlds, aspect, now);
  }

  /** 작업자에 최신 영상을 넘기고, 끝난 결과가 있으면 읽는다. 화면은 기다리지 않는다. */
  private tickWorker(now: number): PoseFrame {
    this.pump(now);
    const out = this.workerOut;
    if (!out) return { ...this.lastFrame, throwEvent: null };
    this.workerOut = null;
    return this.readPoses(out.landmarks, out.world, out.aspect, out.at);
  }

  /** 작업자가 쉬고 있으면 최신 영상을 넘긴다. 화면 줄(tick)과 결과 도착(startWorker의 onmessage) 양쪽에서 부른다.
   * 예전에는 화면 장면(약한 PC는 33ms마다)에서만 넘겨서, 인식이 끝나도 다음 장면까지 작업자가 놀았다:
   * 인식 한 번이 70ms면 100ms 주기(초당 10번), 110ms면 133ms 주기로 묶였다. 이제 끝나는 대로 이어서 읽는다. */
  private pump(now: number): void {
    const video = this.video;
    if (!this.worker || this.workerBusy || !video || video.readyState < 2 || document.hidden) return;
    if (now - this.lastInfer < INFER_MS) return;
    // 카메라가 새 장면을 주지 않았으면 같은 그림을 또 읽지 않는다(USB 직접 읽기는 시각이 없어 그냥 읽는다)
    if (!uvcCanvas() && video.currentTime === this.lastShotTime) return;
    const shot = this.grabFrame(video);
    if (!shot) return;
    this.lastShotTime = video.currentTime;
    this.lastInfer = now;
    const ts = now <= this.lastTs ? this.lastTs + 1 : now;
    this.lastTs = ts;
    this.workerBusy = true;
    this.worker.postMessage({ type: "frame", ts, at: now, ...shot }, [shot.bitmap]);
  }

  /** 카메라가 새 장면을 줄 때마다 바로 넘겨 본다(작업자가 쉬고 있을 때만 실제로 넘어간다). 이 작업자가 살아 있는 동안만 돈다. */
  private watchFrames(w: Worker): void {
    const video = this.video as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
    if (!video?.requestVideoFrameCallback) return;
    video.requestVideoFrameCallback(() => {
      if (this.worker !== w) return;
      this.pump(performance.now());
      this.watchFrames(w);
    });
  }

  private grabFrame(video: HTMLVideoElement): { bitmap: ImageBitmap; aspect: number } | null {
    const src = uvcCanvas() ?? video;
    const vw = src instanceof HTMLVideoElement ? src.videoWidth : src.width;
    const vh = src instanceof HTMLVideoElement ? src.videoHeight : src.height;
    if (vw < 2 || vh < 2) return null;
    const k = Math.min(1, (isTv() || SLOW_PC ? TV_INFER_LONG : INFER_LONG) / Math.max(vw, vh));
    const w = Math.round(vw * k);
    const h = Math.round(vh * k);
    if (!this.tvCanvas || this.tvCanvas.width !== w || this.tvCanvas.height !== h) {
      this.tvCanvas = new OffscreenCanvas(w, h);
    }
    const ctx = this.tvCanvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(src, 0, 0, w, h);
    return { bitmap: this.tvCanvas.transferToImageBitmap(), aspect: w / h };
  }

  private reportSpeed(now: number): void {
    // 약한 PC도 속도를 window.__poseStats에 남긴다(PC엔 토스트가 없어 F12 콘솔로 본다)
    if (!isTv() && !SLOW_PC) return;
    const s = this.stats;
    s.ticks += 1;
    if (!s.at) s.at = now;
    if (now - s.at < STATS_MS) return;
    const sec = (now - s.at) / 1000;
    if (SLOW_PC) this.tuneSlowPc(s, sec);
    if (isTv() && s.told < STATS_TIMES) {
      s.told += 1;
      tvToast(
        `화면 ${Math.round(s.ticks / sec)}장/초 · 인식 ${Math.round(s.infers / sec)}회/초 ` +
          `(${Math.round(s.ms / Math.max(1, s.infers))}ms, ${this.delegate})`,
      );
    }
    (window as unknown as { __poseStats: unknown }).__poseStats = { ...s, sec, d: this.delegate };
    s.at = now;
    s.ticks = 0;
    s.infers = 0;
    s.ms = 0;
  }

  /** 약한 PC: 속도를 화면 구석에 띄우고, 처음 한 번 GPU·CPU를 재서 빠른 쪽을 저장한다. */
  private tuneSlowPc(s: { ticks: number; infers: number; ms: number }, sec: number): void {
    const avg = Math.round(s.ms / Math.max(1, s.infers));
    const done = savedDelegate();
    speedBadge(
      `${this.delegate} 인식 ${avg}ms · ${Math.round(s.infers / sec)}회/초 · 화면 ${Math.round(s.ticks / sec)}장/초` +
        (done ? "" : " · 속도 재는 중"),
    );
    // 바꿔 끼우는 동안 인식이 몇 초 끊긴다: 게임 중에는 재지 않고 대기 화면에서만
    if (done || this.locked || s.infers < 10) return;
    if (this.want === "GPU") {
      this.gpuMs = avg;
      this.want = "CPU";
      void this.loadModel();
    } else if (this.gpuMs !== null) {
      const best = avg < this.gpuMs ? "CPU" : "GPU";
      try {
        localStorage.setItem(DELEGATE_KEY, best);
      } catch {
        /* 저장이 막히면 다음에 또 잰다 */
      }
      if (best === "GPU") {
        this.want = "GPU";
        void this.loadModel();
      }
    }
  }

  private readPoses(
    poses: RawPoint[][],
    worlds: { x: number; y: number; z: number }[][],
    aspect: number,
    now: number,
  ): PoseFrame {
    active = this;
    const lost = now - this.lastSeen > PLAYER_LOST_MS;
    const pick = pickPlayer(poses, aspect, this.lastCenter, this.locked && !lost, zone);
    if (pick >= 0) {
      const ls = poses[pick][11];
      const rs = poses[pick][12];
      const cx = ((ls?.x ?? 0.5) + (rs?.x ?? 0.5)) / 2;
      if (ls && rs) {
        this.lastPick = { width: Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y), cx, at: performance.now() };
      }
      // 다른 사람으로 바뀌면 손이 순간이동한 것을 동작으로 읽지 않게 지운다
      if (this.lastCenter !== null && Math.abs(cx - this.lastCenter) >= PLAYER_GAP) {
        this.motion.reset();
      }
      this.lastCenter = cx;
      this.lastSeen = now;
    } else if (lost || !this.locked) {
      this.lastCenter = null;
    }
    if (pick < 0) {
      const m = this.motion.update(null, now);
      this.present = m.present;
      this.lastFrame = { ...EMPTY, present: m.present };
      return this.lastFrame;
    }
    const raw = poses[pick];
    const world = worlds[pick];
    const img: Landmark[] = raw.map((p) => ({ x: 1 - p.x, y: p.y, v: p.visibility ?? 1 }));
    const input: BodyInput = { t: now, aspect, img, worldZ: world ? world.map((p) => p.z) : null };
    const m = this.motion.update(input, now);
    this.present = m.present;
    const skeleton = [0, 11, 12, 13, 14, 15, 16, 23, 24].map((i) => img[i]);
    this.lastFrame = {
      present: m.present,
      handsUp: m.handsUp,
      throwEvent: m.throwEvent,
      skeleton,
      armed: m.armed,
      chestStill: m.chestStill,
      aim: m.aim,
      tooFar: m.tooFar,
      lowInFrame: m.lowInFrame,
      bodyX: m.bodyX,
      offCenter: m.offCenter,
      reach: reachHands(img, aspect),
    };
    return this.lastFrame;
  }

  /** 영상 비율을 그대로 둔 채 줄인다. 찌그러진 영상은 관절을 틀리게 읽는다. */
  private inferSource(video: HTMLVideoElement): HTMLVideoElement | HTMLCanvasElement {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw < 2 || vh < 2) return video;
    const k = Math.min(1, (isTv() || SLOW_PC ? TV_INFER_LONG : INFER_LONG) / Math.max(vw, vh));
    const w = Math.round(vw * k);
    const h = Math.round(vh * k);
    if (!this.inferCanvas) this.inferCanvas = document.createElement("canvas");
    if (this.inferCanvas.width !== w || this.inferCanvas.height !== h) {
      this.inferCanvas.width = w;
      this.inferCanvas.height = h;
    }
    const ctx = this.inferCanvas.getContext("2d");
    if (!ctx) return video;
    ctx.drawImage(video, 0, 0, w, h);
    return this.inferCanvas;
  }
}

function errorName(err: unknown): string {
  if (err && typeof err === "object" && "name" in err)
    return String((err as { name: string }).name);
  return "";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => {
      reject(Object.assign(new Error("timeout"), { name: "TimeoutError" }));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(id);
        reject(err);
      },
    );
  });
}

async function playVideo(video: HTMLVideoElement): Promise<void> {
  try {
    await video.play();
  } catch {
    await new Promise((r) => window.setTimeout(r, 120));
    await video.play();
  }
}

function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function explainCameraError(err: unknown): string {
  const name = errorName(err);
  if (!navigator.mediaDevices?.getUserMedia) {
    return "이 주소에서는 카메라를 쓸 수 없습니다. Chrome으로 열고, 주소가 https 또는 localhost인지 확인하세요.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    if (isFramed()) {
      return "이 미리보기 창은 카메라를 막습니다. 아래 ‘새 창에서 열기’를 누르세요.";
    }
    return "브라우저가 카메라를 막았습니다. 주소창 왼쪽 자물쇠/카메라 아이콘에서 허용을 고른 뒤 다시 시도하세요.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "연결된 웹캠이 없습니다. 카메라를 꽂고 다시 시도하세요.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "다른 프로그램이 카메라를 사용 중입니다. Zoom/Teams를 끄고 다시 시도하세요.";
  }
  if (name === "TimeoutError") {
    return "카메라 응답이 없습니다. 권한 창이 다른 창 뒤에 가려졌는지 확인하세요.";
  }
  if (name === "SecurityError") {
    return "보안 주소가 아니라 카메라를 켤 수 없습니다. Chrome에서 https로 여세요.";
  }
  return "카메라를 켜지 못했습니다. 주소창에서 카메라 권한을 확인하세요.";
}
