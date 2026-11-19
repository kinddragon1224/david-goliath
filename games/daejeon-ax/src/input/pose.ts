import type { NormalizedLandmark, PoseLandmarker } from '@mediapipe/tasks-vision';
import { CONFIG } from '../config';
import { OneEuro } from './filter';
import { clamp1, type InputState } from './index';

const P = CONFIG.pose;
const L_SHOULDER = 11;
const R_SHOULDER = 12;
const L_WRIST = 15;
const R_WRIST = 16;
const DOTS = [0, 11, 12, 13, 14, 15, 16, 23, 24]; // 미리보기에 찍는 점: 코, 어깨, 팔꿈치, 손목, 골반

const asset = (path: string) => new URL(path, document.baseURI).href;

/** 다음 추론까지 둘 간격(ms). 추론이 오래 걸리는 기기일수록 드물게 돌려 화면 그리기에 시간을 남긴다. */
export function inferGapMs(inferMs: number): number {
  return Math.min(1000 / P.minFps, Math.max(1000 / P.maxFps, inferMs / P.maxLoad));
}

/** 어깨가 보이는 사람 중 어깨 중점이 near(프레임 x, 0~1)에 가장 가까운 사람 */
export function pickPose(poses: NormalizedLandmark[][], near: number): NormalizedLandmark[] | null {
  let best: NormalizedLandmark[] | null = null;
  let bestDist = Infinity;
  for (const lm of poses) {
    const ls = lm[L_SHOULDER];
    const rs = lm[R_SHOULDER];
    if (!ls || !rs || (ls.visibility ?? 0) < P.minVisibility || (rs.visibility ?? 0) < P.minVisibility) continue;
    const d = Math.abs((ls.x + rs.x) / 2 - near);
    if (d < bestDist) [best, bestDist] = [lm, d];
  }
  return best;
}

/** 거울 반전·필터링을 마친 추적 결과 */
export interface Tracked {
  /** 양 어깨 중점 x (0~1, 거울 기준: 화면 오른쪽이 1) */
  x: number;
  /** 어깨너비 (프레임 너비 대비) */
  width: number;
}

/**
 * MediaPipe Pose Landmarker 입력. 추론은 렌더 루프와 따로, 새 비디오 프레임이 올 때만 돈다.
 * ponytail: 추론은 메인 스레드에서 동기 호출한다. 느린 기기는 추론 횟수를 줄여 버틴다(inferGapMs).
 * 그래도 프레임 드랍이 문제되면 Worker 로 옮길 것.
 */
export class PoseInput {
  readonly state: InputState = { x: 0, shield: false };
  /** 가장 최근 추적 결과. 사람이 없으면 null */
  tracked: Tracked | null = null;
  /** 마지막으로 사람이 잡힌 시각(performance.now). 한 번도 없으면 0 */
  seenAt = 0;
  /** 메뉴용 몸짓: up = 양손을 머리 위로, cross = 두 팔을 가슴 앞에서 X 로 엇갈림. 손이 안 보이거나 둘 다 아니면 null */
  gesture: 'up' | 'cross' | null = null;
  /** 스켈레톤 점을 그릴 캔버스(없으면 그리지 않음) */
  overlay: HTMLCanvasElement | null = null;

  private landmarker?: PoseLandmarker;
  private loading?: Promise<void>;
  private video?: HTMLVideoElement;
  private stream?: MediaStream;
  private delegate: 'GPU' | 'CPU' = 'GPU';
  private lastVideoTime = -1;
  private lastInferAt = 0;
  /** 최근 추론 한 번에 걸린 시간(ms, 지수 평균)과 지금까지의 추론 횟수 */
  private inferMs = 0;
  private inferN = 0;
  private poses: number = P.numPoses;
  /** 따라가던 사람의 어깨 중점(카메라 원본 x). 없으면 null */
  private mid: number | null = null;
  private fx = new OneEuro(P.filterMinCutoff, P.filterBeta);
  private fw = new OneEuro(0.5, 0);
  private origin: Tracked | null = null;

  get cameraOn() {
    return !!this.stream;
  }
  get modelReady() {
    return !!this.landmarker;
  }

  /** 모델과 WASM 을 미리 받아 둔다(타이틀 화면에서 호출). 실패하면 다음 호출 때 다시 시도. */
  preload(): Promise<void> {
    return (this.loading ??= this.create().catch((e) => {
      this.loading = undefined;
      throw e;
    }));
  }

