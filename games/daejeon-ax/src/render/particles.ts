import * as THREE from 'three';

const MAX = 600;

/** 추진 불꽃·파편·반짝임을 한 풀에서 처리한다(드로우콜 1). */
export class Particles {
  readonly points: THREE.Points;
  /** 적응형 품질이 조절하는 방출량 배율 */
  rate = 1;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private col = new Float32Array(MAX * 3);
  private size = new Float32Array(MAX); // 셰이더로 가는 현재 크기
  private base = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private cursor = 0;
  private debt = 0;
  private material: THREE.ShaderMaterial;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute vec3 aColor;
        uniform float uScale;
        varying vec3 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uScale / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          gl_FragColor = vec4(vColor, smoothstep(0.5, 0.0, d));
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number) {
    const i = this.cursor;
    this.cursor = (i + 1) % MAX;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255], i * 3);
    this.base[i] = size;
    this.life[i] = this.maxLife[i] = life;
  }

  /** 사방으로 터지는 파편 */
  burst(x: number, y: number, z: number, count: number, speed: number, size: number, colors: number[]) {
    for (let n = Math.ceil(count * this.rate); n > 0; n--) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = speed * (0.3 + Math.random() * 0.7);
      const h = Math.sqrt(1 - u * u);
      this.emit(x, y, z, Math.cos(a) * h * s, u * s, Math.sin(a) * h * s, 0.4 + Math.random() * 0.5, size, colors[n % colors.length]);
    }
  }

  /** 캐릭터 뒤 추진 불꽃 (초당 perSec 개) */
  thrust(x: number, y: number, z: number, dt: number, perSec: number) {
    this.debt += perSec * this.rate * dt;
    for (; this.debt >= 1; this.debt--) {
      this.emit(
        x + (Math.random() - 0.5) * 0.35, y + (Math.random() - 0.5) * 0.15, z,
        (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, 7 + Math.random() * 5,
        0.25 + Math.random() * 0.25, 0.5, Math.random() < 0.5 ? 0x66d9ff : 0xfff0a0,
      );
    }
  }

  update(dt: number, pixelHeight: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.size[i] = 0;
        continue;
      }
      const j = i * 3;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.size[i] = this.base[i] * (this.life[i] / this.maxLife[i]);
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    this.material.uniforms.uScale.value = pixelHeight * 0.9;
  }
}
