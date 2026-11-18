import * as THREE from 'three';
import { at, piece } from '../assets/build';
import type { PlanetType } from '../config';

/**
 * 대전 명소 테마 행성의 "조리법". 행성마다 함수 하나가 Three.js 기본 도형 조각 목록을 돌려주고,
 * 합치고 배치하고 움직이는 일은 backdrop.ts 가 맡는다. 글자·간판·로고는 쓰지 않는다.
 * 모든 행성은 반지름 1 기준. 새 행성은 함수를 만들어 맨 아래 RECIPES 에 등록하면 된다.
 */
export interface Recipe {
  /** 조명을 받는 본체 */
  lit: THREE.BufferGeometry[];
  /** 스스로 빛나는 부분(야경 조명, LED 등). 조명 계산 없이 그린다 */
  glow?: THREE.BufferGeometry[];
  /** 행성 주위를 도는 작은 물체(인공위성, 열차) */
  orbiter?: THREE.BufferGeometry[];
  /** 도는 궤도: 반지름·높이·위아래 출렁임·속도, align 이면 진행 방향(+X)을 궤도에 맞춘다 */
  orbit?: { radius: number; height: number; bob: number; speed: number; align: boolean };
}
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

const ball = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (top: number, bottom: number, height: number, seg = 12) => new THREE.CylinderGeometry(top, bottom, height, seg);
const cone = (r: number, height: number, seg = 8) => new THREE.ConeGeometry(r, height, seg);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);
const torus = (r: number, tube: number, seg = 24, arc = TAU) => new THREE.TorusGeometry(r, tube, 6, seg, arc);
const flat: [number, number, number] = [Math.PI / 2, 0, 0]; // 고리를 바닥에 눕힌다

/**
 * 행성 표면의 한 점에 물체를 세우는 변환.
 * polar 는 꼭대기(+Y)에서 내려온 각, around 는 Y 축 둘레 각. local 의 +Y 가 표면 바깥을 향한다.
 */
function on(polar: number, around: number, local = new THREE.Matrix4(), radius = 1): THREE.Matrix4 {
  const n = new THREE.Vector3(Math.sin(polar) * Math.cos(around), Math.cos(polar), Math.sin(polar) * Math.sin(around));
  const q = new THREE.Quaternion().setFromUnitVectors(UP, n);
  return new THREE.Matrix4().compose(n.multiplyScalar(radius), q, new THREE.Vector3(1, 1, 1)).multiply(local);
}

