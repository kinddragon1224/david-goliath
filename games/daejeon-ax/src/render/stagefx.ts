import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, piece, starShape, toyMaterial } from '../assets/build';
import { CONFIG } from '../config';
import { isFiring } from '../game/boss/laser';
import { FOOD_IDS, FOODS, type FoodId, type Rarity } from '../game/config/items';
import type { BossId } from '../game/config/stages';
import type { World } from '../game/world';
import type { Particles } from './particles';

const FOOD_CAP = 8;
const LASER_CAP = 8;
const BOSS_HOME = new THREE.Vector3(0, 13, -85);
const flat: [number, number, number] = [Math.PI / 2, 0, 0];
const TAU = Math.PI * 2;

const ball = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const cyl = (top: number, bottom: number, height: number, seg = 16) => new THREE.CylinderGeometry(top, bottom, height, seg);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const torus = (r: number, tube: number, seg = 16, arc = TAU) => new THREE.TorusGeometry(r, tube, 6, seg, arc);
const GREEN = 0x4fae5a;

/** 음식임을 알리는 고리. 희귀도에 따라 색이 다르고, 전설은 두 겹이다(운석과 한눈에 구분된다) */
const HALO: Record<Rarity, number> = { common: 0xffd84d, rare: 0x8fb4ff, legendary: 0xff7ad9 };
function halo(rarity: Rarity): THREE.BufferGeometry[] {
  const rings = [piece(torus(0.8, 0.04, 28), HALO[rarity], at([0, 0, 0], flat))];
  if (rarity === 'legendary') rings.push(piece(torus(0.95, 0.03, 28), 0xffffff, at([0, 0, 0], flat)));
  return rings;
}
/** 뚝배기·그릇 */
const pot = (color: number, soup: number) => [
  piece(cyl(0.48, 0.36, 0.38), color, at([0, -0.06, 0])),
  piece(cyl(0.44, 0.44, 0.04), soup, at([0, 0.12, 0])),
];
/** 뜨거운 김 */
const steam = () => [piece(ball(0.11, 8, 6), 0xffffff, at([0.05, 0.5, 0])), piece(ball(0.08, 8, 6), 0xffffff, at([-0.08, 0.7, 0.03]))];

/**
 * 음식 모형: 기본 도형 몇 개를 합친 고유한 3D 아이콘(인스턴싱으로 그린다).
 * 실제 제품 포장·상표·로고는 재현하지 않고 음식의 생김새만 단순하게 나타낸다.
 */
