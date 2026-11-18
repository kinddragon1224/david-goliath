import * as THREE from 'three';
import type { Rig } from '../assets/figure';
import { buildRocket, ROCKET_RADIUS, ROCKET_REAR } from '../assets/rocket';
import { CONFIG } from '../config';

export interface CharacterState {
  /** hidden: 안 보임 / select: 전시대 위에서 천천히 회전 / game: 로켓을 타고 날아감 */
  mode: 'hidden' | 'select' | 'game';
  /** 프레임 시간(초). 일시정지면 0 */
  dt: number;
  /** 놓일 x. 선택 화면에서는 진열 위치, 게임에서는 플레이어 x */
  x: number;
  /** 화면에 맞춘 크기 배율 */
  scale: number;
  /** 좌우 속도(단위/초) */
  vx: number;
  /** 방금 맞았으면 1 에서 0 으로 줄어드는 값 */
  hit: number;
  /** 무적 깜빡임으로 이번 프레임은 숨김 */
  blink: boolean;
  over: boolean;
  /** 완주해서 기뻐하는 중 */
  cheer: boolean;
}

const A = CONFIG.character;
const SEAT_Z = -0.12; // 로켓 위에서 앉는 위치(가운데보다 살짝 뒤)
const ARM_REST = 1.15; // 팔을 옆으로 벌린 기본 각도
const { smoothstep, clamp } = THREE.MathUtils;

/**
 * 캐릭터 한 명의 화면 표현: 피규어(Rig)와 로켓을 따로 들고 자세·애니메이션을 맡는다.
 * 보이는 것만 바꾸며 게임 로직(위치·충돌)은 건드리지 않는다. 모든 움직임은 dt 기반.
 *
 *   root(위치·뱅크) ─ turn(진행 방향) ┬ rocket
 *                                     └ seat(피규어가 로켓 위에서 바라보는 방향) ─ rig.root
 */
export class CharacterView {
  readonly root = new THREE.Group();
  /** 분사 불꽃이 나오는 곳(게임 좌표, 캐릭터 기준 z) */
  readonly thrustZ = (-ROCKET_REAR + 0.05) * A.gameScale;
  readonly thrustY = -ROCKET_RADIUS * A.gameScale;
  private turn = new THREE.Group();
  private seat = new THREE.Group();
  private rocket: THREE.Group;
  private stand: THREE.Mesh;
  private time = 0;
  private lean = 0;
  private wobble = 0; // 더듬이 스프링
  private wobbleV = 0;
  private overT = 0;
  private cheerT = 0;
  private spin = 0;

  constructor(private rig: Rig) {
    ({ rocket: this.rocket, stand: this.stand } = buildRocket());
    this.rocket.position.y = -ROCKET_RADIUS; // root 원점 = 로켓 윗면(앉는 자리)
    this.rocket.visible = A.rocket;
    this.seat.position.z = SEAT_Z;
    this.seat.add(rig.root);
    this.turn.add(this.rocket, this.seat);
    this.root.add(this.turn);
    this.root.visible = false;
  }