/** 재현 가능한 난수(행성 모양이 매번 같게) */
function seeded(seed: number) {
  let a = seed;
  return () => (a = (a * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

/** 표면을 울퉁불퉁하게. 같은 위치의 정점은 같은 양만큼 밀어 이음매가 벌어지지 않게 한다. */
function lumpy(geo: THREE.BufferGeometry, amount: number): THREE.BufferGeometry {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = Math.round(v.x * 50) * 12.9898 + Math.round(v.y * 50) * 78.233 + Math.round(v.z * 50) * 37.719;
    const h = Math.sin(key) * 43758.5453;
    v.multiplyScalar(1 + (h - Math.floor(h) - 0.5) * 2 * amount);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** 대전역: 둥근 유리 지붕의 역사와 쌍둥이 빌딩, 행성을 한 바퀴 도는 선로 위를 달리는 고속열차 */
function station(): Recipe {
  const lit = [
    piece(ball(1, 24, 16), 0x7f8fc4),
    piece(ball(1, 20, 10), 0xc9cfdd, at([0, 0.06, 0], undefined, [0.72, 0.97, 0.72])), // 역 광장
    piece(box(0.64, 0.16, 0.28), 0xeef1f6, at([0, 1.1, 0.05])), // 역사
    piece(new THREE.CylinderGeometry(0.14, 0.14, 0.64, 14, 1, false, 0, Math.PI), 0x7fc4f0, at([0, 1.18, 0.05], [0, 0, Math.PI / 2])), // 유리 지붕
    piece(torus(1.23, 0.02, 40), 0x4a4f63, at([0, -0.04, 0], flat)), // 선로
    piece(torus(1.3, 0.02, 40), 0x4a4f63, at([0, -0.04, 0], flat)),
  ];
  const glow: THREE.BufferGeometry[] = [];
  for (const x of [0.13, -0.13]) {
    lit.push(piece(box(0.15, 0.78, 0.15), 0x9fd0f0, at([x, 1.42, -0.27]))); // 쌍둥이 빌딩
    glow.push(piece(box(0.16, 0.025, 0.16), 0xfff1b8, at([x, 1.82, -0.27]))); // 꼭대기 조명
  }
  const rand = seeded(5);
  for (let i = 0; i < 10; i++) {
    const h = 0.1 + rand() * 0.2; // 역 주변 도심
    lit.push(piece(box(0.12, h, 0.12), [0xdfe5f2, 0xb7c4e6, 0x9aaad6][i % 3], on(0.75 + rand() * 0.55, rand() * TAU, at([0, h / 2, 0]))));
  }
  const orbiter: THREE.BufferGeometry[] = [];
  for (const x of [-0.27, 0, 0.27]) {
    // 고속열차 3량: 진행 방향이 +X
    orbiter.push(piece(new THREE.CapsuleGeometry(0.055, 0.15, 4, 8), 0xf5f7fb, at([x, 0.05, 0], [0, 0, Math.PI / 2])));
    orbiter.push(piece(box(0.2, 0.022, 0.115), 0x2f6fe0, at([x, 0.05, 0])));
  }
  return { lit, glow, orbiter, orbit: { radius: 1.265, height: -0.04, bob: 0, speed: 0.5, align: true } };
}

/** 한빛탑: 고리 전망대가 달린 은빛 탑, 과학도시답게 원자 궤도 고리와 돔 건물 */
function hanbit(): Recipe {
  const parts = [
    piece(ball(1, 24, 16), 0x3549b8),
    piece(ball(1, 20, 10), 0x55c06f, at([0, 0.07, 0], undefined, [0.74, 0.97, 0.74])), // 꼭대기의 잔디 광장
    piece(cyl(0.3, 0.34, 0.06, 20), 0xdfe5ee, at([0, 1.05, 0])), // 기단
    piece(cyl(0.05, 0.12, 0.85, 8), 0xf2f5fa, at([0, 1.5, 0])), // 탑신
    piece(torus(0.17, 0.055), 0xd5dcea, at([0, 1.78, 0], flat)), // 고리 전망대
    piece(cone(0.06, 0.42), 0xf2f5fa, at([0, 2.12, 0])),
    piece(ball(0.2, 14, 8), 0xe8edf5, on(0.62, 1.0)), // 과학관 돔
    piece(ball(0.13, 12, 8), 0xe8edf5, on(0.7, 3.4)), // 천문대 돔
  ];
  const rand = seeded(11);
  for (let i = 0; i < 9; i++) {
    const h = 0.12 + rand() * 0.2; // 연구단지 건물들
    parts.push(piece(box(0.11, h, 0.11), [0xaec6ff, 0xd7e3ff, 0x8fa9f0][i % 3], on(0.85 + rand() * 0.9, rand() * TAU, at([0, h / 2, 0]))));
  }
  const glow = [
    piece(cyl(0.135, 0.135, 0.05, 16), 0x58b6ff, at([0, 1.78, 0])), // 전망대 창
    piece(cyl(0.012, 0.012, 0.26, 5), 0xff5a5a, at([0, 2.44, 0])), // 첨탑
    piece(torus(1.5, 0.016, 40), 0xffd84d, at(undefined, [Math.PI / 2 - 0.5, 0, 0.3])), // 원자 궤도
    piece(torus(1.5, 0.016, 40), 0x7fe3ff, at(undefined, [Math.PI / 2 + 0.6, 0, -0.4])),
  ];
  // 과학도시: 행성을 도는 작은 인공위성
  const orbiter = [
    piece(box(0.14, 0.14, 0.14), 0xf2f5fa),
    piece(box(0.5, 0.012, 0.13), 0x3f7be8),
    piece(cone(0.05, 0.1, 8), 0xffd84d, at([0, 0.12, 0])),
  ];
  return { lit: parts, glow, orbiter, orbit: { radius: 1.9, height: 0.5, bob: 0.4, speed: 0.9, align: false } };
}

/** 엑스포다리 + 갑천: 꼭대기를 지나 행성을 한 바퀴 도는 물줄기 위로 빨강·파랑 쌍둥이 아치 */
function expoBridge(): Recipe {
  const parts = [
    piece(ball(1, 24, 16), 0x58b86a),
    piece(new THREE.CylinderGeometry(1.012, 1.012, 0.38, 48, 1, true), 0x3f9be8, at(undefined, [0, 0, Math.PI / 2])), // 갑천
  ];
  for (let i = -3; i <= 3; i++) {
    // 상판: 물줄기를 가로질러 행성 곡면을 따라 휜다
    const a = i * 0.15;
    parts.push(piece(box(0.17, 0.035, 0.3), 0xf1f3f6, on(Math.abs(a), a < 0 ? Math.PI : 0, undefined, 1.06)));
  }
  for (const [z, color] of [[0.12, 0xe23a2e], [-0.12, 0x2d6be0]] as const) {
    parts.push(piece(torus(0.5, 0.032, 24, Math.PI), color, at([0, 0.9, z]))); // 아치
    for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) {
      const top = 0.9 + Math.sqrt(0.25 - x * x);
      const deck = Math.sqrt(1.06 ** 2 - x * x);
      parts.push(piece(cyl(0.007, 0.007, top - deck, 4), 0xf1f3f6, at([x, (top + deck) / 2, z]))); // 케이블
    }
  }
  const rand = seeded(23);
  const tents = [0xff5a7a, 0xffd84d, 0xffffff, 0x66d9ff, 0xff9f43];
  for (let i = 0; i < 10; i++) {
    // 강변 축제 천막(물줄기를 피해 양쪽 둔치에)
    const side = i % 2 ? 0 : Math.PI;
    parts.push(piece(cone(0.085, 0.12, 4), tents[i % 5], on(0.55 + rand() * 0.5, side + (rand() - 0.5) * 1.8, at([0, 0.06, 0]))));
  }
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 0 : Math.PI;
    const m = on(0.5 + rand() * 1.6, side + (rand() - 0.5) * 2.2, at([0, 0.09, 0]));
    parts.push(piece(ball(0.08, 8, 6), i % 3 ? 0x3c9a52 : 0xffb7d0, m)); // 가로수와 벚나무
  }
  return { lit: parts };
}

/** 빵 행성: 행성 자체가 노릇한 빵이고, 그 위에 바게트·크루아상·도넛·제빵 모자 */
function bakery(): Recipe {
  const parts = [
    piece(lumpy(ball(1, 24, 16), 0.035), 0xdba053),
    piece(ball(1, 24, 10), 0xb9722c, at([0, 0.09, 0], undefined, [0.8, 0.95, 0.8])), // 더 구워진 윗면
    piece(cyl(0.17, 0.15, 0.2, 14), 0xffffff, at([0, 1.13, 0])), // 제빵 모자
    piece(ball(0.21, 14, 10), 0xffffff, at([0, 1.33, 0], undefined, [1, 0.72, 1])),
    piece(new THREE.CapsuleGeometry(0.1, 0.7, 4, 10), 0xe6b468, on(0.85, 0.5, at([0, 0.32, 0], [0, 0, 0.55]))), // 바게트
    piece(torus(0.2, 0.1, 14, Math.PI * 1.15), 0xcf8c3c, on(0.8, 2.5, at([0, 0.12, 0], [Math.PI / 2 - 0.35, 0, 0]))), // 크루아상
    piece(ball(0.2, 12, 8), 0xe6b56b, on(0.85, 4.4, at([0, 0.1, 0], undefined, [1, 0.75, 1]))), // 크림빵
    piece(ball(0.1, 10, 8), 0xfff6e0, on(0.85, 4.4, at([0, 0.25, 0]))),
    piece(torus(0.16, 0.075, 16), 0xff9fc0, on(1.45, 1.5, at([0, 0.08, 0], flat))), // 도넛
    piece(torus(0.16, 0.075, 16), 0x8a5a33, on(1.5, 3.5, at([0, 0.08, 0], flat))),
  ];
  const rand = seeded(31);
  for (let i = 0; i < 16; i++) {
    const m = on(0.25 + rand() * 0.45, rand() * TAU, at([0, 0.055, 0], [0, rand() * 3, 0], [0.03, 0.014, 0.05]));
    parts.push(piece(ball(1, 6, 4), 0xfff0c8, m)); // 깨
  }
  return { lit: parts };
}

/** 유성온천: 따뜻한 황톳빛 행성에 돌로 둘러싼 옥색 탕과 피어오르는 김 */
function onsen(): Recipe {
  const parts = [piece(lumpy(ball(1, 24, 16), 0.03), 0xd98a63)];
  const pools: [number, number, number][] = [[0, 0, 0.44], [1.05, 2.2, 0.3], [1.1, 4.5, 0.27], [1.75, 0.8, 0.25]];
  for (const [polar, around, size] of pools) {
    parts.push(piece(torus(size, size * 0.2, 20), 0x8f8a8a, on(polar, around, at([0, -0.03, 0], flat)))); // 돌 테두리
    parts.push(piece(cyl(size * 0.96, size * 0.96, 0.05, 20), 0x72e4de, on(polar, around, at([0, 0.005, 0]))));
    for (let i = 0; i < 3; i++) {
      const r = size * (0.42 - i * 0.09);
      parts.push(piece(ball(r, 10, 8), 0xffffff, on(polar, around, at([Math.sin(i * 2.1) * size * 0.3, 0.22 + i * size * 0.62, Math.cos(i * 1.7) * size * 0.2])))); // 김
    }
  }
  // 족욕탕의 오리 한 마리
  parts.push(piece(ball(0.07, 10, 8), 0xffd84d, at([0.14, 1.07, 0.1], undefined, [1.2, 0.85, 1])));
  parts.push(piece(ball(0.045, 8, 6), 0xffd84d, at([0.2, 1.14, 0.1])));
  parts.push(piece(cone(0.02, 0.05, 6), 0xff8a3d, at([0.255, 1.135, 0.1], [0, 0, -Math.PI / 2])));
  const rand = seeded(47);
  for (let i = 0; i < 10; i++) parts.push(piece(ball(0.06 + rand() * 0.05, 6, 5), 0xa9755a, on(0.6 + rand() * 2, rand() * TAU))); // 바위
  return { lit: parts };
}

/** 대청호: 푸른 물의 행성에 구불구불한 초록 능선, 돛단배와 낮은 구름 */
function lake(): Recipe {
  const parts = [piece(ball(1, 24, 16), 0x2f86dd)];
  const rand = seeded(59);
  for (let i = 0; i < 11; i++) {
    const polar = 0.45 + rand() * 2.1;
    const around = rand() * TAU;
    const turn = rand() * 3;
    const [sx, sz] = [0.2 + rand() * 0.3, 0.1 + rand() * 0.14];
    parts.push(piece(ball(1, 12, 8), i % 2 ? 0x3f9a55 : 0x57b368, on(polar, around, at([0, -0.02, 0], [0, turn, 0], [sx, 0.11, sz])))); // 능선
    parts.push(piece(cone(0.09, 0.16, 6), 0x2f7a45, on(polar, around, at([0, 0.14, 0])))); // 봉우리
  }
  parts.push(piece(box(0.16, 0.04, 0.07), 0xffffff, at([0.1, 1.02, 0.05]))); // 돛단배
  parts.push(piece(cone(0.07, 0.2, 4), 0xfff3d6, at([0.1, 1.14, 0.05])));
  parts.push(piece(box(0.12, 0.035, 0.06), 0xff7a59, on(0.4, 3.6, at([0, 0.02, 0]))));
  parts.push(piece(cone(0.055, 0.16, 4), 0xffffff, on(0.4, 3.6, at([0, 0.12, 0]))));
  for (const [polar, around] of [[0.6, 1.2], [0.9, 4.6], [1.5, 2.9]]) {
    for (let i = 0; i < 3; i++) {
      parts.push(piece(ball(0.13 - i * 0.025, 8, 6), 0xffffff, on(polar, around + i * 0.14, at([0, 0, 0], undefined, [1, 0.6, 1]), 1.3))); // 구름
    }
  }
  return { lit: parts };
}

/** 장태산: 하늘로 곧게 뻗은 메타세쿼이아 숲과 빨간 출렁다리 */
function forest(): Recipe {
  const parts = [piece(lumpy(ball(1, 24, 16), 0.03), 0x4a9b55)];
  const rand = seeded(71);
  for (let i = 0; i < 20; i++) {
    const h = 0.42 + rand() * 0.2;
    const place = on(0.08 + (i / 20) * 0.72, i * 2.4 + rand() * 0.5); // 꼭대기부터 나선으로 내려가며 심는다
    parts.push(piece(cyl(0.03, 0.035, 0.12, 5), 0x7a5230, place.clone().multiply(at([0, 0.06, 0]))));
    const color = [0x2f7d4a, 0x3c9456, 0x2a6e42, 0x3c9456, 0xe0a53a][i % 5]; // 초록 사이에 단풍 든 나무
    parts.push(piece(cone(0.17, h, 8), color, place.clone().multiply(at([0, 0.1 + h / 2, 0]))));
    parts.push(piece(cone(0.12, h * 0.6, 8), color, place.clone().multiply(at([0, 0.1 + h * 0.85, 0])))); // 위에 한 단 더 얹어 침엽수 모양으로
  }
  // 출렁다리: 나무 꼭대기 높이를 가로지른다
  parts.push(piece(box(0.7, 0.03, 0.09), 0xe0453a, at([0.05, 1.5, 0.36])));
  for (const x of [-0.3, 0.4]) parts.push(piece(cyl(0.02, 0.02, 0.6, 5), 0xe0453a, at([x, 1.2, 0.36])));
  return { lit: parts };
}

/** 계족산 황톳길: 숲이 우거진 산을 나선으로 감아 오르는 붉은 흙길, 꼭대기의 돌 산성 */
function gyejok(): Recipe {
  const lit = [piece(lumpy(ball(1, 24, 16), 0.035), 0x4f9e58)];
  const TURNS = 2.4;
  const spiral = (k: number, lift = 1.02) => {
    const polar = 2.15 - k * 1.8; // 아래에서 위로
    const around = k * TAU * TURNS;
    return new THREE.Vector3(Math.sin(polar) * Math.cos(around), Math.cos(polar), Math.sin(polar) * Math.sin(around)).multiplyScalar(lift);
  };
  const path = new THREE.CatmullRomCurve3(Array.from({ length: 50 }, (_, i) => spiral(i / 49)));
  lit.push(piece(new THREE.TubeGeometry(path, 80, 0.075, 5), 0xc9713a)); // 황톳길
  const rand = seeded(83);
  for (let i = 0; i < 18; i++) {
    // 나무는 길과 길 사이(나선 반 바퀴 어긋난 자리)에 심는다
    const k = (i + 0.5) / 18;
    const polar = 2.15 - k * 1.8 + 0.37;
    const r = 0.11 + rand() * 0.05; // 뾰족한 침엽수 대신 둥근 활엽수 덩어리(멀리서 가시처럼 보이지 않게)
    const place = on(polar, k * TAU * TURNS + (rand() - 0.5) * 0.5);
    lit.push(piece(ball(r, 7, 5), [0x2f7d4a, 0x3c9456, 0x2a6e42][i % 3], place.multiply(at([0, r * 0.7, 0], undefined, [1, 0.85, 1]))));
  }
  lit.push(piece(torus(0.27, 0.05, 16), 0xb9b4a8, at([0, 0.99, 0], flat))); // 산성의 성벽
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    lit.push(piece(box(0.09, 0.09, 0.06), 0xcfcabd, at([Math.cos(a) * 0.27, 1.07, Math.sin(a) * 0.27], [0, -a + Math.PI / 2, 0]))); // 성가퀴
  }
  lit.push(piece(cyl(0.07, 0.08, 0.1, 6), 0x8a5a3c, at([0, 1.08, 0]))); // 정자
  lit.push(piece(cone(0.15, 0.1, 6), 0x4b3b34, at([0, 1.18, 0])));
  return { lit };
}

/** 으능정이 스카이로드 / 0시축제 야경: 밤의 도심 위로 거리를 덮은 LED 캐노피와 불 켜진 건물들 */
function skyroad(): Recipe {
  const LED = [0xff4fa3, 0x7a5cff, 0x34d1ff, 0xffe14f, 0x4dffb5];
  const lit = [piece(ball(1, 24, 16), 0x30357c)];
  const glow: THREE.BufferGeometry[] = [];
  for (let i = -4; i <= 4; i++) {
    // 거리는 꼭대기를 지나 X 방향으로 뻗고, 그 위를 캐노피가 곡면을 따라 덮는다
    const polar = Math.abs(i) * 0.14;
    const around = i < 0 ? Math.PI : 0;
    lit.push(piece(box(0.16, 0.02, 0.3), 0x4a4f8f, on(polar, around, undefined, 1.005))); // 보도
    glow.push(piece(box(0.15, 0.03, 0.36), LED[(i + 4) % 5], on(polar, around, undefined, 1.32))); // LED 캐노피
    for (const z of [0.19, -0.19]) {
      lit.push(piece(cyl(0.013, 0.013, 0.32, 5), 0xb9bfd6, on(polar, around, at([0, 0.16, z])))); // 기둥
      glow.push(piece(ball(0.03, 6, 5), LED[(i + 6) % 5], on(polar, around, at([0, 0.07, z * 1.25])))); // 거리 조명
    }
  }
  const rand = seeded(97);
  for (let i = 0; i < 20; i++) {
    // 건물: 거리(around 0·π 근처)를 피해 양옆 블록에 세운다
    const around = (i % 2 ? 0.55 : Math.PI + 0.55) + rand() * (Math.PI - 1.1);
    const polar = 0.35 + rand() * 1.5;
    const h = 0.16 + rand() * 0.3;
    const w = 0.12 + rand() * 0.05;
    lit.push(piece(box(w, h, w), [0x343a7a, 0x2c3168, 0x41468c][i % 3], on(polar, around, at([0, h / 2, 0]))));
    for (let f = 0.07; f < h - 0.03; f += 0.085) {
      const color = [0xffd98a, 0xff8ad1, 0x8ad8ff, 0xffd98a][(i + Math.round(f * 20)) % 4];
      glow.push(piece(box(w * 1.04, 0.022, w * 1.04), color, on(polar, around, at([0, f, 0])))); // 불 켜진 층
    }
  }
  for (let i = 0; i < 7; i++) glow.push(piece(ball(0.045, 6, 5), LED[i % 5], on(0.3 + rand() * 0.9, rand() * TAU, undefined, 1.55 + rand() * 0.25))); // 축제 풍선
  return { lit, glow };
}

/** 대흥동 먹자골목: 알록달록한 차양의 작은 가게들과 골목 위에 걸린 전구, 가운데의 커다란 냄비 */
function daeheung(): Recipe {
  const lit = [piece(lumpy(ball(1, 24, 16), 0.02), 0xc98a5a), piece(ball(1, 20, 10), 0x8a8f9c, at([0, 0.05, 0], undefined, [0.6, 0.97, 0.6]))];
  const glow: THREE.BufferGeometry[] = [];
  const awnings = [0xe5352b, 0xffc93c, 0x2f8fe0, 0x4fae5a, 0xff7aa8];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const place = on(0.62, a);
    lit.push(piece(box(0.2, 0.2, 0.18), 0xf3e9d8, place.clone().multiply(at([0, 0.1, 0])))); // 가게
    lit.push(piece(box(0.24, 0.05, 0.24), awnings[i % 5], place.clone().multiply(at([0, 0.22, 0], [0.25, 0, 0])))); // 차양
    glow.push(piece(ball(0.03, 6, 5), 0xffe7a0, on(0.36, a + 0.3, undefined, 1.16))); // 골목 전구
  }
  lit.push(piece(cyl(0.26, 0.2, 0.2, 14), 0x2f2f35, at([0, 1.14, 0]))); // 냄비
  lit.push(piece(cyl(0.24, 0.24, 0.03, 14), 0xd03a24, at([0, 1.24, 0])));
  for (const [x, z] of [[-0.08, 0.05], [0.09, -0.04], [0, 0.1]]) lit.push(piece(box(0.1, 0.07, 0.1), 0xfffdf2, at([x, 1.28, z])));
  for (let i = 0; i < 3; i++) lit.push(piece(ball(0.09 - i * 0.02, 8, 6), 0xffffff, at([0.04 * i, 1.45 + i * 0.16, 0]))); // 김
  return { lit, glow };
}

