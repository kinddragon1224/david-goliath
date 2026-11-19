import qrcode from 'qrcode-generator';
import { loadCharacter } from './assets/characters';
import { Sfx } from './audio/sfx';
import { CHARACTERS, CONFIG, type CharacterId } from './config';
import { movePlayer } from './game/player';
import { EVENTS } from './game/config/events';
import { FOODS } from './game/config/items';
import { PRESETS, type DifficultyId } from './game/config/presets';
import { BOSS_NAMES, type BossId } from './game/config/stages';
import { World, type GameEvent } from './game/world';
import { ManualInput } from './input';
import { KeyboardInput } from './input/keyboard';
import { PoseInput } from './input/pose';
import { TiltInput } from './input/tilt';
import { TouchInput } from './input/touch';
import { lanesFor } from './render/fit';
import { Quality } from './render/quality';
import { View, type ViewMode } from './render/scene';
import './style.css';
import { formatTime, Hud } from './ui/hud';
import { $, showScreen, type Screen } from './ui/screens';

const BEST_KEY = 'daejeon-ax-2026.best.v3'; // 점수 체계가 바뀌어 예전 기록과 구분한다
const IN_APP = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(navigator.userAgent);
const CAN_CAMERA = !!navigator.mediaDevices?.getUserMedia;
const COARSE = matchMedia('(pointer: coarse)').matches;
/** 다른 앱(위브온 체험 고르기)에서 ?home=주소 로 들어왔으면 돌아갈 곳. 같은 출처의 주소만 받는다(엉뚱한 사이트로 보내지 않게) */
const HOME = (() => {
  try {
    const raw = new URLSearchParams(location.search).get('home');
    const url = raw ? new URL(raw, location.href) : null;
    return url && url.origin === location.origin ? url.href : null;
  } catch {
    return null;
  }
})();
let leaving = false;
function goHome(): void {
  if (!HOME || leaving) return;
  leaving = true;
  location.replace(HOME);
}
/** 카메라 없이 하는 조종. 터치 기기는 끌기·기울이기, 그 밖에는 키보드로 안내한다 */
const MANUAL = COARSE
  ? { title: '손으로 조종', desc: '화면을 좌우로 끌거나 기기를 기울여요', meta: '' }
  : { title: '키보드로 조종', desc: '← → 또는 A D 키로 피해요', meta: '스페이스 키를 누르면 보호막' };
const CAMERA_HELP = IN_APP
  ? `이 앱 안의 브라우저에서는 카메라가 막혀 있어요. Safari 또는 Chrome에서 열면 몸으로 조종할 수 있어요. 지금은 ${MANUAL.title}을 골라 주세요.`
  : `카메라를 사용할 수 없어요. 브라우저에서 카메라 권한을 허용하거나 ${MANUAL.title}을 골라 주세요.`;

// ── 구성 요소 ─────────────────────────────────
const view = new View($<HTMLCanvasElement>('stage'));
const quality = new Quality((q) => view.applyQuality(q));
const sfx = new Sfx();
const hud = new Hud();
const pose = new PoseInput();
const tilt = new TiltInput();
const manual = new ManualInput([new KeyboardInput(), new TouchInput(), tilt]);
const video = $<HTMLVideoElement>('cam');
const camwrap = $('camwrap');
pose.overlay = $<HTMLCanvasElement>('skeleton');

// ── 상태 ─────────────────────────────────────
let screen: Screen = 'loading';
let character: CharacterId = 'kkumdori';
let difficulty: DifficultyId = CONFIG.difficulty.default;
let wasPaused = false; // 인식이 끊겨 멈춰 있었는지(재개 직후 보호 시간을 주기 위해)
let world: World | null = null;
let usePose = false;
let poseFailed = false;
let hiddenPause = false; // 탭이 가려졌다 돌아온 뒤, 입력이 있을 때까지 멈춤
let countN = 3;
let countT = 0;
let overT = 0;
let calStable = 0;
let calAnchor = 0.5;
let lastActivity = performance.now();
let lastFrame = performance.now();
let wake: WakeLockSentinel | null = null;

