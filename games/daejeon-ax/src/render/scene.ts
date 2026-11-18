import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { starShape } from '../assets/build';
import type { Rig } from '../assets/figure';
import { CHARACTERS, CONFIG, type CharacterId } from '../config';
import type { World } from '../game/world';
import { Backdrop } from './backdrop';
import { CharacterView } from './character';
import { fitCamera } from './fit';
import { Particles } from './particles';
import type { QualityLevel } from './quality';
import { StageFx } from './stagefx';
import { Starfield } from './starfield';

/** idle: 타이틀 배경 / select: 두 캐릭터가 정면으로 / game: 고른 캐릭터를 뒤에서 따라감 */
export type ViewMode = 'idle' | 'select' | 'game';

const ROCK_KINDS = 4;
const ROCK_CAP = 24; // 종류별 동시 표시 상한 (실제로는 화면에 4~5 웨이브 × 최대 4개)
const GEM_CAP = 16;
const FOG = 0x080a24;

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly particles = new Particles();
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);
  private stars = new Starfield(CONFIG.quality.levels[0].stars);
  private rocks: THREE.InstancedMesh[] = [];
  private gems: THREE.InstancedMesh;
  private backdrop = new Backdrop(this.particles);
  private fx = new StageFx(this.particles);
  private reduced = false;
  private extras = true;
  private characters = {} as Record<CharacterId, CharacterView>;
  private shield: THREE.Mesh;
  private camPos = new THREE.Vector3(0, CONFIG.camera.height, CONFIG.camera.dist);
  private camLook = new THREE.Vector3(0, 0.3, -14);
  private roll = 0;
  private shake = 0;
  private clock = 0;
  private lanes: number = CONFIG.field.lanesLandscape;
  private fit = { fov: 60, dist: CONFIG.camera.dist as number };

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene.fog = new THREE.Fog(FOG, 65, CONFIG.field.spawnZ + 12);
    // 광택 재질(피규어·로켓)에 비칠 스튜디오 조명 환경. 한 번만 굽는다.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x241a40, 1.0));
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.9);
    sun.position.set(-4, 6, 5);
    this.scene.add(sun);

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 32, 16),
      new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    sky.renderOrder = -1;
    this.scene.add(sky, this.stars.points, this.particles.points);

    this.scene.add(this.backdrop.group, this.fx.group);

    const tints = [0x9a8674, 0x7d7f8c, 0xa07a5c, 0x8b7f9a];
    for (let k = 0; k < ROCK_KINDS; k++) {
      const mesh = new THREE.InstancedMesh(
        rockGeometry(k + 1),
        new THREE.MeshStandardMaterial({ color: tints[k], roughness: 1, flatShading: true }),
        ROCK_CAP,
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.rocks.push(mesh);
    }
    this.gems = new THREE.InstancedMesh(
      starShape(0.5, 0.18),
      new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffa800, emissiveIntensity: 1.1, fog: false }),
      GEM_CAP,
    );
    this.gems.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.gems.frustumCulled = false;
    this.gems.count = 0;

    this.shield = new THREE.Mesh(
      new THREE.SphereGeometry(1.3, 20, 12),
      new THREE.MeshBasicMaterial({
        color: 0x66ccff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }),
    );
    this.shield.visible = false;
    this.shield.scale.set(0.95, 1.05, 1.2); // 로켓과 그 위의 캐릭터를 함께 감싸게
    this.scene.add(...this.rocks, this.gems, this.shield);

    addEventListener('resize', () => this.resize());
    this.resize();
  }

  setCharacter(id: CharacterId, rig: Rig) {
    this.characters[id] = new CharacterView(rig);
    this.scene.add(this.characters[id].root);
  }

  /** 새 스테이지에 도착했을 때: 그 스테이지의 행성 쪽 하늘에 불꽃을 터뜨린다 */
  arrive(stage: number) {
    this.backdrop.celebrate(stage);
  }

  setLanes(lanes: number) {
    this.lanes = lanes;
    this.resize();
  }

  applyQuality(q: QualityLevel) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixelRatio));
    this.stars.setCount(q.stars);
    this.particles.rate = q.particles;
    this.extras = q.extras;
    this.backdrop.setDetail(q.extras && !this.reduced);
    this.resize();
  }

  resize() {
    // 크기 0 으로 열리는 경우(백그라운드 탭·접힌 창)에 화면비가 NaN 이 되면 카메라가 영영 망가진다
    const w = innerWidth || 1;
    const h = innerHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fit = fitCamera(w / h, this.lanes);
    this.backdrop.layout(this.fit.fov, w / h, this.fit.dist);
  }

  /** 효과 줄이기: 화면 흔들림·깜빡임·불꽃을 끈다(번쩍임에 민감한 사람과 저사양 기기용) */
  setReduced(on: boolean) {
    this.reduced = this.fx.reduced = on;
    this.backdrop.setDetail(this.extras && !on);
  }

  /** 완주 피날레: 모든 여행지 위에서 축제 불꽃이 터진다 */
  finale() {
    this.backdrop.finale();
  }

  /** 운석이 부서지거나 사라질 때 */
  smashFx(x: number) {
    this.particles.burst(x, 0, -0.6, this.reduced ? 10 : 26, 10, 0.8, [0xffd84d, 0xff8a5c, 0xffffff]);
  }
  /** 음식을 먹었을 때 */
  foodFx(x: number) {
    this.particles.burst(x, 0.3, 0, this.reduced ? 10 : 28, 7, 0.8, [0xffd84d, 0xfff7c2, 0x9dff8a, 0xffffff]);
  }
  /** 보스를 넘겼을 때 */
  bossDownFx() {
    this.fx.bossDown();
  }

  /** 충돌 */
  hitFx(x: number, dead: boolean) {
    this.shake = this.reduced ? 0 : dead ? 1 : 0.6;
    this.particles.burst(x, 0, 0, dead ? 90 : 45, dead ? 14 : 10, 0.9, [0xffb347, 0xff6b3d, 0xb9a79a, 0xffffff]);
  }
  /** 보호막이 운석을 부숨 */
  blockFx(x: number) {
    this.shake = this.reduced ? 0 : 0.25;
    this.particles.burst(x, 0, -0.5, 30, 9, 0.8, [0x66ccff, 0xb9a79a, 0xffffff]);
  }
  /** 별 조각 획득 */
  starFx(x: number) {
    this.particles.burst(x, 0.2, 0, 18, 6, 0.7, [0xffe066, 0xfff7c2, 0xffffff]);
  }

  /**
   * @param speed 배경이 흐르는 속도(일시정지면 0)
   * @param dt 일시정지 중에는 0 을 넘긴다
   */
  update(dt: number, mode: ViewMode, world: World | null, selected: CharacterId, speed: number) {
    this.clock += dt;
    const t = this.clock;
    const px = mode === 'game' && world ? world.player.x : 0;
    const vx = mode === 'game' && world ? world.player.vx : 0;
    const pixelHeight = this.renderer.domElement.height;

    this.stars.update(speed * dt * 0.7, pixelHeight);
    // 배경: 게임 중에는 지금 스테이지의 행성 하나만, 그 밖에는 여행지 행성을 돌아가며 보여 준다
    const playing = mode === 'game' && !!world;
    this.backdrop.update(dt, t, playing ? world.stage : null, playing ? world.stageTime / CONFIG.difficulty.stepSec : 0);

    // 캐릭터
    // 선택 화면: 화면을 캐릭터 수만큼 나눈 칸의 한가운데(이름표 바로 위)에 세운다
    const ids = Object.keys(CHARACTERS) as CharacterId[];
    const halfVisible = Math.tan((this.fit.fov * Math.PI) / 360) * this.camera.aspect * this.fit.dist * 0.85;
    const halfVisibleY = halfVisible / this.camera.aspect;
    // 선택 화면의 크기: 설정값을 넘지 않으면서 화면 높이·너비 안에 여유 있게 들어오도록
    const selectScale = Math.min(CONFIG.character.selectScale, halfVisibleY * 0.57, (halfVisible / ids.length) * 0.68);
    const invuln = world && !world.over ? world.invuln : 0;
    ids.forEach((id, i) => {
      // 로딩이 끝난 순서가 아니라 고정된 순서로 배치한다(선택 화면의 이름표와 맞아야 함)
      this.characters[id]?.update({
        mode: mode === 'select' ? 'select' : mode === 'game' && id === selected ? 'game' : 'hidden',
        dt,
        x: mode === 'select' ? ((i + 0.5) / ids.length - 0.5) * 2 * halfVisible : px,
        scale: mode === 'select' ? selectScale : CONFIG.character.gameScale,
        vx,
        hit: THREE.MathUtils.clamp((invuln - (CONFIG.player.invulnSec - 0.6)) / 0.6, 0, 1),
        blink: !this.reduced && invuln > 0 && Math.floor(invuln * 12) % 2 === 0,
        over: !!world?.over && !world.cleared,
        cheer: !!world?.cleared,
      });
    });
    const me = this.characters[selected];
    if (me && mode === 'game' && dt > 0 && !world?.over) this.particles.thrust(px, me.thrustY, me.thrustZ, dt, 70);
    this.particles.update(dt, pixelHeight);

    // 보호 중임을 알리는 구: 무적 별 잔치(금색), 보호막(파랑), 방어 1회분(주황), 카메라 재인식 직후 보호(연두)
    this.shield.visible =
      mode === 'game' && !!world && !world.over && (world.starpower > 0 || world.shield > 0 || world.guard > 0 || world.protect > 0);
    if (this.shield.visible && world) {
      const material = this.shield.material as THREE.MeshBasicMaterial;
      this.shield.position.set(px, 0.3, 0);
      material.color.setHex(world.starpower > 0 ? 0xffd84d : world.shield > 0 ? 0x66ccff : world.guard > 0 ? 0xff9a5c : 0x9dff8a);
      const steady = world.starpower <= 0 && world.shield <= 0; // 방어·보호는 잔잔하게
      material.opacity = (steady ? 0.13 : 0.22) + (this.reduced || steady ? 0 : Math.sin(t * 8) * 0.06);
    }
    this.fx.update(dt, t, mode === 'game' ? world : null);

    this.syncInstances(mode === 'game' ? world : null, t);

    // 카메라: 좌우 이동을 부드럽게 따라가며 살짝 기울인다
    const C = CONFIG.camera;
    const k = 1 - Math.exp(-6 * Math.max(dt, 1 / 240));
    const d = this.fit.dist;
    if (mode === 'select') {
      this.camPos.lerp(_v.set(0, 0.9, d * 0.85), k);
      this.camLook.lerp(_v.set(0, 0.45, 0), k);
    } else {
      this.camPos.lerp(_v.set(px * C.follow, (C.height * d) / C.dist, d), k);
      this.camLook.lerp(_v.set(px * (C.follow + 0.2), 0.3, -14), k);
    }
    this.roll += (-vx * C.roll - this.roll) * k;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const s = this.shake * this.shake * 0.5;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * s,
      this.camPos.y + (Math.random() - 0.5) * s,
      this.camPos.z,
    );
    this.camera.lookAt(this.camLook);
    this.camera.rotateZ(this.roll);
    // 속도가 오를수록 화각을 조금 넓혀 속도감을 준다(넓어지는 쪽이라 필드는 계속 다 보인다)
    const kick = mode === 'game' ? Math.max(0, speed - (world?.preset.speedBase ?? speed)) * 0.14 : 0;
    this.camera.fov += (this.fit.fov + kick - this.camera.fov) * k;
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
  }

  private syncInstances(world: World | null, t: number) {
    const counts = new Array<number>(ROCK_KINDS).fill(0);
    let gems = 0;
    if (world) {
      for (const m of world.meteors) {
        const kind = m.id % ROCK_KINDS;
        if (counts[kind] >= ROCK_CAP) continue;
        const spin = t * (0.5 + (m.id % 5) * 0.22);
        _q.setFromEuler(_e.set(spin + m.id, spin * 0.7 + m.id * 2, m.id));
        _m.compose(_v.set(m.x, 0, m.z), _q, _s.setScalar(m.r));
        this.rocks[kind].setMatrixAt(counts[kind]++, _m);
      }
      for (const g of world.pickups) {
        if (g.kind && g.kind !== 'star') continue; // 음식은 StageFx 가 그린다
        if (gems >= GEM_CAP) break;
        _q.setFromEuler(_e.set(0, t * 3 + g.id, 0));
        _m.compose(_v.set(g.x, 0.1 + Math.sin(t * 4 + g.id) * 0.12, g.z), _q, _s.setScalar(1));
        this.gems.setMatrixAt(gems++, _m);
      }
    }
    this.rocks.forEach((r, kind) => {
      r.count = counts[kind];
      r.instanceMatrix.needsUpdate = true;
    });
    this.gems.count = gems;
    this.gems.instanceMatrix.needsUpdate = true;
  }
}

