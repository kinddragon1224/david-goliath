import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

/** TV 전용: 손 인식을 화면 그리기와 따로 돌린다. 약한 칩에서 인식이 화면을 멈추지 않게. */
type Init = { type: "init"; opts: Parameters<typeof PoseLandmarker.createFromOptions>[1] };
type Frame = { type: "frame"; bitmap: ImageBitmap; ts: number; at: number; aspect: number };

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);
let landmarker: PoseLandmarker | null = null;

self.onmessage = async (e: MessageEvent<Init | Frame>) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      let delegate: "GPU" | "CPU" = "GPU";
      try {
        landmarker = await PoseLandmarker.createFromOptions(fileset, m.opts);
      } catch {
        delegate = "CPU";
        landmarker = await PoseLandmarker.createFromOptions(fileset, {
          ...m.opts,
          baseOptions: { ...m.opts.baseOptions, delegate },
        });
      }
      post({ type: "ready", delegate });
    } catch (err) {
      post({ type: "fail", message: String(err) });
    }
    return;
  }
  const started = performance.now();
  try {
    const r = landmarker?.detectForVideo(m.bitmap, m.ts);
    post({
      type: "result",
      landmarks: r?.landmarks ?? [],
      world: r?.worldLandmarks ?? [],
      at: m.at,
      aspect: m.aspect,
      ms: performance.now() - started,
    });
  } catch {
    post({ type: "result", landmarks: [], world: [], at: m.at, aspect: m.aspect, ms: 0 });
  }
  m.bitmap.close();
};