const FOOD_MODELS: Record<FoodId, () => THREE.BufferGeometry[]> = {
  // 튀김소보로: 울퉁불퉁한 소보로가 붙은 노릇한 빵
  soboro: () => {
    const parts = [piece(ball(0.5, 14, 10), 0xd39a52, at(undefined, undefined, [1, 0.82, 1]))];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const up = 0.15 + (i % 3) * 0.13;
      parts.push(piece(ball(0.13, 6, 5), i % 2 ? 0xe8bd7a : 0xc98a3d, at([Math.cos(a) * (0.45 - up * 0.5), up, Math.sin(a) * (0.45 - up * 0.5)])));
    }
    return parts;
  },
  // 딸기시루: 초콜릿 시트 위에 크림과 딸기를 쌓은 케이크
  strawberry: () => {
    const parts = [
      piece(cyl(0.48, 0.48, 0.2), 0x4a2c20, at([0, -0.18, 0])),
      piece(cyl(0.48, 0.48, 0.07), 0xfff6ea, at([0, -0.045, 0])),
      piece(cyl(0.48, 0.48, 0.18), 0x4a2c20, at([0, 0.08, 0])),
      piece(cyl(0.5, 0.5, 0.06), 0xfff6ea, at([0, 0.2, 0])),
    ];
    for (let i = 0; i < 7; i++) {
      const a = (i / 6) * TAU;
      const r = i === 6 ? 0 : 0.3;
      parts.push(piece(new THREE.ConeGeometry(0.12, 0.2, 8), 0xe5263a, at([Math.cos(a) * r, 0.33, Math.sin(a) * r], [Math.PI, 0, 0])));
    }
    return parts;
  },
  // 물총칼국수: 흰 그릇에 담긴 면과 젓가락
  kalguksu: () => [
    piece(cyl(0.52, 0.3, 0.36), 0xf4f4f0, at([0, -0.08, 0])),
    piece(ball(0.46, 14, 8), 0xf3dfa8, at([0, 0.08, 0], undefined, [1, 0.32, 1])),
    piece(ball(0.07, 6, 5), GREEN, at([0.12, 0.2, 0.05])),
    piece(ball(0.06, 6, 5), GREEN, at([-0.14, 0.2, -0.08])),
    piece(cyl(0.018, 0.018, 0.85, 5), 0x8a5a3c, at([0.16, 0.36, 0], [0, 0, -0.75])),
    piece(cyl(0.018, 0.018, 0.85, 5), 0x8a5a3c, at([0.24, 0.36, 0.06], [0, 0, -0.75])),
  ],
  // 두부두루치기: 넓은 냄비의 빨간 양념 위에 네모난 두부
  dubu: () => [
    piece(cyl(0.54, 0.44, 0.22), 0x3a3a40, at([0, -0.1, 0])),
    piece(cyl(0.5, 0.5, 0.04), 0xd03a24, at([0, 0.02, 0])),
    piece(box(0.24, 0.16, 0.24), 0xfffdf2, at([-0.18, 0.1, 0.1], [0, 0.4, 0])),
    piece(box(0.24, 0.16, 0.24), 0xfffdf2, at([0.2, 0.1, 0.02], [0, -0.3, 0])),
    piece(box(0.22, 0.16, 0.22), 0xfffdf2, at([0, 0.1, -0.24], [0, 0.8, 0])),
    piece(ball(0.06, 6, 5), GREEN, at([0.02, 0.1, 0.24])),
  ],
  // 소국밥: 뚝배기에 담긴 붉은 국과 밥, 뜨거운 김
  gukbap: () => [
    ...pot(0x2a2a2f, 0xb04a2a),
    piece(ball(0.2, 10, 6), 0xffffff, at([-0.06, 0.15, 0], undefined, [1, 0.5, 1])),
    piece(ball(0.06, 6, 5), GREEN, at([0.2, 0.17, 0.08])),
    ...steam(),
  ],
  // 순대국밥: 뽀얀 국물에 동글동글한 순대
  sundae: () => {
    const parts = [...pot(0x2a2a2f, 0xf0e6d2), ...steam()];
    for (const [x, z] of [[-0.18, 0.08], [0.16, 0.12], [0.02, -0.2]]) {
      parts.push(piece(cyl(0.12, 0.12, 0.06, 10), 0x3b2a2a, at([x, 0.16, z])));
      parts.push(piece(cyl(0.07, 0.07, 0.07, 8), 0x8a6a5a, at([x, 0.16, z])));
    }
    return parts;
  },
  // 판타롱부추빵: 길쭉한 빵 속에 초록 부추가 비친다
  buchu: () => {
    const parts = [piece(new THREE.CapsuleGeometry(0.3, 0.5, 6, 12), 0xdba657, at(undefined, [0, 0, Math.PI / 2], [1, 1, 0.9]))];
    for (let i = 0; i < 7; i++) parts.push(piece(ball(0.07, 6, 5), GREEN, at([-0.36 + i * 0.12, 0.26 - Math.abs(i - 3) * 0.03, i % 2 ? 0.1 : -0.1])));
    return parts;
  },
  // 오징어두루치기: 접시 위 매콤한 양념과 동그란 오징어 링
  squid: () => [
    piece(cyl(0.56, 0.4, 0.1), 0xf7f5ef, at([0, -0.12, 0])),
    piece(ball(0.4, 12, 8), 0xd43a20, at([0, 0, 0], undefined, [1, 0.42, 1])),
    piece(torus(0.14, 0.05, 12), 0xffb08a, at([-0.14, 0.17, 0.08], [1.2, 0, 0.3])),
    piece(torus(0.13, 0.05, 12), 0xffb08a, at([0.18, 0.16, -0.04], [1.4, 0.4, 0])),
    piece(torus(0.11, 0.045, 12), 0xffb08a, at([0, 0.2, -0.2], [1.1, 0, -0.4])),
    piece(ball(0.06, 6, 5), GREEN, at([0.05, 0.2, 0.2])),
  ],
  // 꿈돌이 라면: 노란 그릇에 꼬불꼬불한 면, 그 위에 꿈돌이의 파란 별
  ramen: () => [
    piece(cyl(0.5, 0.32, 0.38), 0xffc800, at([0, -0.08, 0])),
    piece(torus(0.3, 0.07, 16), 0xf7e08a, at([0, 0.12, 0], flat)),
    piece(torus(0.16, 0.07, 12), 0xf7e08a, at([0.04, 0.16, 0.02], flat)),
    piece(starShape(0.2, 0.08), 0x6cb9ea, at([0, 0.38, 0])),
  ],
};

const BOSS_LOOK: Record<BossId, { scale: number; tint: number; eye: number; ring: boolean }> = {
  vortex: { scale: 5, tint: 0x9fd0ff, eye: 0x6ff0ff, ring: true },
  expo: { scale: 6, tint: 0xffffff, eye: 0xff4a4a, ring: false },
  king: { scale: 8, tint: 0xffb0d8, eye: 0xff3fd0, ring: true },
};

