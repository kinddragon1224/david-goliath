import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, piece, solid, type Vec3 } from './build';

/**
 * 애니메이션이 움직이는 부위. root 만 있으면 되고 나머지는 있을 때만 쓴다
 * (GLB 로 교체한 통짜 모델은 root·spine 만 가진다).
 * 좌표: 원점은 앉는 자리(엉덩이 밑), 정면 +Z, 위 +Y.
 */
export interface Rig {
  root: THREE.Object3D;
  /** 허리 위 전체(몸통·머리·팔). 기울기·움찔·축 처짐이 여기에 걸린다 */
  spine?: THREE.Object3D;
  head?: THREE.Object3D;
  antenna?: THREE.Object3D;
  armL?: THREE.Object3D;
  armR?: THREE.Object3D;
}

// 치수는 참조 사진(로켓에 앉은 꿈돌이 피규어)에서 로켓 지름 0.52 를 기준으로 잰 값
const YELLOW = 0xffc800;
const BLACK = 0x16161a;
const HEAD = { y: 0.5, rx: 0.36, up: 0.31, down: 0.235, rz: 0.33 };
const NECK_Y = 0.27;

const smooth = THREE.MathUtils.smoothstep;

/** 단위 구의 방향 벡터를 머리 표면의 점으로 바꾼다: 위는 둥근 돔, 아래는 납작하고 볼이 통통 */
function shapeHead(v: THREE.Vector3): THREE.Vector3 {
  const { x, y, z } = v;
  // 모든 항을 매끄러운 함수로만 섞어야 표면에 주름(법선 꺾임)이 생기지 않는다
  const cheek = 1 + 0.07 * Math.exp(-(((y + 0.38) / 0.4) ** 2)); // 가장 넓은 곳은 중심보다 아래
  const full = 1 + 0.07 * 4 * y * y * (1 - y * y); // 타원체보다 살짝 각지게 부풀린 돔
  const ry = THREE.MathUtils.lerp(HEAD.down, HEAD.up, smooth(y, -0.6, 0.6));
  return v.set(x * HEAD.rx * cheek * full, y * ry * full, z * HEAD.rz * cheek * full);
}

function headGeometry(): THREE.BufferGeometry {
  const sphere = new THREE.SphereGeometry(1, 48, 32);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const g = mergeVertices(sphere); // 구의 이음매를 붙여야 법선이 매끈하게 이어진다
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    shapeHead(v.fromBufferAttribute(p, i));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** 얼굴(머리 앞면)에서 정면으로 봤을 때 (x, y)에 해당하는 표면의 점과 법선 */
function onFace(x: number, y: number): { p: THREE.Vector3; q: THREE.Quaternion } {
  const best = new THREE.Vector3();
  const v = new THREE.Vector3();
  let bestD = Infinity;
  for (let i = 0; i <= 80; i++) {
    for (let j = 0; j <= 80; j++) {
      const lat = (i / 80 - 0.5) * 2.2; // 위아래 ±63°
      const lon = (j / 80 - 0.5) * 2.2;
      shapeHead(v.set(Math.sin(lon) * Math.cos(lat), Math.sin(lat), Math.cos(lon) * Math.cos(lat)));
      const d = (v.x - x) ** 2 + (v.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best.copy(v);
      }
    }
  }
  const ry = best.y > 0 ? HEAD.up : HEAD.down;
  const n = new THREE.Vector3(best.x / HEAD.rx ** 2, best.y / ry ** 2, best.z / HEAD.rz ** 2).normalize();
  return { p: best, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n) };
}

/** 통통한 별: 모서리를 둥글린 압출 */
function puffyStar(radius: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? radius * 0.56 : radius;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  return new THREE.ExtrudeGeometry(s, {
    depth: 0.03, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.02, bevelSegments: 4,
  }).center();
}

/** 절차적으로 만든 꿈돌이. 움직이는 부위마다 메시 1개(총 6 드로우콜). */
export function buildKkumdori(): Rig {
  const root = new THREE.Group();
  const ball = new THREE.SphereGeometry(1, 24, 18);

  // 다리(고정): 앞으로 뻗어 발바닥이 정면을 향한다
  const legs: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    legs.push(piece(new THREE.CapsuleGeometry(0.075, 0.07, 6, 14), YELLOW, at([s * 0.1, 0.07, 0.13], [Math.PI / 2, 0, -s * 0.2])));
    legs.push(piece(ball, YELLOW, at([s * 0.128, 0.085, 0.245], [0, s * 0.22, 0], [0.1, 0.105, 0.058])));
  }
  root.add(solid(legs));

  const spine = new THREE.Group();
  root.add(spine);
  spine.add(solid([piece(ball, YELLOW, at([0, 0.14, 0], undefined, [0.16, 0.165, 0.14]))]));

  // 머리: 목을 축으로 끄덕이도록 피벗을 목에 둔다
  const head = new THREE.Group();
  head.position.y = NECK_Y;
  spine.add(head);
  const c: Vec3 = [0, HEAD.y - NECK_Y, 0]; // 머리 중심(피벗 기준)
  const headParts = [piece(headGeometry(), YELLOW, at(c))];
  for (const s of [1, -1]) {
    // 귀: 머리 옆 중간 높이에서 바깥·위로 솟은 작은 지느러미
    headParts.push(piece(new THREE.ConeGeometry(0.085, 0.2, 20), YELLOW, at([s * 0.375, c[1] + 0.06, 0], [0, 0, -s * 0.33], [1, 1, 0.6])));
    // 눈: 검은 세로 타원 두 개, 가운데에 모여 중심보다 조금 아래
    const { p, q } = onFace(s * 0.062, -0.088);
    const m = new THREE.Matrix4().compose(p.add(new THREE.Vector3(...c)), q, new THREE.Vector3(1, 1, 0.3));
    headParts.push(piece(new THREE.CapsuleGeometry(0.0215, 0.083, 6, 14), BLACK, m));
  }
  head.add(solid(headParts));

  // 더듬이와 별: 따로 흔들리도록 정수리에 피벗
  const antenna = new THREE.Group();
  antenna.position.set(0, c[1] + HEAD.up - 0.01, 0);
  head.add(antenna);
  const wire = new THREE.CatmullRomCurve3(
    [[0, 0, 0], [0.008, 0.1, 0], [0.06, 0.172, 0], [0.16, 0.165, 0]].map((p) => new THREE.Vector3(...p)),
  );
  antenna.add(
    solid([
      piece(new THREE.TubeGeometry(wire, 16, 0.009, 6), 0x5a5e66),
      piece(puffyStar(0.1), 0x6cb9ea, at([0.24, 0.148, 0], [0, 0, -0.1])),
    ]),
  );

  // 팔: 어깨를 축으로, 0 회전일 때 아래를 향한다. 기본 자세는 옆으로 벌린 짧은 팔
  const arm = () =>
    solid([
      piece(new THREE.CapsuleGeometry(0.05, 0.07, 6, 12), YELLOW, at([0, -0.07, 0])),
      piece(ball, YELLOW, at([0, -0.15, 0], undefined, [0.062, 0.062, 0.054])),
    ]);
  const [armL, armR] = [1, -1].map((s) => {
    const pivot = new THREE.Group().add(arm());
    pivot.position.set(s * 0.12, 0.22, 0.03);
    spine.add(pivot);
    return pivot;
  });

  return { root, spine, head, antenna, armL, armR };
}
