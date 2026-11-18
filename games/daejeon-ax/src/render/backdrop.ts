import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import type { Particles } from './particles';
import { RECIPES, type Recipe } from './planets';

const S = CONFIG.scenery;
const T = S.tour;
const { lerp, clamp } = THREE.MathUtils;

interface StagePlanet {
  /** 위치·크기·기울기 */
  object: THREE.Group;
  /** 제자리에서 도는 본체 */
  body: THREE.Group;
  /** 재질 색(밝기 조절용). 본체와 빛나는 부분이 같은 색 객체를 본다 */
  shade: THREE.Color;
  orbiter?: THREE.Mesh;
  orbit?: Recipe['orbit'];
  /** 화면의 어느 쪽으로 지나가는지: -1 왼쪽, 1 오른쪽 */
  side: number;
  /** 다가오는 정도: 0 이면 멀리서 막 보이기 시작, 1 이면 옆을 지나가는 중, 그 뒤로는 화면 밖 */
  progress: number;
  /** 0~1: 나타나고 사라질 때의 크기 배율 */
  fade: number;
  /** 지금 화면에서의 반지름(월드 단위) */
  radius: number;
}

const FESTIVE = [
  [0xff5a7a, 0xffd0da, 0xffffff],
  [0xffd84d, 0xfff3b0, 0xffffff],
  [0x66d9ff, 0xc9f2ff, 0xffffff],
  [0x9dff8a, 0xe0ffd6, 0xffffff],
];
const LANTERN_COLORS = [0xffb347, 0xff8a5c, 0xffd84d, 0xff7aa8];

/**
 * 대전 관광 테마 우주 배경. 게임 로직과는 분리되어 있고 CONFIG.scenery 와 스테이지 목록만 읽는다.
 *
 * 행성은 스테이지마다 하나씩이다. 한 번에 지금 스테이지의 행성 하나만 나오며,
 * 스테이지가 진행되는 동안 멀리서 다가와 점점 커지다가 옆으로 지나간다(여행하며 그곳을 지나치는 느낌).
 * 다음 스테이지가 되면 앞의 행성은 화면 밖으로 빠져나가고 새 행성이 멀리서 나타난다.
 * 타이틀·선택 화면에서는 여행지 행성을 하나씩 돌아가며 보여 준다.
 *
 * 깊이: 먼 층은 하늘과 고정된 별, 중간 층이 스테이지 행성, 가까운 층이 떠오르는 등불(InstancedMesh 하나)과 별 먼지.
 */
export class Backdrop {
  readonly group = new THREE.Group();
  private planets: StagePlanet[] = [];
  private lanterns?: THREE.InstancedMesh;
  private lanternSeeds: { side: number; u: number; phase: number; speed: number; depth: number; sway: number }[] = [];
  private extras = true;
  private fireworkIn = 2;
  private finaleLeft = 0;
  // 배치 기준(플레이어가 가운데 있을 때의 카메라)
  private eye = new THREE.Vector3();
  private forward = new THREE.Vector3(0, 0, -1);
  private right = new THREE.Vector3(1, 0, 0);
  private up = new THREE.Vector3(0, 1, 0);
  private tanH = 1;
  private tanV = 1;