function go(next: Screen): void {
  screen = next;
  showScreen(next);
  lastActivity = performance.now();
  if (next !== 'play') {
    setPause(null);
    $('stage-banner').hidden = true;
  }
  // 그 화면에서 가장 먼저 누를 버튼에 포커스: 엔터로 바로 진행하고 방향키로 옮겨 간다
  (document.activeElement as HTMLElement | null)?.blur();
  const first: Partial<Record<Screen, string>> = {
    title: '#btn-start',
    select: `.card[data-difficulty="${difficulty}"]`,
    permission: '#btn-camera:enabled, #btn-nocam',
    result: '#btn-retry',
  };
  if (first[next]) document.querySelector<HTMLElement>(first[next])?.focus();
}

/** 한 단계 뒤로. 게임 중·결과 화면에서는 타이틀로 */
function back(): void {
  if (screen === 'loading') return;
  if (screen === 'title') return goHome();
  if (screen === 'permission') return go('select');
  if (screen === 'calibrate') {
    stopCamera();
    return enterPermission();
  }
  goTitle();
}

/**
 * 화면 위쪽에 잠깐 뜨는 안내: 작은 머리글, 큰 제목, 한 줄 설명.
 * @param kind 색을 정한다 — stage(금색) / boss(빨강) / event(하늘) / food(연두) / clear(분홍)
 */
function announce(head: string, title: string, hint = '', kind: 'stage' | 'boss' | 'event' | 'food' | 'clear' = 'stage'): void {
  const banner = $('stage-banner');
  banner.dataset.kind = kind;
  $('stage-no').textContent = head;
  $('stage-name').textContent = title;
  $('stage-hint').textContent = hint;
  banner.hidden = false;
  banner.classList.remove('show');
  void banner.offsetWidth; // 애니메이션을 처음부터 다시
  banner.classList.add('show');
}

/** 스테이지가 바뀔 때 여행지 이름과 그 스테이지의 특징을 알린다. 방금 보스를 넘겼으면 그 사실을 머리글에 적는다 */
function announceStage(stage: number, beaten?: BossId): void {
  const def = CONFIG.stages[stage];
  const no = `STAGE ${String(stage + 1).padStart(2, '0')} / ${CONFIG.stages.length}`;
  const head = beaten ? `${BOSS_NAMES[beaten]} 격파! +${CONFIG.score.bossClear.toLocaleString('ko-KR')}` : def.boss ? `BOSS · ${no}` : no;
  announce(head, def.name, def.hint, def.boss ? 'boss' : 'stage');
}

/** 게임에서 생긴 일을 소리·연출·안내로 옮긴다 */
function react(w: World, e: GameEvent, frame: GameEvent[]): void {
  if (e.type === 'hit') {
    view.hitFx(e.x, w.over);
    sfx.hit();
    navigator.vibrate?.(80);
  } else if (e.type === 'dead') sfx.over();
  else if (e.type === 'block' || e.type === 'guard') (view.blockFx(e.x), sfx.block());
  else if (e.type === 'bomb') view.smashFx(e.x);
  else if (e.type === 'star') (view.starFx(e.x), sfx.pickup());
  else if (e.type === 'whoosh') sfx.whoosh();
  else if (e.type === 'shield') sfx.shield();
  else if (e.type === 'laser') sfx.laser();
  else if (e.type === 'food' && e.food) {
    // 무엇을 먹었고 어떤 능력이 생겼는지 바로 알려 준다
    const food = FOODS[e.food];
    view.foodFx(e.x);
    sfx.food();
    announce(food.shop ? `${food.shop} ${food.name}` : food.name, `${food.power}!`, food.hint, 'food');
  } else if (e.type === 'event' && e.event) {
    const def = EVENTS[e.event];
    if (e.event === 'fever') sfx.fever();
    else if (e.event === 'storm') sfx.storm();
    else sfx.levelUp();
    announce(def.warnSec > 0 ? 'WARNING' : 'EVENT', `${def.name}!`, def.hint, 'event');
  } else if (e.type === 'bossDown') {
    view.bossDownFx();
    sfx.clear();
  } else if (e.type === 'level') {
    // 다음 여행지 도착
    sfx.levelUp();
    view.arrive(w.stage);
    announceStage(w.stage, frame.some((x) => x.type === 'bossDown') ? CONFIG.stages[w.stage - 1].boss : undefined);
  } else if (e.type === 'clear') {
    // 완주: 축제 피날레
    sfx.clear();
    sfx.fever();
    view.finale();
    announce('ALL CLEAR', '대전 여행 완주!', '축제가 시작됐어요 · 모든 여행지에 스탬프를 찍었어요', 'clear');
  }
}
function setPause(text: string | null): void {
  $('pause').hidden = text === null;
  if (text !== null) $('pause-text').textContent = text;
}

