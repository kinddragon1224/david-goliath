import { CONFIG } from '../config';

export const lanesFor = (aspect: number) => (aspect < 1 ? CONFIG.field.lanesPortrait : CONFIG.field.lanesLandscape);

/** 운석이 놓이는 필드 전체의 반폭(레인 바깥 가장자리 + 여유) */
export const fieldHalf = (lanes: number) => (lanes * CONFIG.field.laneWidth) / 2 + 0.3;

/**
 * 화면비에 맞춰 세로 FOV와 카메라 거리를 정한다.
 * 플레이어 평면에서 필드 전체 폭이 화면에 들어오도록 FOV를 넓히고,
 * 상한(fovMax)에 걸리면 카메라를 뒤로 뺀다.
 */
export function fitCamera(aspect: number, lanes: number): { fov: number; dist: number } {
  const { dist, fovMin, fovMax } = CONFIG.camera;
  const half = fieldHalf(lanes);
  const deg = (tan: number) => (2 * Math.atan(tan) * 180) / Math.PI;
  const need = deg(half / dist / aspect);
  if (need <= fovMax) return { fov: Math.max(fovMin, need), dist };
  return { fov: fovMax, dist: half / (Math.tan((fovMax * Math.PI) / 360) * aspect) };
}