  constructor(private particles: Particles) {
    CONFIG.stages.forEach((stage, i) => {
      const recipe = RECIPES[stage.planet]();
      const shade = new THREE.Color();
      const lit = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, envMapIntensity: 0.5, fog: false });
      const glow = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
      lit.color = glow.color = shade;
      const body = new THREE.Group().add(new THREE.Mesh(mergeGeometries(recipe.lit), lit));
      if (recipe.glow?.length) body.add(new THREE.Mesh(mergeGeometries(recipe.glow), glow));
      const object = new THREE.Group().add(body);
      const side = i % 2 ? 1 : -1; // 스테이지마다 좌우를 번갈아
      object.rotation.set(0.42, 0, side * 0.3); // 꼭대기의 명소가 보이도록 카메라 쪽·화면 안쪽으로 기울인다
      object.visible = false;
      const planet: StagePlanet = { object, body, shade, orbit: recipe.orbit, side, progress: 0, fade: 0, radius: 1 };
      if (recipe.orbiter) {
        planet.orbiter = new THREE.Mesh(mergeGeometries(recipe.orbiter), lit);
        object.add(planet.orbiter);
      }
      this.planets.push(planet);
      this.group.add(object);
    });

    if (S.lanterns > 0) {
      // 축제 등불: 같은 모양을 여러 개 그리므로 인스턴싱(드로우콜 1)
      const mesh = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.62, 0.42, 1.25, 8),
        new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(S.brightness), fog: false }),
        S.lanterns,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (let i = 0; i < S.lanterns; i++) {
        mesh.setColorAt(i, new THREE.Color(LANTERN_COLORS[i % LANTERN_COLORS.length]));
        this.lanternSeeds.push({
          side: i % 2 ? 1 : -1,
          u: 0.52 + Math.random() * 0.46, // 가운데는 비우고 양옆 띠에서만 떠오른다
          phase: Math.random() * 2,
          speed: 0.035 + Math.random() * 0.04,
          depth: 38 + Math.random() * 26,
          sway: Math.random() * 6,
        });
      }
      this.lanterns = mesh;
      this.group.add(mesh);
    }
  }

  /**
   * 화면비·화각이 바뀔 때 배치 기준을 다시 잡는다.
   * @param fov 세로 화각(도) @param camDist 카메라가 플레이어 뒤로 물러난 거리
   */
  layout(fov: number, aspect: number, camDist: number): void {
    const C = CONFIG.camera;
    this.eye.set(0, (C.height * camDist) / C.dist, camDist);
    this.forward.set(0, 0.3, -14).sub(this.eye).normalize();
    this.right.crossVectors(this.forward, new THREE.Vector3(0, 1, 0)).normalize();
    this.up.crossVectors(this.right, this.forward);
    this.tanV = Math.tan((fov * Math.PI) / 360);
    this.tanH = this.tanV * aspect;
  }

  /** 품질 단계에 맞춰 장식(등불·불꽃)을 끈다 */
  setDetail(extras: boolean): void {
    this.extras = extras;
    if (this.lanterns) this.lanterns.visible = extras;
  }

  /** 완주 피날레: 몇 초 동안 하늘 여기저기서 불꽃이 이어진다 */
  finale(sec = 6): void {
    this.finaleLeft = sec;
  }

  /** 그 스테이지의 행성 위에서 불꽃을 터뜨린다(도착 연출) */
  celebrate(stage: number): void {
    const p = this.planets[stage];
    if (!p || !this.extras) return;
    for (let i = 0; i < 3; i++) this.fireworkAt(p.side * (0.25 + Math.random() * 0.5), 0.35 + Math.random() * 0.45);
  }

  /**
   * @param dt 프레임 시간(일시정지면 0) @param t 누적 시간
   * @param stage 지금 스테이지. 게임 중이 아니면 null(타이틀·선택 화면: 행성을 돌아가며 보여 준다)
   * @param stageProgress 그 스테이지가 얼마나 진행됐는지 0~1
   */
  update(dt: number, t: number, stage: number | null, stageProgress: number): void {
    const k = 1 - Math.exp(-5 * dt);
    const idle = stage === null;
    const current = idle ? Math.floor(t / T.idleSec) % this.planets.length : stage;
    const unit = Math.min(this.tanH, this.tanV) * S.planetSize;
    this.planets.forEach((p, i) => {
      if (i === current) {
        // 타이틀·선택 화면에서는 꽤 가까이 온 구간만 되풀이해 행성이 잘 보이게 한다
        p.progress = idle ? 0.55 + 0.33 * ((t % T.idleSec) / T.idleSec) : stageProgress;
        p.fade += (1 - p.fade) * k;
      } else if (p.fade > 0) {
        // 지난 행성: 게임 중이면 가던 길로 화면 밖까지 빠져나가고, 그 밖에는 그 자리에서 사라진다
        if (idle) p.fade = Math.max(0, p.fade - dt * 2.5);
        else if ((p.progress += dt * 0.45) > 1.6) p.fade = 0;
      }
      p.object.visible = p.fade > 0.01;
      if (!p.object.visible) return;

      const e = clamp(p.progress, 0, 2) ** T.ease;
      const size = lerp(T.from.size, T.to.size, e) * unit * p.fade;
      p.radius = size * T.depth;
      this.at(p.object.position, p.side * lerp(T.from.u, T.to.u, e), lerp(T.from.v, T.to.v, e), T.depth);
      p.object.position.y += Math.sin(t * 0.5 + i) * S.float * p.radius; // 부유
      p.object.scale.setScalar(p.radius);
      p.shade.setScalar(S.brightness * (0.72 + 0.28 * Math.min(1, e * 3))); // 멀리 있을 때는 조금 어둡게
      p.body.rotation.y += dt * S.spin; // 천천히 자전
      if (p.orbiter && p.orbit) {
        const a = t * p.orbit.speed;
        p.orbiter.position.set(Math.cos(a) * p.orbit.radius, p.orbit.height + Math.sin(a) * p.orbit.bob, Math.sin(a) * p.orbit.radius);
        if (p.orbit.align) p.orbiter.rotation.set(0, -(a + Math.PI / 2), 0); // 진행 방향(+X)을 궤도 접선에 맞춘다
        else p.orbiter.rotation.set(t * 0.7, t * 0.5, 0);
      }
    });
    if (!this.extras) return;

    if (this.lanterns) {
      const size = Math.min(this.tanH, this.tanV) * 0.014;
      this.lanternSeeds.forEach((s, i) => {
        const v = ((s.phase + t * s.speed) % 2) - 1; // 아래에서 위로 천천히, 끝에 닿으면 다시 아래에서
        this.at(_p, s.side * s.u + Math.sin(t * 0.4 + s.sway) * 0.03, v * 1.15, s.depth);
        _m.compose(_p, _q, _s.setScalar(size * s.depth * (1 - Math.abs(v) ** 6))); // 화면 위아래 끝에서 작아지며 사라진다
        this.lanterns!.setMatrixAt(i, _m);
      });
      this.lanterns.instanceMatrix.needsUpdate = true;
    }

    // 축제 불꽃: 가끔 지금 행성 위에서, 피날레 때는 하늘 여기저기서 터진다
    if (!S.fireworks || dt <= 0) return;
    this.finaleLeft = Math.max(0, this.finaleLeft - dt);
    this.fireworkIn -= dt;
    if (this.fireworkIn > 0) return;
    const [min, max] = S.fireworkEverySec;
    if (this.finaleLeft > 0) {
      this.fireworkIn = 0.18;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.fireworkAt(side * (0.3 + Math.random() * 0.65), 0.2 + Math.random() * 0.65);
      return;
    }
    this.fireworkIn = min + Math.random() * (max - min);
    const p = this.planets[current];
    if (p?.object.visible && p.progress < 0.85) {
      const { x, y, z } = p.object.position;
      this.burst(x + (Math.random() - 0.5) * p.radius * 2, y + p.radius * (1.7 + Math.random()), z, Math.max(p.radius, 5));
    }
  }

  /** 화면의 한 자리(u, v)에서 불꽃 하나 */
  private fireworkAt(u: number, v: number): void {
    this.at(_p, u, v, 100);
    this.burst(_p.x, _p.y, _p.z, 7);
  }

  private burst(x: number, y: number, z: number, radius: number): void {
    this.particles.burst(x, y, z, 34, radius * 1.6, 2.4, FESTIVE[Math.floor(Math.random() * FESTIVE.length)]);
  }

  /** 화면 좌표(u, v: -1~1)와 거리로 월드 위치를 구한다 */
  private at(out: THREE.Vector3, u: number, v: number, depth: number): THREE.Vector3 {
    return out
      .copy(this.eye)
      .addScaledVector(this.forward, depth)
      .addScaledVector(this.right, u * this.tanH * depth)
      .addScaledVector(this.up, v * this.tanV * depth);
  }
}

const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
