import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, piece, solid, type Vec3 } from './build';

// 참조 사진 비율: 전체 길이 ≈ 지름의 3.5배 (빨간 코 0.3 + 흰 몸통 1.32 + 회색 캡 0.2)
export const ROCKET_RADIUS = 0.26;
/** 분사구(회색 캡) 끝의 z. 코는 +Z */
export const ROCKET_REAR = -0.91;
const BODY_FRONT = 0.61;
const BODY_REAR = -0.71;

/** 옆면 표지: 흰 바탕에 검은 테두리, 둥근 마크, "EXPO '93" */
function labelTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 384, 256);
  g.lineWidth = 8;
  g.strokeStyle = '#111';
  g.strokeRect(4, 4, 376, 248);
  // 파랑·빨강이 맞물린 둥근 마크
  g.fillStyle = '#1f3fb5';
  g.beginPath();
  g.arc(172, 104, 62, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(214, 124, 50, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e0252b';
  g.beginPath();
  g.ellipse(226, 112, 46, 30, -0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(214, 132, 30, 15, -0.5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.font = "900 50px 'Arial Black', Arial, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText("EXPO '93", 192, 212);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 원통 옆면에 감기는 표지 한 장. side=1 은 +X 쪽, -1 은 -X 쪽 */
function decal(side: number, z: number, width: number, height: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, height, 1, 12);
  const p = g.attributes.position;
  const r = ROCKET_RADIUS + 0.003;
  for (let i = 0; i < p.count; i++) {
    const a = p.getY(i) / r; // 세로 방향을 원통 둘레로 감는다
    p.setXYZ(i, side * r * Math.cos(a), r * Math.sin(a), z - side * p.getX(i)); // 어느 쪽에서 봐도 글자가 바로 읽히게
  }
  return g;
}

/**
 * 빨간 코의 흰 로켓. 캐릭터와는 별개의 오브젝트로 원점은 몸통 축 위, 코는 +Z.
 * 몸체 메시 1 + 표지 메시 1. 전시용 받침(stand)은 선택 화면에서만 보이게 따로 둔다.
 */
export function buildRocket(): { rocket: THREE.Group; stand: THREE.Mesh } {
  const R = ROCKET_RADIUS;
  const lay: Vec3 = [Math.PI / 2, 0, 0]; // 원통·회전체의 축(+Y)을 +Z 로 눕힌다
  const grey = 0xa9adb4;
  // 코: 옆선이 살짝 볼록한 원뿔
  const nose = new THREE.LatheGeometry(
    Array.from({ length: 13 }, (_, i) => {
      const t = i / 12; // 0 = 밑면, 1 = 끝
      return new THREE.Vector2(R * (1 - t) ** 0.82 + 0.012 * Math.sin(t * Math.PI), t * 0.3);
    }),
    32,
  );
  const length = BODY_FRONT - BODY_REAR;
  const rocket = new THREE.Group().add(
    solid([
      piece(new THREE.CylinderGeometry(R, R, length, 32), 0xf7f8fa, at([0, 0, (BODY_FRONT + BODY_REAR) / 2], lay)),
      piece(nose, 0xe01b1b, at([0, 0, BODY_FRONT], lay)),
      piece(new THREE.CylinderGeometry(R * 0.93, R * 0.97, 0.17, 32), grey, at([0, 0, BODY_REAR - 0.085], lay)),
      piece(new THREE.SphereGeometry(1, 32, 12), grey, at([0, 0, BODY_REAR - 0.17], lay, [R * 0.97, 0.035, R * 0.97])), // 캡의 둥근 끝
    ]),
  );
  const label = new THREE.MeshBasicMaterial({ map: labelTexture(), side: THREE.DoubleSide, fog: false });
  rocket.add(new THREE.Mesh(mergeGeometries([1, -1].map((s) => decal(s, -0.45, 0.4, 0.27))), label));

  const stand = solid(
    [0.42, -0.48].flatMap((z) => [
      piece(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 10), grey, at([0, -R - 0.06, z])),
      piece(new THREE.CylinderGeometry(0.075, 0.075, 0.022, 20), grey, at([0, -R - 0.13, z])),
    ]),
  );
  rocket.add(stand);
  return { rocket, stand };
}
