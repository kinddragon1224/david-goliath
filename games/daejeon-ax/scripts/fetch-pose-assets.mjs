// MediaPipe WASM과 포즈 모델을 public/mediapipe 에 넣는다(같은 출처 서빙용).
// @mediapipe/tasks-vision 버전을 올린 뒤에는 다시 실행할 것: npm run setup:pose
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

const out = 'public/mediapipe';
const model = `${out}/pose_landmarker_lite.task`;
const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';

mkdirSync(out, { recursive: true });
mkdirSync(`${out}/wasm`, { recursive: true });
// FilesetResolver.forVisionTasks(base) 가 쓰는 두 파일만 (module 변형은 불필요, 15MB 절약)
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'])
  cpSync(`node_modules/@mediapipe/tasks-vision/wasm/${f}`, `${out}/wasm/${f}`);
console.log('wasm 복사 완료');

if (!existsSync(model)) {
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error(`모델 다운로드 실패: ${res.status}`);
  writeFileSync(model, Buffer.from(await res.arrayBuffer()));
  console.log('모델 다운로드 완료');
}