/**
 * 스테이지 연출: 음식 아이템, 보스와 레이저, 낙엽바람, 온천 안개, 피버·별 잔치 불티.
 * 게임 규칙(World)을 읽기만 하고 바꾸지 않는다. 드로우콜은 음식 종류별 1, 레이저 1, 보스 3.
 */
export class StageFx {
  readonly group = new THREE.Group();
  /** 번쩍임·흔들림을 줄인 모드 */
  reduced = false;
  private foods = {} as Record<FoodId, THREE.InstancedMesh>;
  private beams: THREE.InstancedMesh;
  private boss = new THREE.Group();
  private body: THREE.MeshStandardMaterial;
  private eye: THREE.Mesh;
  private ring: THREE.Mesh;
  private bossIn = 0; // 0: 화면 밖, 1: 제자리
  private bossId: BossId = 'expo';
  private debt = { leaf: 0, spark: 0, fog: 0 };

  constructor(private particles: Particles) {
    for (const id of FOOD_IDS) {
      const mesh = new THREE.InstancedMesh(mergeGeometries([...FOOD_MODELS[id](), ...halo(FOODS[id].rarity)]), toyMaterial, FOOD_CAP);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.foods[id] = mesh;
      this.group.add(mesh);
    }

    // 레이저: 레인을 따라 길게 뻗은 상자. 경고 때는 바닥의 흐린 띠, 발사 때는 밝은 벽
    this.beams = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }),
      LASER_CAP,
    );
    this.beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.beams.frustumCulled = false;
    this.beams.count = 0;
    this.group.add(this.beams);

    // 보스: 왕관을 쓴 커다란 운석. 유형에 따라 크기·색·둘레의 돌 고리가 달라진다
    const rock = new THREE.IcosahedronGeometry(1, 1);
    const parts = [piece(rock, 0x4a3b6b)];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      parts.push(piece(new THREE.ConeGeometry(0.2, 0.55, 5), 0xffd84d, at([Math.cos(a) * 0.55, 0.95, Math.sin(a) * 0.55 * 0.6])));
    }
    for (const s of [1, -1]) parts.push(piece(new THREE.ConeGeometry(0.22, 0.7, 6), 0x2f2547, at([s * 1.0, 0.1, 0.2], [0, 0, -s * 1.3])));
    this.body = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, fog: false });
    this.boss.add(new THREE.Mesh(mergeGeometries(parts), this.body));
    this.eye = new THREE.Mesh(ball(0.32, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff4a4a, fog: false }));
    this.eye.position.set(0, 0.05, 0.86);
    const stones: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      stones.push(piece(new THREE.IcosahedronGeometry(0.16 + (i % 3) * 0.05, 0), 0x8b7f9a, at([Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9])));
    }
    this.ring = new THREE.Mesh(mergeGeometries(stones), this.body);
    this.boss.add(this.eye, this.ring);
    this.boss.visible = false;
    this.group.add(this.boss);
  }

  /** 보스를 넘겼을 때: 터지며 물러난다 */
  bossDown(): void {
    const p = this.boss.position;
    this.particles.burst(p.x, p.y, p.z, this.reduced ? 30 : 90, 26, 2.4, [0xffd84d, 0xff8a5c, 0xffffff, 0xb9a7ff]);
  }

  /** @param dt 프레임 시간(일시정지면 0) @param world 게임 중이 아니면 null */
  update(dt: number, t: number, world: World | null): void {
    this.syncFoods(world, t);
    this.syncBeams(world, t);

    // 보스: 보스 스테이지에서 위에서 내려오고, 끝나면 올라간다
    const boss = world && !world.over ? world.stageDef.boss : undefined;
    if (boss) this.bossId = boss;
    const look = BOSS_LOOK[this.bossId];
    this.bossIn += ((boss ? 1 : 0) - this.bossIn) * (1 - Math.exp(-2.2 * dt));
    this.boss.visible = this.bossIn > 0.01;
    if (this.boss.visible) {
      const firing = !!world && world.lasers.some((l) => isFiring(l, world.speed));
      this.boss.scale.setScalar(look.scale);
      this.body.color.setHex(look.tint);
      (this.eye.material as THREE.MeshBasicMaterial).color.setHex(look.eye);
      this.ring.visible = look.ring;
      this.ring.rotation.set(0.5, t * 1.4, 0.2);
      this.boss.position.set(BOSS_HOME.x + Math.sin(t * 0.7) * 6, BOSS_HOME.y + (1 - this.bossIn) * 40 + Math.sin(t * 1.3) * 0.8, BOSS_HOME.z);
      this.boss.rotation.set(0.25, Math.sin(t * 0.5) * 0.3, Math.sin(t * 0.9) * 0.08);
      this.eye.scale.setScalar(firing ? 1.5 : 1 + Math.sin(t * 2) * 0.08);
    }
    if (!world || dt <= 0 || world.over) return;
    const emit = (key: 'leaf' | 'spark' | 'fog', perSec: number, make: () => void) => {
      this.debt[key] += dt * perSec * (this.reduced ? 0.35 : 1);
      for (; this.debt[key] >= 1; this.debt[key]--) make();
    };

    // 낙엽바람: 바람이 부는 방향으로 낙엽이 흘러가 어느 쪽으로 밀리는지 보여 준다
    const wind = world.wind;
    if (wind) {
      emit('leaf', 16, () => {
        const side = -Math.sign(wind) * (world.halfWidth + 5);
        this.particles.emit(
          side, Math.random() * 3.5, -34 + Math.random() * 36,
          wind * 3.2, -0.4 + Math.random() * 0.8, world.speed * 0.2,
          1.7, 0.55, [0xe39a3b, 0xd9772b, 0x9fc45a][Math.floor(Math.random() * 3)],
        );
      });
    }
    // 유성온천 안개: 화면 양옆 외곽에서만 김이 피어오른다(가운데 시야는 가리지 않는다)
    if (world.eventOn('fog')) {
      emit('fog', 14, () => {
        const side = Math.random() < 0.5 ? -1 : 1;
        this.particles.emit(
          side * (world.halfWidth + 3 + Math.random() * 6), -1 + Math.random() * 2, -30 + Math.random() * 32,
          side * 0.4, 1.6 + Math.random(), world.speed * 0.15,
          2.2, 2.6, 0x9aa6b8,
        );
      });
    }
    // 대전 피버·별 잔치: 캐릭터 주위에 반짝이는 불티
    if (world.fever > 0 || world.starpower > 0) {
      emit('spark', 30, () => {
        const a = Math.random() * TAU;
        this.particles.emit(
          world.player.x + Math.cos(a) * 1.1, 0.4 + Math.sin(a) * 1.1, 0.2,
          Math.cos(a) * 1.5, Math.sin(a) * 1.5 + 1, 6,
          0.45, 0.6, [0xffd84d, 0xff7aa8, 0xffffff][Math.floor(Math.random() * 3)],
        );
      });
    }
  }

  private syncFoods(world: World | null, t: number) {
    const counts = {} as Record<FoodId, number>;
    for (const id of FOOD_IDS) counts[id] = 0;
    if (world) {
      for (const p of world.pickups) {
        if (!p.kind || p.kind === 'star' || counts[p.kind] >= FOOD_CAP) continue;
        _q.setFromEuler(_e.set(0.25, t * 1.6 + p.id, 0));
        _m.compose(_v.set(p.x, 0.35 + Math.sin(t * 3 + p.id) * 0.12, p.z), _q, _s.setScalar(1.25));
        this.foods[p.kind].setMatrixAt(counts[p.kind]++, _m);
      }
    }
    for (const id of FOOD_IDS) {
      this.foods[id].count = counts[id];
      this.foods[id].instanceMatrix.needsUpdate = true;
    }
  }

  private syncBeams(world: World | null, t: number) {
    let n = 0;
    if (world && !world.over) {
      const far = CONFIG.field.spawnZ;
      for (const l of world.lasers) {
        if (n >= LASER_CAP) break;
        const firing = isFiring(l, world.speed);
        // 경고: 가까워질수록 서서히 밝아지는 바닥 띠(깜빡이지 않는다) / 발사: 밝은 빛의 벽
        const near = THREE.MathUtils.clamp(1 + l.z / far, 0, 1);
        const glow = firing ? 1 : 0.12 + near * near * 0.4 + (this.reduced ? 0 : Math.sin(t * 6) * 0.04);
        _m.compose(_v.set(l.x, firing ? 0.7 : -0.35, -far / 2 + 4), _q.identity(), _s.set(firing ? 1.75 : 1.5, firing ? 2.2 : 0.04, far + 8));
        this.beams.setMatrixAt(n, _m);
        this.beams.setColorAt(n, _c.setRGB(glow, glow * (firing ? 0.35 : 0.12), glow * (firing ? 0.3 : 0.1)));
        n++;
      }
    }
    this.beams.count = n;
    this.beams.instanceMatrix.needsUpdate = true;
    if (this.beams.instanceColor) this.beams.instanceColor.needsUpdate = true;
  }
}

const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const _c = new THREE.Color();