async function wakeOn(): Promise<void> {
  try {
    wake = (await navigator.wakeLock?.request('screen')) ?? null;
  } catch {
    // 미지원·거부는 조용히 넘어간다
  }
}
function wakeOff(): void {
  void wake?.release().catch(() => {});
  wake = null;
}

function loadBest(): { score: number; time: number } {
  try {
    const v = JSON.parse(localStorage.getItem(BEST_KEY) ?? 'null');
    if (v && typeof v.score === 'number' && typeof v.time === 'number') return v;
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)
  }
  return { score: 0, time: 0 };
}
function saveBest(best: { score: number; time: number }): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // 저장 실패는 무시
  }
}

// ── 화면 전환 ─────────────────────────────────
function goTitle(): void {
  stopCamera();
  world = null;
  wakeOff();
  const best = loadBest().score;
  $('title-best').textContent = `최고 기록 ${best.toLocaleString('ko-KR')}점`;
  $('title-best').hidden = !best;
  go('title');
  startGestureCam();
}

// ── 몸짓으로 메뉴 고르기(체험 고르기에서 들어온 무인 기기: 마우스·터치 없이) ──
// 양손을 머리 위로 1초 = 시작/다시 하기, 두 팔을 가슴 앞에서 X 로 1.2초 = 체험 고르기로.
const GESTURE_SEC = { up: 1, cross: 1.2 };
let gestureT = 0;
let gestureKind: 'up' | 'cross' | null = null;

/** 타이틀에서 몸짓을 읽으려고 카메라를 미리 켠다(체험 고르기에서 들어왔을 때만: 거기서 이미 카메라를 허락했다) */
function startGestureCam(): void {
  if (!HOME || !CAN_CAMERA) return;
  loadPose();
  pose
    .startCamera(video)
    .then(() => {
      if (screen !== 'title') return;
      camwrap.hidden = false;
      $('title-gesture').hidden = false;
    })
    .catch(() => {}); // 카메라가 안 되면 버튼으로 하면 된다
}

/** 난이도 고르는 화면의 몸짓 안내(카드 아래). 처음 쓸 때 만든다. */
let selectHint: HTMLElement | null = null;
/** 몸으로 고른 난이도 카드. */
let pickedCard = -1;

/** 난이도 고르기를 몸으로: 몸을 왼쪽·가운데·오른쪽으로 옮겨 카드를 고른다(게임에서 운석을 피하는 것과 같은 동작). */
function pickDifficultyByBody(): void {
  const cards = [...$('choices').querySelectorAll<HTMLButtonElement>('.card')];
  const t = pose.tracked;
  if (!t || !cards.length) return;
  // 화면 가운데에서 어깨너비의 0.45배 이상 벗어나면 옆 카드. 한 번 고른 카드는 조금 더 벗어나야 바뀐다(경계에서 떨리지 않게)
  const off = (t.x - 0.5) / Math.max(0.05, t.width);
  const edge = pickedCard === 1 || pickedCard < 0 ? 0.45 : 0.3;
  const want = off < -edge ? 0 : off > edge ? cards.length - 1 : Math.floor(cards.length / 2);
  if (want === pickedCard) return;
  pickedCard = want;
  cards.forEach((c, i) => c.classList.toggle('body-pick', i === want));
  difficulty = cards[want].dataset.difficulty as DifficultyId;
}