  private async create(): Promise<void> {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(asset('mediapipe/wasm'));
    const make = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: asset('mediapipe/pose_landmarker_lite.task'), delegate },
        runningMode: 'VIDEO',
        numPoses: this.poses,
      });
    this.inferN = 0; // 새로 만든 모델은 다시 준비 시간을 거친다
    try {
      this.landmarker = await make(this.delegate);
    } catch (e) {
      if (this.delegate === 'CPU') throw e;
      console.warn('GPU delegate 실패, CPU 로 전환합니다', e);
      this.delegate = 'CPU';
      this.landmarker = await make('CPU');
    }
  }

  async startCamera(video: HTMLVideoElement): Promise<void> {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia 미지원');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    });
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    await video.play().catch(() => {}); // autoplay 속성이 있어 실패해도 곧 재생된다
    this.lastVideoTime = -1;
    this.schedule();
  }

  /** 카메라를 끈다. 영상은 어디에도 남지 않는다. */
  stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    if (this.video) this.video.srcObject = null;
    this.tracked = null;
    this.mid = null;
    this.fx.reset();
    this.fw.reset();
  }

  /** 지금 서 있는 자리를 기준점으로 삼는다 */
  calibrate(): void {
    if (this.tracked) this.origin = { ...this.tracked };
    this.state.x = 0;
  }

  private schedule(): void {
    const v = this.video;
    if (!v || !this.stream) return;
    if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(this.onFrame);
    else requestAnimationFrame(this.onFrame);
  }

  private onFrame = (): void => {
    const v = this.video;
    if (!v || !this.stream) return;
    const now = performance.now();
    if (
      this.landmarker &&
      v.readyState >= 2 &&
      v.currentTime !== this.lastVideoTime &&
      now - this.lastInferAt >= inferGapMs(this.inferMs) - 2
    ) {
      this.lastVideoTime = v.currentTime;
      this.lastInferAt = now;
      try {
        this.handle(this.landmarker.detectForVideo(v, now).landmarks, now);
        this.measure(performance.now() - now);
      } catch (e) {
        this.recover(e);
      }
    }
    this.schedule();
  };

  /**
   * 추론 시간을 재서 간격을 정하고(inferGapMs), 느린 기기는 1명 추적으로 한 번 낮춘다.
   * ponytail: 내리기만 한다. 새로고침하면 다시 2명부터 시작한다.
   */
  private measure(ms: number): void {
    const n = ++this.inferN - P.warmupFrames;
    if (n <= 0) return;
    this.inferMs += (ms - this.inferMs) * (n === 1 ? 1 : 0.1);
    if (this.poses > 1 && n > P.warmupFrames * 2 && this.inferMs > P.singlePoseMs) {
      this.poses = 1;
      this.inferN = 0;
      void this.landmarker?.setOptions({ numPoses: 1 }).catch((e) => console.warn('1명 추적 전환 실패', e));
    }
  }

  /** 일부 기기는 GPU delegate 가 생성은 되고 첫 추론에서 죽는다 → CPU 로 다시 만든다 */
  private recover(e: unknown): void {
    console.warn('포즈 추론 실패', e);
    this.landmarker?.close();
    this.landmarker = undefined;
    this.loading = undefined;
    if (this.delegate === 'CPU') return;
    this.delegate = 'CPU';
    void this.preload().catch(() => {});
  }

  private handle(poses: NormalizedLandmark[][], now: number): void {
    // 여러 명이면 따라가던 사람을 계속 따라간다(옆으로 피한 사이 가운데에 선 구경꾼으로 넘어가지 않게).
    // 따라가던 사람이 없으면 화면 가운데에 가장 가까운 사람.
    const best = pickPose(poses, this.mid ?? 0.5);
    this.draw(best);
    if (!best) {
      this.tracked = null;
      this.gesture = null;
      this.state.shield = false;
      if (now - this.seenAt > 500) {
        this.mid = null;
        this.fx.reset();
        this.fw.reset();
      }
      return;
    }
    const ls = best[L_SHOULDER];
    const rs = best[R_SHOULDER];
    const t = now / 1000;
    this.seenAt = now;
    this.mid = (ls.x + rs.x) / 2;
    this.tracked = {
      x: this.fx.filter(1 - (ls.x + rs.x) / 2, t), // 전면 카메라이므로 좌우 반전
      width: this.fw.filter(Math.abs(ls.x - rs.x), t),
    };
    if (this.origin) {
      const raw = (this.tracked.x - this.origin.x) / (this.origin.width * P.rangeShoulders);
      const mag = Math.max(0, Math.abs(raw) - P.deadzone) / (1 - P.deadzone);
      this.state.x = clamp1(Math.sign(raw) * mag);
    }
    const lw = best[L_WRIST];
    const rw = best[R_WRIST];
    // 메뉴용 몸짓. X 는 두 손목이 몸 가운데 선을 넘어 서로 반대쪽 어깨 앞(가슴 높이)에 있을 때
    const seen = (lw.visibility ?? 0) > P.minVisibility && (rw.visibility ?? 0) > P.minVisibility;
    const sw = Math.abs(ls.x - rs.x);
    const cx = (ls.x + rs.x) / 2;
    const side = Math.sign(ls.x - cx);
    const chest = (y: number, sy: number) => y > sy - sw * 0.5 && y < sy + sw * 1.2;
    const crossed =
      Math.sign(lw.x - cx) === -side && Math.sign(rw.x - cx) === side && Math.abs(lw.x - rw.x) > sw * 0.2 && chest(lw.y, ls.y) && chest(rw.y, rs.y);
    const nose = best[0];
    this.gesture = !seen ? null : nose && lw.y < nose.y && rw.y < nose.y ? 'up' : crossed ? 'cross' : null;
    this.state.shield =
      P.enableShield &&
      (lw.visibility ?? 0) > P.minVisibility &&
      (rw.visibility ?? 0) > P.minVisibility &&
      lw.y < ls.y - 0.03 &&
      rw.y < rs.y - 0.03;
  }

  private draw(lm: NormalizedLandmark[] | null): void {
    const c = this.overlay;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    if (!lm) return;
    g.fillStyle = '#5dffb0';
    for (const i of DOTS) {
      const p = lm[i];
      if (!p || (p.visibility ?? 0) < P.minVisibility) continue;
      g.beginPath();
      g.arc(p.x * c.width, p.y * c.height, c.width * 0.025, 0, Math.PI * 2);
      g.fill();
    }
  }
}