/** 한밭수목원: 유리 온실 돔과 꽃밭, 둥근 나무와 연못 */
function arboretum(): Recipe {
  const lit = [
    piece(lumpy(ball(1, 24, 16), 0.02), 0x62b866),
    piece(ball(0.36, 16, 10), 0xbfe9f5, at([0, 1.0, 0], undefined, [1, 0.8, 1])), // 유리 온실
    piece(torus(0.37, 0.025, 20), 0xf4f6fa, at([0, 1.02, 0], flat)),
    piece(cyl(0.22, 0.22, 0.03, 16), 0x4aa8e8, on(0.62, 1.2, at([0, 0.012, 0]))), // 연못
  ];
  const rand = seeded(61);
  const flowers = [0xff7aa8, 0xffd84d, 0xff5a5a, 0xffffff, 0xb48cff];
  for (let i = 0; i < 26; i++) lit.push(piece(ball(0.045, 6, 5), flowers[i % 5], on(0.5 + rand() * 0.75, rand() * TAU, at([0, 0.035, 0])))); // 꽃밭
  for (let i = 0; i < 9; i++) {
    const place = on(0.75 + rand() * 0.9, i * 0.7 + rand() * 0.3);
    lit.push(piece(cyl(0.02, 0.026, 0.12, 5), 0x7a5230, place.clone().multiply(at([0, 0.06, 0]))));
    lit.push(piece(ball(0.12, 8, 6), [0x2f7d4a, 0x3c9456, 0xe39a3b][i % 3], place.clone().multiply(at([0, 0.2, 0])))); // 단풍 든 나무도 섞는다
  }
  return { lit };
}