function stepGesture(dt: number, now: number): void {
  const picking = screen === 'select' && !!HOME;
  const on = (screen === 'title' && !!HOME) || picking || (screen === 'result' && usePose);
  if (!on || !pose.cameraOn) return;
  if (picking) {
    if (!selectHint) {
      selectHint = document.createElement('p');
      selectHint.className = 'gesture-hint';
      $('choices').after(selectHint);
    }
    pickDifficultyByBody();
  }
  const hint = picking ? selectHint! : $(screen === 'result' ? 'result-gesture' : 'title-gesture');
  const g = now - pose.seenAt < 400 ? pose.gesture : null;
  if (pose.tracked) lastActivity = now; // 사람이 서 있으면 방치로 치지 않는다
  gestureT = g && g === gestureKind ? gestureT + dt : 0;
  gestureKind = g;
  hint.hidden = false;
  hint.classList.toggle('on', !!g);
  hint.textContent = g
    ? '좋아요, 그대로!'
    : picking
      ? '몸을 왼쪽·가운데·오른쪽으로 옮겨 고르기 · 양손 번쩍 = 결정 · 두 팔로 X = 뒤로'
      : `양손을 머리 위로 번쩍 = ${screen === 'result' ? '다시 하기' : '시작'} · 두 팔로 X = ${HOME ? '체험 고르기로' : '처음으로'}`;
  if (!g || gestureT < GESTURE_SEC[g]) return;
  gestureT = 0;
  gestureKind = null;
  if (g === 'cross') return picking ? goTitle() : HOME ? goHome() : goTitle();
  sfx.start();
  if (screen === 'result') return $('btn-retry').click();
  if (screen === 'title') {
    // 타이틀 → 난이도 고르기(몸으로 고른다). 카메라는 켜 둔 채로
    pickedCard = -1;
    return go('select');
  }
  // 난이도를 골랐다: 조종 방식 고르기는 건너뛰고(카메라가 이미 켜져 있다) 바로 자리 잡기로
  usePose = true;
  camwrap.hidden = false;
  $('btn-cam').hidden = false;
  calStable = 0;
  $('cal-bar').style.width = '0%';
  go('calibrate');
}

function stopCamera(): void {
  pose.stopCamera();
  usePose = false;
  camwrap.hidden = true;
  $('btn-cam').hidden = true;
}

function showCameraHelp(): void {
  $('cam-notice').textContent = CAMERA_HELP;
  $('cam-notice').hidden = false;
}

function enterPermission(): void {
  $('cam-notice').hidden = true;
  $<HTMLButtonElement>('btn-camera').disabled = !CAN_CAMERA;
  if (!CAN_CAMERA || IN_APP) showCameraHelp();
  go('permission');
}

async function startWithCamera(): Promise<void> {
  sfx.start();
  calStable = 0;
  $('cal-bar').style.width = '0%';
  go('calibrate');
  loadPose();
  try {
    await pose.startCamera(video);
  } catch (e) {
    console.warn('카메라 시작 실패', e);
    stopCamera();
    showCameraHelp();
    go('permission');
    return;
  }
  if (screen !== 'calibrate') return void stopCamera(); // 기다리는 사이 다른 화면으로 갔다
  usePose = true;
  camwrap.hidden = false;
  $('btn-cam').hidden = false;
}

function startManual(): void {
  sfx.start();
  stopCamera();
  void tilt.enable(); // iOS 는 이 클릭(사용자 제스처) 안에서만 권한 창을 띄울 수 있다
  startCountdown();
}

function loadPose(): void {
  poseFailed = false;
  pose.preload().catch((e) => {
    console.warn('포즈 모델 로딩 실패', e);
    poseFailed = true;
  });
}

function startCountdown(): void {
  world = new World(lanesFor(innerWidth / innerHeight), Math.random, difficulty);
  wasPaused = false;
  view.setLanes(world.lanes);
  manual.reset();
  hud.update(world);
  countN = 3;
  countT = 0;
  overT = 0;
  hiddenPause = false;
  $('count').textContent = '3';
  $('count').classList.remove('go');
  $('how').textContent = usePose
    ? `몸을 좌우로 움직여 운석을 피하세요${CONFIG.pose.enableShield ? ' · 양손을 들면 보호막' : ''}`
    : COARSE
      ? '화면을 좌우로 끌거나 기기를 기울여 피하세요'
      : '← → 또는 A / D 로 피하세요 · 스페이스: 보호막';
  sfx.count(false);
  go('countdown');
  void wakeOn();
}

