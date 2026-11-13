import { EDITION } from "./edition";
import { isTv, preferredCameraId } from "./kiosk";
import { reachHands, type ReachHand } from "./reach";
import { isUvcId, openUvc, tvToast, uvcCanvas, uvcDevices } from "./uvc";
import {
  MotionTracker,
  pickPlayer,
  PLAYER_GAP,
  type Aim,
  type BodyInput,
  type Landmark,
  type ThrowEvent,
} from "./motion";

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
/** 약한 PC(4코어 이하, 예: Intel HD 520 미니 PC). 3명을 찾고 640으로 읽으면 사람 찾기가 매 프레임 돌아 인식이 몇 배 늦다.
 * TV처럼 1명·320으로 읽는다. 대신 줄 선 사람이 바로 뒤에 서면 플레이어를 잠깐 놓칠 수 있다. */
const SLOW_PC =
  typeof navigator !== "undefined" && !isTv() && (navigator.hardwareConcurrency || 8) <= 4;
// ponytail: 코어 수로만 가린다. 코어는 많은데 그래픽이 약한 기기가 나오면 실제 인식 시간(ms)을 재서 고르게 바꾼다
/** TV 속도를 이 간격(ms)으로 화면에 알려 준다. 현장엔 로그를 볼 방법이 없다. */
const STATS_MS = 10000;
const STATS_TIMES = 6;
/** 게임 중 플레이어가 이만큼(ms) 안 보이면 놓아주고 다른 사람을 잡는다. 지나가는 사람에 잠깐 가려지는 것은 기다린다. */
const PLAYER_LOST_MS = 1500;
/** 4:3을 먼저 청한다. 16:9는 많은 웹캠에서 위아래가 잘려, 높이 달린 카메라에 작은 아이가 안 담긴다. */
const CAMERA_SHAPE = {
  width: { ideal: 1280 },
  height: { ideal: 960 },
  aspectRatio: { ideal: 4 / 3 },
  frameRate: { ideal: 30 },
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
  private workerOut: {
    landmarks: RawPoint[][];
    world: { x: number; y: number; z: number }[][];
    at: number;
    aspect: number;
  } | null = null;
  private tvCanvas: OffscreenCanvas | null = null;
  private delegate = "";
  private stats = { at: 0, ticks: 0, infers: 0, ms: 0, told: 0 };
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
    this.poseReady = false;
    this.modelError = null;
    this.landmarker?.close?.();
    this.landmarker = null;
    this.stopWorker();
    const opts = {
      baseOptions: {
        modelAssetPath: "/mediapipe/pose_landmarker_lite.task",
        delegate: "GPU" as const,
      },
      runningMode: "VIDEO" as const,
      // 뒤에 지나가는 사람이 있어도 가장 가까운 사람을 고른다.
      // 위브온 현장은 줄 선 사람이 많다: 2명만 찾으면 구경꾼 둘에 밀려 플레이어가 빠진다
      // TV는 1명만: 찾을 수보다 적게 보이면 매 프레임 사람 찾기를 다시 돌려 몇 배 느려진다
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
          this.worker = w;
          this.delegate = m.delegate;
          resolve(true);
        } else if (m.type === "fail") {
          giveUp(m.message);
        } else {
          this.workerBusy = false;
          this.workerOut = m;
          this.stats.infers += 1;
          this.stats.ms += m.ms;
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
    if (this.worker) return this.tickWorker(this.worker, video, now);
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
  private tickWorker(worker: Worker, video: HTMLVideoElement, now: number): PoseFrame {
    if (!this.workerBusy && now - this.lastInfer >= INFER_MS) {
      const shot = this.grabFrame(video);
      if (shot) {
        this.lastInfer = now;
        const ts = now <= this.lastTs ? this.lastTs + 1 : now;
        this.lastTs = ts;
        this.workerBusy = true;
        worker.postMessage({ type: "frame", ts, at: now, ...shot }, [shot.bitmap]);
      }
    }
    const out = this.workerOut;
    if (!out) return { ...this.lastFrame, throwEvent: null };
    this.workerOut = null;
    return this.readPoses(out.landmarks, out.world, out.aspect, out.at);
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
    if (!isTv()) return;
    const s = this.stats;
    s.ticks += 1;
    if (!s.at) s.at = now;
    if (now - s.at < STATS_MS) return;
    const sec = (now - s.at) / 1000;
    if (s.told < STATS_TIMES) {
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

  private readPoses(
    poses: RawPoint[][],
    worlds: { x: number; y: number; z: number }[][],
    aspect: number,
    now: number,
  ): PoseFrame {
    const lost = now - this.lastSeen > PLAYER_LOST_MS;
    const pick = pickPlayer(poses, aspect, this.lastCenter, this.locked && !lost);
    if (pick >= 0) {
      const cx = ((poses[pick][11]?.x ?? 0.5) + (poses[pick][12]?.x ?? 0.5)) / 2;
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
