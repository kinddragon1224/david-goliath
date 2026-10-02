import { MotionTracker, type Aim, type BodyInput, type Landmark, type ThrowEvent } from "./motion";

export type { Aim, Landmark, ThrowEvent };

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
  offCenter: boolean;
};

const EMPTY: PoseFrame = {
  present: false,
  handsUp: false,
  throwEvent: null,
  skeleton: null,
  armed: false,
  chestStill: false,
  aim: null,
  tooFar: false,
  offCenter: false,
};

type RawPoint = { x: number; y: number; z?: number; visibility?: number };

/** 초당 추론 횟수 상한. 빠른 팔 동작을 놓치지 않을 만큼. */
const INFER_MS = 30;
/** 추론용으로 줄인 영상의 긴 변. 멀리 선 아이의 손목까지 보이게. */
const INFER_LONG = 480;

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
  private lastTs = 0;
  private lastInfer = 0;
  private inferCanvas: HTMLCanvasElement | null = null;
  present = false;
  lastFrame: PoseFrame = EMPTY;

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

  async start(video: HTMLVideoElement, onCamera?: () => void): Promise<void> {
    this.video = video;
    this.status = "loading";
    this.error = null;
    try {
      await this.openCamera(video);
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
  }

  async loadModel(): Promise<void> {
    if (this.status !== "live") return;
    this.poseReady = false;
    this.modelError = null;
    this.landmarker?.close?.();
    this.landmarker = null;
    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks("/mediapipe/wasm");
      const opts = {
        baseOptions: {
          modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
          delegate: "GPU" as const,
        },
        runningMode: "VIDEO" as const,
        // 뒤에 지나가는 사람이 있어도 가장 가까운 사람을 고른다
        numPoses: 2,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };
      try {
        this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, opts);
      } catch {
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
      this.modelError = "카메라는 켜졌지만 모션을 준비하지 못했습니다. 아래 다시 시도를 눌러 주세요.";
    }
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

    const tries: MediaStreamConstraints[] = [
      {
        audio: false,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: "user" },
      },
      { audio: false, video: true },
      { audio: false, video: { facingMode: { ideal: "user" } } },
    ];

    let lastErr: unknown = null;
    for (const constraints of tries) {
      try {
        const stream = await withTimeout(
          navigator.mediaDevices.getUserMedia(constraints),
          12000,
        );
        this.stream = stream;
        video.srcObject = stream;
        stream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            this.disconnected = true;
          };
        });
        await playVideo(video);
        return;
      } catch (err) {
        lastErr = err;
        const name = errorName(err);
        if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
          throw err;
        }
      }
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
    this.landmarker?.close?.();
    this.landmarker = null;
    this.stopStream();
    this.status = "off";
    this.poseReady = false;
    this.modelError = null;
  }

  tick(now: number): PoseFrame {
    const video = this.video;
    if (!video || video.readyState < 2 || !this.landmarker) {
      this.motion.reset();
      this.present = false;
      this.lastFrame = EMPTY;
      return this.lastFrame;
    }
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
    try {
      const result = this.landmarker.detectForVideo(source, ts);
      poses = result.landmarks ?? [];
      worlds = result.worldLandmarks ?? [];
    } catch {
      this.lastFrame = { ...EMPTY, present: this.present };
      return this.lastFrame;
    }

    const pick = pickMain(poses, aspect);
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
      offCenter: m.offCenter,
    };
    return this.lastFrame;
  }

  /** 영상 비율을 그대로 둔 채 줄인다. 찌그러진 영상은 관절을 틀리게 읽는다. */
  private inferSource(video: HTMLVideoElement): HTMLVideoElement | HTMLCanvasElement {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw < 2 || vh < 2) return video;
    const k = Math.min(1, INFER_LONG / Math.max(vw, vh));
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

/** 여러 명이 잡히면 어깨가 가장 넓은(가장 가까운) 사람, 비슷하면 가운데 사람. */
function pickMain(poses: RawPoint[][], aspect: number): number {
  let best = -1;
  let bestScore = 0;
  poses.forEach((p, i) => {
    const ls = p[11];
    const rs = p[12];
    if (!ls || !rs || (ls.visibility ?? 1) < 0.4 || (rs.visibility ?? 1) < 0.4) return;
    const width = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y);
    const center = Math.abs((ls.x + rs.x) / 2 - 0.5);
    const score = width - center * 0.08;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

function errorName(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) return String((err as { name: string }).name);
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