  update(s: CharacterState): void {
    const { rig, root } = this;
    root.visible = s.mode !== 'hidden' && !s.blink;
    if (s.mode === 'hidden') return;
    const dt = s.dt;
    this.time += dt;
    const t = this.time;
    const k = 1 - Math.exp(-A.response * dt);
    const select = s.mode === 'select';
    this.overT = s.over ? this.overT + dt : 0;
    const sad = smoothstep(this.overT, 0, 0.7); // 0 → 1: 아쉬워하는 자세로
    this.cheerT = s.cheer ? this.cheerT + dt : 0;
    const away = Math.max(0, this.cheerT - 1.3) ** 2 * 45; // 완주하면 만세를 부르다 앞으로 날아가 사라진다(결과 화면을 가리지 않게)

    // 좌우 회피: 속도에 비례해 기울고, 빠르게 움직일수록 더 크게 반응한다
    const fast = smoothstep(Math.abs(s.vx), A.fastFrom, A.fastTo);
    const target = select || s.over ? 0 : clamp(-s.vx * A.lean * (1 + A.fastBoost * fast), -A.leanMax, A.leanMax);
    const before = this.lean;
    this.lean += (target - this.lean) * k;
    // 더듬이: 기울기 변화에 늦게 따라오며 출렁이는 스프링
    this.wobbleV += -(this.lean - before) * 12 - (this.wobble * 120 + this.wobbleV * 6) * dt;
    this.wobble = clamp(this.wobble + this.wobbleV * dt, -0.8, 0.8);

    const bob = Math.sin(t * 2.2) * A.bob;
    const shake = s.hit; // 피격: 잠깐 덜덜 떤다
    const sink = Math.max(0, this.overT - 2.2) ** 2 * 0.5; // 끝난 뒤 천천히 가라앉는다

    this.stand.visible = select;
    if (select) {
      this.spin += dt * A.spin;
      root.position.set(s.x, 0.85 - 0.21 * s.scale + bob * 0.5, 0); // 제목과 버튼 사이 가운데쯤
      root.rotation.set(0, 0, 0);
      root.scale.setScalar(s.scale);
      this.turn.rotation.y = -Math.PI / 2 + 0.35 + this.spin; // 참조 사진처럼 로켓 코가 왼쪽을 향한 채 시작
      this.seat.rotation.y = Math.PI / 2; // 전시 자세: 로켓에 가로로 걸터앉아 정면을 본다
    } else {
      root.position.set(s.x + Math.sin(t * 61) * 0.07 * shake, bob - sink + away * 0.08, Math.cos(t * 53) * 0.05 * shake - away);
      root.rotation.set(0, 0, this.lean * 0.7 + Math.sin(this.overT * 2.1) * 0.06 * sad);
      root.scale.setScalar(s.scale);
      this.turn.rotation.y = Math.PI; // 등을 보이고 앞으로 날아간다
      this.seat.rotation.y = sad * Math.PI; // 끝나면 뒤돌아 카메라를 본다
    }

    // 이하 피규어 자체의 동작. 피규어의 정면(+Z) 기준 좌표라, 게임 중에는 좌우가 화면과 반대다.
    const side = select ? 0 : -this.lean;
    if (rig.spine) {
      rig.spine.rotation.set(
        sad * 0.1 + Math.cos(t * 38) * 0.18 * shake,
        0,
        side * 0.55 + Math.sin(t * 45) * 0.3 * shake,
      );
      rig.spine.scale.y = 1 + Math.sin(t * 2.2 + 1) * 0.015 - sad * 0.03 + Math.sin(this.overT * 2.6) * 0.012 * sad;
    }
    if (rig.head) {
      rig.head.rotation.set(
        Math.sin(t * 1.1) * 0.04 + sad * 0.22, // 고개를 떨군다(위에서 보는 카메라에 눈이 가려지지 않을 만큼만)
        side * -0.5 * (1 - sad) + Math.sin(this.overT * 2.6) * 0.2 * sad, // 가는 쪽을 보다가, 끝나면 도리도리
        side * -0.3 + Math.sin(t * 50) * 0.25 * shake,
      );
    }
    if (rig.antenna) rig.antenna.rotation.z = this.wobble + Math.sin(t * 3.1) * 0.05 + Math.sin(t * 40) * 0.3 * shake;
    const flap = Math.sin(t * 2.2) * 0.07;
    const up = fast * 0.35 + shake * 0.7 + (s.cheer ? 0.75 + Math.sin(t * 9) * 0.25 : 0); // 빠르거나 맞으면 팔이 번쩍, 완주하면 만세
    const hang = sad * (ARM_REST - 0.12); // 끝나면 팔을 축 늘어뜨린다
    rig.armL?.rotation.set(-0.25 * (1 - sad), 0, ARM_REST + flap + up - hang + side * 0.6);
    rig.armR?.rotation.set(-0.25 * (1 - sad), 0, -(ARM_REST + flap + up - hang) + side * 0.6);
  }
}
