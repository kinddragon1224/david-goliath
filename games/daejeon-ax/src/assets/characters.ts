import * as THREE from 'three';
import type { CharacterId } from '../config';
import { buildKkumdori, type Rig } from './figure';

// src/assets/characters/ 에 넣은 파일을 빌드 시점에 찾는다. 코드 수정 없이 파일만 넣으면 된다.
const files = import.meta.glob('./characters/*.{glb,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const HEIGHT = 1.05; // 앉은 자리에서 별 끝까지의 높이(절차적 모델과 같은 크기로 맞춘다)

/** 코드로 만든 기본 모델. 캐릭터를 추가하려면 여기에 빌더를 등록한다. */
const procedural: Record<CharacterId, () => Rig> = { kkumdori: buildKkumdori };

/**
 * glb → png(webp) → 코드로 만든 모델 순으로 시도한다. 모델 정면은 +Z, 원점은 앉는 자리.
 * 외부에서 만든 GLB 는 통짜 모델로 취급해 root·spine 만 채운다(전신 기울기·움찔·처짐은 그대로 동작).
 */
export async function loadCharacter(id: CharacterId): Promise<Rig> {
  const glb = files[`./characters/${id}.glb`];
  if (glb) {
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const model = (await new GLTFLoader().loadAsync(glb)).scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = HEIGHT / Math.max(size.y, 1e-6);
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale); // 바닥이 앉는 자리에 닿게
      return wrap(model);
    } catch (e) {
      console.warn(`${id}.glb 를 읽지 못해 다음 형식으로 넘어갑니다`, e);
    }
  }
  const image = files[`./characters/${id}.png`] ?? files[`./characters/${id}.webp`];
  if (image) {
    try {
      const map = await new THREE.TextureLoader().loadAsync(image);
      map.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, fog: false }));
      sprite.scale.set((HEIGHT * map.image.width) / map.image.height, HEIGHT, 1);
      sprite.position.y = HEIGHT / 2;
      return wrap(sprite);
    } catch (e) {
      console.warn(`${id} 이미지를 읽지 못해 코드로 만든 모델을 씁니다`, e);
    }
  }
  return procedural[id]();
}

function wrap(object: THREE.Object3D): Rig {
  const spine = new THREE.Group().add(object);
  return { root: new THREE.Group().add(spine), spine };
}