const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();

/** 저폴리 불규칙 암석. 같은 위치의 정점은 같은 양만큼 밀어야 면이 벌어지지 않는다. */
function rockGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = Math.round(v.x * 100) * 12.9898 + Math.round(v.y * 100) * 78.233 + Math.round(v.z * 100) * 37.719;
    const h = Math.sin(key + seed * 4.7) * 43758.5453;
    v.multiplyScalar(0.72 + (h - Math.floor(h)) * 0.42);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** 성운 느낌의 그라디언트 하늘 + 멀리 고정된 별. 한 번만 그려 텍스처로 쓴다. */
function skyTexture(): THREE.Texture {
  const W = 2048;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#03041a');
  bg.addColorStop(0.5, '#0a0d2e');
  bg.addColorStop(1, '#14082e');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  // 카메라가 보는 방향(-Z)은 텍스처의 u=0.75 근처
  const blobs: [number, number, number, string][] = [
    [1400, 430, 430, 'rgba(110,60,210,0.42)'],
    [1710, 560, 380, 'rgba(30,110,230,0.32)'],
    [1540, 650, 300, 'rgba(230,70,160,0.22)'],
    [1260, 310, 300, 'rgba(30,190,200,0.16)'],
    [1860, 380, 260, 'rgba(255,140,80,0.10)'],
    [420, 500, 520, 'rgba(90,50,180,0.25)'],
  ];
  for (const [x, y, r, color] of blobs) {
    for (const ox of [-W, 0, W]) {
      const rg = g.createRadialGradient(x + ox, y, 0, x + ox, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(x + ox - r, y - r, r * 2, r * 2);
    }
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.6})`;
    const s = Math.random() < 0.85 ? 1 : 2;
    g.fillRect(Math.random() * W, Math.random() * H, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