function showResult(): void {
  const w = world!;
  const best = loadBest();
  const isNew = w.score > best.score;
  if (isNew) saveBest({ score: w.score, time: w.time });
  $('res-score').textContent = w.score.toLocaleString('ko-KR');
  $('res-time').textContent = formatTime(w.time);
  $('res-best').textContent = `${Math.max(best.score, w.score).toLocaleString('ko-KR')}점`;
  $('res-title').textContent = w.cleared ? '대전 여행 완주!' : '게임 종료';
  $('res-stage').textContent = w.cleared ? '최종 보스까지 물리쳤어요' : `${CONFIG.stages[w.stage].name}에서 멈췄어요`;
  $('res-stampcount').textContent = `${w.stamps}/${CONFIG.stages.length}`;
  $('res-foods').textContent = `${w.foods}개`;
  $('res-foods-row').hidden = !w.foods;
  $('res-level').textContent = w.preset.name;
  // 관광 스탬프: 끝까지 지나온 여행지마다 번호 하나씩(보너스 스테이지는 별)
  $('res-stamps').replaceChildren(
    ...CONFIG.stages.map((s, i) => {
      const dot = document.createElement('span');
      dot.className = `stamp${i < w.stamps ? ' on' : ''}${s.bonus ? ' bonus' : ''}`;
      dot.textContent = s.bonus ? '★' : String(i + 1);
      dot.title = s.name;
      return dot;
    }),
  );
  $('res-new').hidden = !isNew;
  wakeOff();
  go('result');
}

// ── 프레임별 처리 ──────────────────────────────
function stepCalibrate(dt: number, now: number): void {
  const P = CONFIG.pose;
  const t = pose.tracked && now - pose.seenAt < 300 ? pose.tracked : null;
  let message = '좋아요! 그대로 잠깐만요';
  if (poseFailed) message = `모션 인식을 불러오지 못했어요. 아래의 ${MANUAL.title}을 눌러 주세요.`;
  else if (!pose.cameraOn) message = '카메라를 켜는 중…';
  else if (!pose.modelReady) message = '모션 인식을 준비하는 중…';
  else if (!t) message = '상반신이 보이게 카메라 앞에 서 주세요';
  else if (t.width < P.minShoulderWidth) message = '조금 더 가까이 와 주세요';
  else if (Math.abs(t.x - 0.5) > P.calibrateCenter) message = '화면 가운데로 와 주세요';
  const ok = !!t && message.startsWith('좋아요');
  if (t) lastActivity = now; // 사람이 서 있으면 무입력으로 치지 않는다
  if (ok && Math.abs(t.x - calAnchor) > P.calibrateStill) {
    calAnchor = t.x; // 움직였으면 처음부터 다시 잰다
    calStable = 0;
  }
  calStable = ok ? calStable + dt : 0;
  document.body.classList.toggle('cal-ok', ok);
  $('cal-status').textContent = message;
  $('cal-bar').style.width = `${Math.min(100, (calStable / P.calibrateSec) * 100)}%`;
  if (calStable >= P.calibrateSec) {
    pose.calibrate();
    startCountdown();
  }
}

function stepCountdown(dt: number): void {
  const w = world!;
  movePlayer(w.player, currentInput().x * w.halfWidth, dt); // 출발 전에 조종을 미리 익힌다
  countT += dt;
  if (countT < CONFIG.countdownStepSec) return;
  countT = 0;
  countN--;
  if (countN < 0) {
    go('play');
    return announceStage(0);
  }
  $('count').textContent = countN ? String(countN) : '출발!';
  $('count').classList.toggle('go', countN === 0); // 글자 수가 많아 작게
  sfx.count(countN === 0);
}

const currentInput = () => (usePose ? pose.state : manual.state);

