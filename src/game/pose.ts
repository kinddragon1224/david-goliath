export type Landmark = { x: number; y: number; v: number };

export type ThrowEvent = {
  power: number;
  aimX: number;
};

export type PoseFrame = {
  present: boolean;
  handsUp: boolean;
  throwEvent: ThrowEvent | null;
  skeleton: Landmark[] | null;
  armed: boolean;
  chestStill: boolean;
};

type Sample = {
  t: number;
  lx: number;
  ly: number;
  lz: number;
  lv: number;
  rx: number;
  ry: number;
  rz: number;
  rv: number;
};

const LS = 11;
const RS = 12;
const LW = 15;
const RW = 16;
const LH = 23;
const RH = 24;
const NOSE = 0;

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
      landmarks: { x: number; y: number; z?: number; visibility?: number }[][];
      worldLandmarks?: { x: number; y: number; z: number }[][];
    };
    close?: () => void;
  } | null = null;
  private stream: MediaStream | null = null;
  private disconnected = false;
  private history: Sample[] = [];
  private throwCooldownUntil = 0;
  private presentFrames = 0;
  private absentFrames = 0;
  private lastTs = 0;
  private lastInfer = 0;
  private inferCanvas: HTMLCanvasElement | null = null;
  present = false;
  lastFrame: PoseFrame = {
    present: false,
    handsUp: false,
    throwEvent: null,
    skeleton: null,
    armed: false,
    chestStill: false,
  };

  resetMotion(): void {
    this.history = [];
    this.throwCooldownUntil = 0;
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
    this.history = [];
    this.lastFrame = { ...this.lastFrame, present: false, throwEvent: null, armed: false, chestStill: false };
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
        numPoses: 1,
        minPoseDetectionConfidence: 0.4,
        minPosePresenceConfidence: 0.4,
        minTrackingConfidence: 0.4,
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
    const empty: PoseFrame = {
      present: false,
      handsUp: false,
      throwEvent: null,
      skeleton: null,
      armed: false,
      chestStill: false,
    };
    const video = this.video;
    if (!video || video.readyState < 2 || !this.landmarker) {
      this.history = [];
      this.lastFrame = { ...empty, present: false };
      this.present = false;
      return this.lastFrame;
    }

    if (now - this.lastInfer < 70 && this.lastFrame.skeleton) {
      return { ...this.lastFrame, throwEvent: null };
    }
    this.lastInfer = now;

    const ts = now <= this.lastTs ? this.lastTs + 1 : now;
    this.lastTs = ts;

    let pose: { x: number; y: number; z?: number; visibility?: number }[] | undefined;
    let world: { x: number; y: number; z: number }[] | undefined;
    try {
      const result = this.landmarker.detectForVideo(this.inferSource(video), ts);
      pose = result.landmarks[0];
      world = result.worldLandmarks?.[0];
    } catch {
      this.lastFrame = empty;
      return empty;
    }

    if (!pose) {
      this.absentFrames += 1;
      this.presentFrames = 0;
      if (this.absentFrames > 12) this.present = false;
      if (!this.present) this.history = [];
      this.lastFrame = { ...empty, present: this.present };
      return this.lastFrame;
    }

    const vis = (i: number) => pose[i]?.visibility ?? 1;
    const seen = vis(LS) > 0.35 && vis(RS) > 0.35 && (vis(NOSE) > 0.25 || vis(LH) > 0.25);
    if (seen) {
      this.presentFrames += 1;
      this.absentFrames = 0;
      if (this.presentFrames > 4) this.present = true;
    } else {
      this.absentFrames += 1;
      this.presentFrames = 0;
      if (this.absentFrames > 12) this.present = false;
    }

    const mirror = (i: number): Landmark => ({
      x: 1 - pose[i].x,
      y: pose[i].y,
      v: vis(i),
    });

    const lShoulder = mirror(LS);
    const rShoulder = mirror(RS);
    const lWrist = mirror(LW);
    const rWrist = mirror(RW);

    const handsUp =
      lWrist.v > 0.35 &&
      rWrist.v > 0.35 &&
      lWrist.y < lShoulder.y - 0.05 &&
      rWrist.y < rShoulder.y - 0.05;

    const zAt = (i: number) => world?.[i]?.z ?? pose[i]?.z ?? 0;

    this.history.push({
      t: now,
      lx: lWrist.x,
      ly: lWrist.y,
      lz: zAt(LW),
      lv: lWrist.v,
      rx: rWrist.x,
      ry: rWrist.y,
      rz: zAt(RW),
      rv: rWrist.v,
    });
    if (this.history.length > 22) this.history.shift();
    if (!this.present) this.history = [];

    const armed = this.present && this.isArmed();
    let throwEvent: ThrowEvent | null = null;
    if (!handsUp && this.present) {
      throwEvent = this.detectThrow(now);
    }

    const shoulderY = (lShoulder.y + rShoulder.y) / 2;
    const chestStill =
      this.present &&
      lWrist.v > 0.5 &&
      rWrist.v > 0.5 &&
      lShoulder.v > 0.45 &&
      rShoulder.v > 0.45 &&
      Math.abs(lWrist.x - rWrist.x) < 0.14 &&
      Math.abs(lWrist.y - rWrist.y) < 0.12 &&
      lWrist.y > shoulderY + 0.02 &&
      lWrist.y < shoulderY + 0.32 &&
      rWrist.y > shoulderY + 0.02 &&
      rWrist.y < shoulderY + 0.32;

    const skeleton = [0, 11, 12, 13, 14, 15, 16, 23, 24].map((i) => mirror(i));
    this.lastFrame = { present: this.present, handsUp, throwEvent, skeleton, armed, chestStill };
    return this.lastFrame;
  }

  private inferSource(video: HTMLVideoElement): HTMLVideoElement | HTMLCanvasElement {
    if (!this.inferCanvas) {
      this.inferCanvas = document.createElement("canvas");
      this.inferCanvas.width = 256;
      this.inferCanvas.height = 192;
    }
    const ctx = this.inferCanvas.getContext("2d");
    if (!ctx || video.videoWidth < 2) return video;
    ctx.drawImage(video, 0, 0, 256, 192);
    return this.inferCanvas;
  }

  private isArmed(): boolean {
    const hist = this.history;
    if (hist.length < 4) return false;
    const cur = hist[hist.length - 1];
    const old = hist.find((s) => cur.t - s.t >= 140) ?? hist[0];
    const leftDown = old.ly + 0.04 < cur.ly;
    const rightDown = old.ry + 0.04 < cur.ry;
    return leftDown || rightDown;
  }

  private detectThrow(now: number): ThrowEvent | null {
    const hist = this.history;
    if (hist.length < 5) return null;
    const cur = hist[hist.length - 1];
    const prev = hist.find((s) => now - s.t >= 60) ?? hist[Math.max(0, hist.length - 4)];
    const wind = hist.find((s) => now - s.t >= 140) ?? hist[0];
    const dt = Math.max(0.035, (cur.t - prev.t) / 1000);

    const hands = [
      {
        vx: (cur.lx - prev.lx) / dt,
        vy: (cur.ly - prev.ly) / dt,
        vz: (cur.lz - prev.lz) / dt,
        x: cur.lx,
        y: cur.ly,
        dy: wind.ly - cur.ly,
        dx: Math.abs(cur.lx - wind.lx),
        v: Math.min(cur.lv, wind.lv),
      },
      {
        vx: (cur.rx - prev.rx) / dt,
        vy: (cur.ry - prev.ry) / dt,
        vz: (cur.rz - prev.rz) / dt,
        x: cur.rx,
        y: cur.ry,
        dy: wind.ry - cur.ry,
        dx: Math.abs(cur.rx - wind.rx),
        v: Math.min(cur.rv, wind.rv),
      },
    ];

    let best: ThrowEvent | null = null;
    let bestScore = 0;
    for (const hand of hands) {
      const speed = Math.hypot(hand.vx, hand.vy);
      const towardCamera = hand.vz < -0.45;
      const upward = hand.vy < -0.85;
      const windup = hand.dy > 0.07;
      const traveled = hand.dy > 0.05 || hand.dx > 0.08;
      if (!(hand.v > 0.45 && windup && traveled && speed > 1.05 && (upward || towardCamera))) continue;
      const score = speed + (upward ? 0.4 : 0) + (towardCamera ? 0.35 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = {
          power: Math.max(0.42, Math.min(1, (speed - 0.6) / 2.4)),
          aimX: Math.max(-1, Math.min(1, (hand.x - 0.5) * 1.8 + hand.vx * 0.12)),
        };
      }
    }
    return best;
  }
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

