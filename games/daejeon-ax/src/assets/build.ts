import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * 절차적 모델(피규어·로켓) 공용 도구.
 * 부품마다 색을 정점 색으로 굽고 한 메시로 합쳐, 움직이는 부위 하나가 드로우콜 하나가 되게 한다.
 */

/** 광택 있는 피규어 재질. 텍스처 없이 정점 색만 쓰며 모든 부품이 공유한다. */
export const toyMaterial = new THREE.MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.4,
  clearcoat: 0.5,
  clearcoatRoughness: 0.18,
  fog: false,
});

export type Vec3 = [number, number, number];

/** 위치·회전(오일러)·크기로 변환 행렬을 만든다 */
export function at(p: Vec3 = [0, 0, 0], r: Vec3 = [0, 0, 0], s: number | Vec3 = 1): THREE.Matrix4 {
  const scale = typeof s === 'number' ? new THREE.Vector3(s, s, s) : new THREE.Vector3(...s);
  return new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    scale,
  );
}

/** 도형 하나를 제자리에 놓고 색을 입힌다. 합칠 수 있게 속성을 position·normal·color 로 통일한다. */
export function piece(geo: THREE.BufferGeometry, color: number, matrix?: THREE.Matrix4): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  if (matrix) g.applyMatrix4(matrix);
  const c = new THREE.Color(color);
  const colors = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

/** 조각들을 한 메시로 */
export const solid = (pieces: THREE.BufferGeometry[]) => new THREE.Mesh(mergeGeometries(pieces), toyMaterial);

export function starShape(outer: number, depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? outer * 0.45 : outer;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }).center();
}