/** @returns 이번 프레임에 게임이 진행됐는지 */
function stepPlay(dt: number, now: number): boolean {
  const w = world!;
  if (w.over) {
    w.step(dt, currentInput());
    overT += dt;
    if (overT > 1.8) showResult(); // 아쉬워하는 동작이 보일 만큼 기다린다
    return true;
  }
  const lost = usePose && now - pose.seenAt > CONFIG.pose.lostSec * 1000;
  if (usePose && !lost) {
    hiddenPause = false; // 포즈 모드는 사람이 다시 잡히면 손대지 않고 재개
    lastActivity = now;
  }
  if (lost) setPause('화면 안으로 들어와 주세요');
  else if (hiddenPause) setPause('화면을 누르면 계속합니다');
  else setPause(null);
  if (lost || hiddenPause) {
    // 인식이 끊긴 동안은 게임을 멈춘다. 그 사이 입력은 마지막 위치에 고정되어 있다.
    wasPaused = true;
    return false;
  }
  if (wasPaused) {
    // 다시 잡힌 직후에는 위치가 튈 수 있으니 잠깐 보호한다(충돌·목숨 감소 없음)
    wasPaused = false;
    w.protect = Math.max(w.protect, CONFIG.pose.resumeGraceSec);
  }

  w.step(dt, currentInput());
  const frame = [...w.events];
  for (const e of frame) react(w, e, frame);
  w.events.length = 0;
  hud.update(w);
  sfx.setMusicRate(w.fever > 0 ? 1.12 : 1); // 피버 타임에는 음악이 조금 빨라진다
  return true;
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const ms = now - lastFrame;
  lastFrame = now;
  if (document.hidden) return;
  const dt = Math.min(0.05, ms / 1000);
  manual.update(dt);

  let running = true;
  stepGesture(dt, now);
  if (screen === 'calibrate') stepCalibrate(dt, now);
  else if (screen === 'countdown') stepCountdown(dt);
  else if (screen === 'play') {
    running = stepPlay(dt, now);
    if (running) quality.tick(ms);
  } else if (screen === 'result') world?.step(dt, currentInput()); // 남은 운석이 마저 지나가게

  // 무인 시연 대비: 입력 없이 방치되면 타이틀로
  const playing = (screen === 'play' && running) || screen === 'countdown';
  const idle = now - lastActivity > CONFIG.idleSec * 1000;
  if (!playing && screen !== 'title' && screen !== 'loading' && idle) goTitle();
  else if (screen === 'title' && idle) goHome(); // 타이틀에서도 방치되면 들어온 곳(체험 고르기)으로

  const inGame = screen === 'countdown' || screen === 'play' || screen === 'result';
  const mode: ViewMode = inGame ? 'game' : screen === 'select' ? 'select' : 'idle';
  const speed = !running ? 0 : screen === 'play' && world && !world.over ? world.speed : 12;
  view.update(running ? dt : 0, mode, world, character, speed);
}