/** 중촌동 위브온 페스티벌: 대관람차와 무대, 천막과 풍선이 가득한 축제 행성 */
function festival(): Recipe {
  const COLORS = [0xff4fa3, 0x7a5cff, 0x34d1ff, 0xffe14f, 0x4dffb5];
  const lit = [piece(ball(1, 24, 16), 0x5b3fa0), piece(ball(1, 20, 10), 0x7d5fd0, at([0, 0.06, 0], undefined, [0.7, 0.97, 0.7]))];
  const glow: THREE.BufferGeometry[] = [];
  // 대관람차
  lit.push(piece(torus(0.42, 0.022, 28), 0xf4f6fa, at([0, 1.5, 0])));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    lit.push(piece(cyl(0.008, 0.008, 0.42, 4), 0xf4f6fa, at([Math.cos(a) * 0.21, 1.5 + Math.sin(a) * 0.21, 0], [0, 0, a - Math.PI / 2])));
    glow.push(piece(ball(0.05, 8, 6), COLORS[i % 5], at([Math.cos(a) * 0.42, 1.5 + Math.sin(a) * 0.42, 0]))); // 곤돌라
  }
  for (const s of [1, -1]) lit.push(piece(cyl(0.015, 0.015, 0.52, 5), 0xd7dbe6, at([s * 0.12, 1.26, 0], [0, 0, -s * 0.24])));
  // 무대와 조명
  lit.push(piece(box(0.5, 0.06, 0.26), 0x2a2140, on(0.7, 1.4, at([0, 0.03, 0]))));
  lit.push(piece(box(0.5, 0.28, 0.03), 0x3a2d5c, on(0.7, 1.4, at([0, 0.2, -0.12]))));
  for (let i = 0; i < 5; i++) glow.push(piece(ball(0.035, 6, 5), COLORS[i], on(0.7, 1.4, at([-0.2 + i * 0.1, 0.36, -0.1]))));
  const rand = seeded(73);
  for (let i = 0; i < 9; i++) lit.push(piece(cone(0.09, 0.13, 4), COLORS[i % 5], on(0.6 + rand() * 0.9, 2.6 + rand() * 4, at([0, 0.065, 0])))); // 천막
  for (let i = 0; i < 10; i++) glow.push(piece(ball(0.05, 6, 5), COLORS[i % 5], on(0.2 + rand() * 1.2, rand() * TAU, undefined, 1.45 + rand() * 0.4))); // 풍선
  return { lit, glow };
}
export const RECIPES: Record<PlanetType, () => Recipe> = {
  station, skyroad, bakery, daeheung, expoBridge, arboretum, hanbit, onsen, forest, gyejok, lake, festival,
};
