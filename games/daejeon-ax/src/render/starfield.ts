import * as THREE from 'three';

const DEPTH = 320;

/** 앞에서 뒤로 흘러가는 별 먼지. 위치 이동은 전부 버텍스 셰이더에서 한다(드로우콜 1). */
export class Starfield {
  readonly points: THREE.Points;
  private material: THREE.ShaderMaterial;

  constructor(max: number) {
    const pos = new Float32Array(max * 3);
    const size = new Float32Array(max);
    for (let i = 0; i < max; i++) {
      let x = 0;
      let y = 0;
      // 플레이 구역 바로 근처는 비워서 운석과 헷갈리지 않게 한다
      do {
        x = (Math.random() * 2 - 1) * 70;
        y = (Math.random() * 2 - 1) * 40;
      } while (Math.abs(x) < 9 && Math.abs(y) < 4);
      pos.set([x, y, Math.random() * DEPTH], i * 3);
      size[i] = 0.6 + Math.random() * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uOffset: { value: 0 }, uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        uniform float uOffset, uScale;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.z = mod(p.z + uOffset, ${DEPTH}.0) - ${DEPTH - 20}.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.0, aSize * uScale / -mv.z);
          vAlpha = smoothstep(-${DEPTH - 20}.0, -${DEPTH - 90}.0, p.z);
        }`,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(0.82, 0.9, 1.0, smoothstep(0.5, 0.1, d) * vAlpha);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  setCount(n: number) {
    this.points.geometry.setDrawRange(0, n);
  }

  /** @param pixelHeight 드로잉 버퍼 높이(점 크기 기준) */
  update(distance: number, pixelHeight: number) {
    this.material.uniforms.uOffset.value = (this.material.uniforms.uOffset.value + distance) % DEPTH;
    this.material.uniforms.uScale.value = pixelHeight * 0.35;
  }
}
