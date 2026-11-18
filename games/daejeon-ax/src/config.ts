import type { DifficultyId } from './game/config/presets';
import { STAGES } from './game/config/stages';

// 조정값은 전부 여기. README의 "config 조정 항목" 표와 짝을 맞출 것.
export const CONFIG = {
  field: {
    laneWidth: 2, // 레인 폭(월드 단위)
    lanesPortrait: 3, // 세로 화면 레인 수
    lanesLandscape: 5, // 가로 화면 레인 수
    spawnZ: 110, // 운석이 생기는 거리
    despawnZ: 14, // 카메라 뒤로 이만큼 지나가면 제거
  },
  player: {
    radius: 0.5, // 충돌 반지름
    follow: 14, // 입력 추종 강도(1/초). 클수록 즉각 반응
    maxSpeed: 18, // 좌우 최대 속도(단위/초)
    invulnSec: 1.5,
    shieldSec: 2,
  },
  meteor: {
    radiusMin: 0.65,
    radiusMax: 0.9,
    hitScale: 1, // 판정 크기 배율의 상한(난이도별 실제 값은 presets.ts). 피할 길 보장은 이 값으로 계산한다
    jitter: 0.2, // 레인 중심에서 좌우로 흔들리는 폭
  },
  // 스테이지(여행지) 목록은 game/config/stages.ts, 음식은 game/config/items.ts, 난이도 3종은 game/config/presets.ts
  stages: STAGES,
  difficulty: {
    stepSec: 18, // 스테이지 하나의 길이(초). 12개 스테이지 × 18초 = 한 판 3분 36초
    transitionSec: 2.5, // 스테이지가 바뀔 때 새 운석이 나오지 않는 숨 고르기 시간
    default: 'normal' as DifficultyId,
  },
  boss: {
    fireSec: 0.4, // 레이저가 켜져 있는 시간
    beamHalf: 0.95, // 레이저에 맞는 좌우 폭의 절반(레인 폭의 절반보다 조금 좁게)
  },
  score: {
    perSecond: 10, // 생존 시간 점수
    dodge: 100, // 운석 하나를 피할 때마다
    comboEvery: 10, // 연속으로 이만큼 피할 때마다 배율이 오른다
    comboStep: 0.5,
    comboMax: 3, // 연속 회피 배율의 상한
    star: 50,
    stageClear: 500,
    bossClear: 1000,
  },
  pose: {
    enableShield: true, // 양손 들기 보호막. 인식이 불안하면 false
    maxFps: 30, // 추론 상한(빠른 기기)
    minFps: 10, // 느린 기기에서도 이보다 드물게 돌리지는 않는다
    maxLoad: 0.25, // 추론이 메인 스레드 시간에서 차지해도 되는 비율. 추론이 느린 기기일수록 드물게 돈다
    numPoses: 2, // 여러 명 중 조종하는 사람을 고르기 위해 2명까지 검출
    singlePoseMs: 12, // 추론 한 번이 평균 이보다 오래 걸리는 기기는 1명만 추적(매 프레임 사람 찾기를 건너뛰어 가벼워진다)
    warmupFrames: 15, // 첫 추론들은 준비 때문에 느리므로 시간 측정에서 뺀다
    minVisibility: 0.5,
    rangeShoulders: 0.9, // 어깨너비의 이 배수만큼 움직이면 화면 끝. 예민하면 올리고 둔하면 내린다(예전 0.6)
    deadzone: 0.1, // 가운데에서 이 비율까지는 움직이지 않는다(서 있을 때의 흔들림 무시, 예전 0.06)
    filterMinCutoff: 1.2, // One Euro: 낮출수록 정지 시 떨림 감소(지연 증가)
    filterBeta: 20, // One Euro: 높일수록 빠른 움직임 지연 감소
    lostSec: 0.5, // 이만큼 놓치면 일시정지(그동안 입력은 마지막 위치로 고정)
    resumeGraceSec: 2, // 다시 인식된 직후 이 시간 동안은 맞지 않는다
    calibrateSec: 2,
    calibrateCenter: 0.22, // 화면 중앙 ±이 범위 안에 서야 함
    calibrateStill: 0.04, // 이보다 많이 움직이면 타이머 리셋
    minShoulderWidth: 0.08, // 이보다 작으면 "더 가까이"
  },
  keyboard: { rate: 2.6 }, // 초당 x 변화량(-1~1 기준)
  touch: { dragRange: 0.35 }, // 화면 너비의 이 비율을 끌면 중앙→끝
  tilt: { maxDeg: 18, wakeDeg: 3 }, // 이 각도에서 끝 / 이만큼 움직여야 기울기 입력 활성
  character: {
    rocket: true, // 교체한 GLB 에 로켓이 이미 들어 있으면 false
    response: 9, // 기울기가 속도를 따라가는 빠르기(1/초)
    lean: 0.03, // 좌우 속도 1당 기울기(rad)
    leanMax: 0.6,
    fastFrom: 7, // 이 속도부터 "빠른 이동" 반응이 붙기 시작해
    fastTo: 15, // 이 속도에서 최대
    fastBoost: 0.7, // 빠른 이동일 때 기울기 추가 배율
    bob: 0.07, // 대기 중 위아래 흔들림 폭
    spin: 0.6, // 선택 화면 회전 속도(rad/초)
    selectScale: 2, // 선택 화면에서의 최대 크기(작은 화면에서는 자동으로 줄어든다)
    gameScale: 1.5, // 게임 중 크기. 머리 폭이 충돌 원(지름 1)과 비슷해지는 값
  },
  // 배경(대전 관광 테마 우주). 게임 로직과 무관하며 render/backdrop.ts 가 읽는다.
  scenery: {
    brightness: 0.95, // 행성 밝기. 캐릭터·운석보다 튀면 낮춘다
    planetSize: 1, // 행성 크기 배율
    spin: 0.14, // 자전 속도(rad/초)
    float: 0.04, // 위아래로 떠다니는 폭(행성 반지름 대비)
    fireworks: true, // 행성 위에서 가끔 터지는 축제 불꽃
    fireworkEverySec: [1.4, 3.6], // 불꽃 간격(최소, 최대)
    lanterns: 16, // 화면 양옆에서 떠오르는 축제 등불 수(0 이면 끔)
    // 스테이지 행성: 한 번에 그 스테이지의 행성 하나만 나온다(어느 행성인지는 game/config/stages.ts 의 planet).
    // 스테이지가 진행되는 동안 멀리(from)에서 다가와 커지면서 옆(to)으로 지나간다.
    // u·v 는 화면 자리(0 가운데 ~ 1 가장자리, 좌우는 스테이지마다 번갈아), size 는 화면 짧은 쪽 절반 대비 반지름
    tour: {
      depth: 120,
      from: { u: 0.3, v: 0.66, size: 0.05 },
      to: { u: 1.12, v: 0.05, size: 0.46 },
      ease: 2.2, // 클수록 오래 멀리 머물다가 끝에 빠르게 지나간다
      idleSec: 7, // 타이틀·선택 화면에서 행성을 하나씩 바꿔 보여 주는 간격
    },
  },
  camera: { dist: 7.5, height: 2.4, follow: 0.55, fovMin: 50, fovMax: 82, roll: 0.008 },
  quality: {
    // 느리면 위에서 아래로 한 단계씩 내려간다
    levels: [
      // extras: 등불·불꽃 같은 배경 장식
      { pixelRatio: 2, stars: 1400, particles: 1, extras: true },
      { pixelRatio: 1.5, stars: 1000, particles: 0.7, extras: true },
      { pixelRatio: 1, stars: 600, particles: 0.5, extras: false },
      { pixelRatio: 0.75, stars: 300, particles: 0.3, extras: false },
    ],
    windowMs: 2000, // 평균을 내는 구간
    firstStepFps: 50, // 0→1단계는 이 fps 아래면 내림(픽셀 비율만 살짝)
    minFps: 27, // 그 뒤로는 30fps를 못 지킬 때만 내림
  },
  idleSec: 30, // 입력이 없으면 타이틀로
  countdownStepSec: 0.8,
} as const;

// 캐릭터를 추가하려면 여기와 assets/characters.ts 의 procedural 에 한 줄씩 넣는다(선택 화면은 자동으로 늘어난다)
export type PlanetType =
  | 'station' | 'skyroad' | 'bakery' | 'daeheung' | 'expoBridge' | 'arboretum'
  | 'hanbit' | 'onsen' | 'forest' | 'gyejok' | 'lake' | 'festival';
export type CharacterId = 'kkumdori';
export const CHARACTERS: Record<CharacterId, string> = { kkumdori: '꿈돌이' };