// ── 이벤트 ───────────────────────────────────
$('btn-start').onclick = () => {
  sfx.start();
  go('select');
};
// 선택 화면: 난이도 카드 세 장 중 하나를 고르면 조종 방식으로 넘어간다
character = (Object.keys(CHARACTERS) as CharacterId[])[0];
$('select-lead').textContent = `${CHARACTERS[character]}와 함께 떠나요!`;
const TONES = ['mint', 'gold', 'rose']; // 쉬운 것부터 차례로
(Object.keys(PRESETS) as DifficultyId[]).forEach((id, i, all) => {
  const b = document.createElement('button');
  b.className = 'card';
  b.dataset.difficulty = id;
  b.dataset.tone = TONES[i] ?? 'gold';
  const pips = all.map((_, n) => `<i${n <= i ? ' class="on"' : ''}></i>`).join('');
  // note 는 "빠르게 · 돌발 이벤트" 꼴: 좁은 카드에서 줄이 어색하게 끊기지 않게 두 줄로 나눈다
  b.innerHTML = `<span class="pips" aria-hidden="true">${pips}</span><strong>${PRESETS[id].name}</strong><span class="desc">${PRESETS[id].note.replace(' · ', '<br>')}</span>`;
  b.onclick = () => {
    difficulty = id;
    sfx.start();
    // 체험 고르기에서 들어온 부스 기기: 키보드·터치로 조종하는 방식은 없앴다(11/19 대표님). 조종 방식 고르기를 건너뛰고 바로 카메라로
    if (HOME) return void startWithCamera();
    enterPermission();
  };
  $('choices').append(b);
});
document.body.classList.toggle('coarse', COARSE);
$('manual-title').textContent = MANUAL.title;
$('manual-desc').textContent = MANUAL.desc;
$('manual-meta').textContent = MANUAL.meta;
$('btn-skip').textContent = `${MANUAL.title}하기`;
$('btn-camera').onclick = () => void startWithCamera();
$('btn-nocam').onclick = startManual;
$('btn-skip').onclick = startManual;
$('btn-back').onclick = back;
// 메뉴의 키보드 조작: Esc 는 뒤로, 방향키는 보이는 버튼 사이를 옮겨 간다(엔터·스페이스는 버튼 기본 동작)
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') return back();
  const dir = Number(e.code === 'ArrowRight' || e.code === 'ArrowDown') - Number(e.code === 'ArrowLeft' || e.code === 'ArrowUp');
  if (!dir || screen === 'play' || screen === 'countdown') return;
  const items = [...document.querySelectorAll<HTMLElement>(`.screen[data-for="${screen}"] button:enabled`)];
  const at = items.indexOf(document.activeElement as HTMLElement);
  items[at < 0 ? 0 : (at + dir + items.length) % items.length]?.focus();
});
$('btn-retry').onclick = () => {
  if (usePose && pose.cameraOn) {
    calStable = 0; // 서 있는 자리가 바뀌었을 수 있으니 기준점을 다시 잡는다(자동, 2초)
    go('calibrate');
  } else if (usePose) void startWithCamera();
  else startCountdown();
};
// 체험 고르기에서 들어왔으면 결과 화면의 두 번째 버튼과 타이틀의 작은 버튼이 그리로 돌아간다
$('btn-home').onclick = HOME ? goHome : goTitle;
if (HOME) $('btn-home').textContent = '체험 고르기로';
$('btn-exit').hidden = !HOME;
$('btn-skip').hidden = !!HOME; // 부스 기기: 자리 잡기 화면의 "키보드/터치로 하기"도 숨긴다
$('btn-exit').onclick = goHome;
$('btn-mute').onclick = () => {
  sfx.setMuted(!sfx.muted);
  document.body.classList.toggle('muted', sfx.muted);
};
$('btn-cam').onclick = () => document.body.classList.toggle('cam-off');
// 효과 줄이기: 기기 설정(동작 줄이기)을 따르고, 버튼으로 바꿀 수 있다
const setReduced = (on: boolean) => {
  document.body.classList.toggle('fx-reduced', on);
  view.setReduced(on);
};
setReduced(matchMedia('(prefers-reduced-motion: reduce)').matches);
$('btn-fx').onclick = () => setReduced(!document.body.classList.contains('fx-reduced'));

video.addEventListener('loadedmetadata', () => {
  const ar = video.videoWidth / video.videoHeight || 4 / 3;
  camwrap.style.setProperty('--cam-ar', String(ar));
  pose.overlay!.height = Math.round(pose.overlay!.width / ar);
});

for (const type of ['pointerdown', 'keydown'] as const) {
  addEventListener(type, () => {
    lastActivity = performance.now();
    hiddenPause = false;
  });
}
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('gesturestart', (e) => e.preventDefault()); // 구형 iOS 핀치줌

// 백그라운드로 가면 일시정지하고 카메라·오디오를 멈춘다
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenPause = screen === 'play';
    pose.stopCamera();
    sfx.suspend();
    return;
  }
  lastFrame = lastActivity = performance.now();
  sfx.resume();
  if (screen === 'play' || screen === 'countdown') void wakeOn();
  if (usePose) {
    pose.startCamera(video).catch(() => {
      stopCamera();
      showCameraHelp();
      go('permission');
    });
  }
});

// ── 시작 ─────────────────────────────────────
async function boot(): Promise<void> {
  const ids = Object.keys(CHARACTERS) as CharacterId[];
  let done = 0;
  await Promise.all(
    ids.map(async (id) => {
      view.setCharacter(id, await loadCharacter(id));
      $('load-bar').style.width = `${25 + (75 * ++done) / ids.length}%`;
    }),
  );
  const qr = qrcode(0, 'M');
  qr.addData(location.origin + location.pathname); // 휴대폰에는 ?home= 없이 게임 주소만
  qr.make();
  $('qr-code').innerHTML = qr.createSvgTag({ scalable: true, margin: 0 });
  goTitle();
  if (CAN_CAMERA) loadPose(); // 타이틀 화면에 있는 동안 모델(약 20MB)을 미리 받아 둔다
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  $('load-text').textContent = '이 기기에서는 게임을 시작할 수 없어요. 다른 브라우저로 열어 주세요.';
});

if (import.meta.env.DEV) Object.assign(window, { __ax: { view, pose, manual, world: () => world } });
