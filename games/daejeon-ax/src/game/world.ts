import { CONFIG } from '../config';
import type { InputState } from '../input';
import { advanceLasers, fireDistance, laserCount, sideLanes, type Laser } from './boss/laser';
import { sweptHit } from './collision';
import { EVENT_RULES, type EventId } from './config/events';
import { BREADS, ITEM_RULES, type FoodId } from './config/items';
import { PRESETS, type DifficultyId, type Preset } from './config/presets';
import type { StageDef } from './config/stages';
import { curveOf, levelAt, type CurveFns } from './difficulty';
import { EventDirector, stormLane, type ActiveEvent } from './events/director';
import { eatFood, nextFoodDelay, pickFood } from './items/foods';
import { nextWave, type Meteor } from './meteors';
import { PICKUP_RADIUS, type Pickup } from './pickups';
import { movePlayer, type Player } from './player';
import { phaseOf, type Phase } from './progression/phase';

export interface GameEvent {
  /**
   * level: 다음 스테이지로 넘어감 / clear: 마지막 스테이지까지 완주
   * dodge: 운석을 피함 / food: 음식을 먹음 / guard: 방어가 충돌을 막고 사라짐
   * event: 돌발 이벤트 시작 / laser: 레이저가 켜짐 / bomb: 운석이 한꺼번에 사라짐
   * bossDown: 보스 스테이지를 버텨 냄
   */
  type:
    | 'hit' | 'block' | 'star' | 'whoosh' | 'shield' | 'level' | 'dead' | 'clear'
    | 'dodge' | 'food' | 'guard' | 'event' | 'laser' | 'bomb' | 'bossDown';
  x: number;
  food?: FoodId;
  event?: EventId;
}

const { field: F, player: P, meteor: M, difficulty: D, score: S } = CONFIG;
const STAGES = CONFIG.stages;
/** 운석이 플레이어를 이만큼 지나가면 "피했다"고 친다 */
const DODGE_Z = 1.5;
const TIMERS = ['invuln', 'shield', 'shieldCooldown', 'double', 'starpower', 'slow', 'tough', 'magnet', 'transition', 'protect'] as const;

/**
 * 게임 규칙 전체. 렌더·입력 방식과 무관하게 step(dt, input)만으로 돈다.
 * 음식·돌발 이벤트·보스·진행 상태는 각각 items/ events/ boss/ progression/ 모듈이 맡고,
 * 여기서는 그 모듈들을 한 프레임 순서에 맞춰 부른다.
 */
export class World {
  time = 0;
  lives: number;
  readonly maxLives: number;
  stars = 0;
  /** 먹은 음식 수 */
  foods = 0;
  /** 연속으로 피한 운석 수(맞으면 0으로) */
  combo = 0;
  /** 피버 게이지 0~100. 가득 차면 대전 피버가 시작된다 */
  gauge = 0;
  /** 충돌을 한 번 막아 주는 방어(0 또는 1) */
  guard = 0;
  /** 맞은 뒤의 무적(깜빡임) */
  invuln = 0;
  shield = 0;
  shieldCooldown = 0;
  /** 아래는 음식 능력의 남은 시간 */
  double = 0;
  starpower = 0;
  slow = 0;
  tough = 0;
  magnet = 0;
  /** 스테이지가 바뀐 직후 숨 고르기 남은 시간 */
  transition = 0;
  /** 보호 시간: 카메라가 다시 잡힌 직후처럼, 맞지 않게 지켜 주는 동안 */
  protect = 0;
  over = false;
  /** 마지막 스테이지까지 살아남아 끝났다 */
  cleared = false;
  readonly player: Player = { x: 0, vx: 0 };
  readonly meteors: Meteor[] = [];
  readonly pickups: Pickup[] = [];
  readonly lasers: Laser[] = [];
  /** 이번 step 에서 생긴 일. 호출한 쪽이 읽고 비운다. */
  readonly events: GameEvent[] = [];
  readonly halfWidth: number;
  readonly preset: Preset;

  private curve: CurveFns;
  private spacing: number;
  private travelled: number;
  private safeLane: number;
  private recent: number[] = [];
  private nextId = 1;
  private waveNo = 0;
  private stormDir = 1;
  private foodIn: number;
  /** 생존 시간 점수 외에 얻은 점수(회피·별·음식·클리어 보너스) */
  private bonus = 0;
  private director = new EventDirector();

  constructor(
    readonly lanes: number,
    private rand: () => number = Math.random,
    readonly difficulty: DifficultyId = D.default,
  ) {
    this.preset = PRESETS[difficulty];
    this.curve = curveOf(this.preset);
    this.lives = this.maxLives = this.preset.lives;
    this.halfWidth = ((lanes - 1) / 2) * F.laneWidth;
    this.safeLane = (lanes - 1) >> 1;
    this.spacing = this.spacingNow();
    this.travelled = this.spacing; // 첫 웨이브는 시작하자마자 생성
    this.foodIn = nextFoodDelay(this.stageDef, this.rand, this.preset.foodEvery);
  }

  get level() {
    return levelAt(this.time);
  }
  /** 지금 지나는 스테이지(0부터) */
  get stage() {
    return Math.min(this.level, STAGES.length - 1);
  }
  get stageDef(): StageDef {
    return STAGES[this.stage];
  }
  /** 이 스테이지가 시작된 뒤 흐른 시간 */
  get stageTime() {
    return this.time - this.stage * D.stepSec;
  }
  /** 끝까지 지나온 여행지 수(관광 스탬프) */
  get stamps() {
    return this.cleared ? STAGES.length : this.stage;
  }
  get speed() {
    return this.curve.speedAt(this.level) * (this.slow > 0 ? ITEM_RULES.slowFactor : 1);
  }
  /** 지금 부는 옆바람(단위/초, +면 오른쪽). 좌우로 천천히 번갈아 분다 */
  get wind() {
    const strength = this.stageDef.wind ?? 0;
    return strength && this.transition <= 0 ? strength * Math.sin((this.stageTime * Math.PI * 2) / 3.6) : 0;
  }
  get phase(): Phase {
    return phaseOf(this);
  }
  /** 켜져 있는 돌발 이벤트(경고 중 포함). 없으면 null */
  get event(): ActiveEvent | null {
    return this.director.active;
  }
  /** 그 이벤트의 효과가 지금 켜져 있는지 */
  eventOn(id: EventId): boolean {
    return this.director.is(id);
  }
  /** 대전 피버 남은 시간(켜져 있지 않으면 0) */
  get fever() {
    return this.eventOn('fever') ? this.director.active!.left : 0;
  }
  /** 점수 2배가 켜져 있으면 2. 튀김소보로와 대전 피버가 겹쳐도 더 커지지 않는다 */
  get multiplier() {
    return this.double > 0 || this.fever > 0 ? ITEM_RULES.doubleMultiplier : 1;
  }
  /** 연속 회피 배율: 1배에서 시작해 최대 3배 */
  get comboMultiplier() {
    return Math.min(S.comboMax, 1 + Math.floor(this.combo / S.comboEvery) * S.comboStep);
  }
  get score() {
    return Math.floor(this.time * S.perSecond + this.bonus);
  }

  laneX(lane: number) {
    return (lane - (this.lanes - 1) / 2) * F.laneWidth;
  }

  /** 0~1 난수 하나(랜덤 요소가 같은 난수원을 쓰도록) */
  roll(): number {
    return this.rand();
  }

  /** 점수를 더한다(점수 2배가 켜져 있으면 적용) */
  addScore(points: number): void {
    this.bonus += points * this.multiplier;
  }

  /** 피버 게이지를 채운다(피버 중에는 차지 않는다) */
  addGauge(percent: number): void {
    if (this.fever <= 0) this.gauge = Math.min(100, this.gauge + percent);
  }

  /** 돌발 이벤트를 시작한다(테스트·디버그용으로도 쓴다). 조건이 맞지 않으면 false */
  startEvent(id: EventId): boolean {
    return this.director.start(this, id);
  }

  /** 화면의 운석을 모두 별 조각으로 바꾼다(딸기시루, 한빛탑 스타파워) */
  meteorsToStars(): void {
    for (const m of this.meteors) this.pickups.push({ id: this.nextId++, x: m.baseX ?? m.x, z: m.z, kind: 'star' });
    this.meteors.length = 0;
  }

  /** 화면의 일반 운석을 모두 없애고 점수를 준다(오징어두루치기). 레이저는 남는다 */
  clearMeteors(): void {
    for (const m of this.meteors) this.events.push({ type: 'bomb', x: m.x });
    this.addScore(this.meteors.length * ITEM_RULES.bombScore);
    this.meteors.length = 0;
  }

  /**
   * 충돌을 처리한다. 무적(별 잔치)·보호막·피격 후 무적·보호 시간 중에는 아무 일도 없고,
   * 방어가 있으면 방어만 사라진다.
   * @returns 충돌이 실제로 받아들여졌는지(목숨이 줄었거나 방어를 썼다)
   */
  hurt(x: number): boolean {
    if (this.starpower > 0 || this.shield > 0 || this.invuln > 0 || this.protect > 0) return false;
    if (this.guard > 0) {
      this.guard = 0;
      this.invuln = 1;
      this.events.push({ type: 'guard', x });
      return true;
    }
    this.lives--;
    this.combo = 0;
    this.invuln = P.invulnSec * (this.tough > 0 ? ITEM_RULES.toughFactor : 1);
    this.events.push({ type: 'hit', x });
    if (this.lives <= 0) {
      this.over = true;
      this.events.push({ type: 'dead', x });
    }
    return true;
  }

  step(dt: number, input: InputState): void {
    if (dt <= 0) return;
    if (this.over) {
      // 끝난 뒤에는 남은 것들만 흘려보낸다(판정·스폰 없음)
      const drift = this.speed * dt;
      for (const list of [this.meteors, this.pickups, this.lasers]) {
        for (let i = list.length - 1; i >= 0; i--) if ((list[i].z += drift) > F.despawnZ) list.splice(i, 1);
      }
      return;
    }
    const before = this.stage;
    this.time += dt;
    if (this.time >= STAGES.length * D.stepSec) {
      this.time = STAGES.length * D.stepSec;
      this.finishStage(before);
      this.over = this.cleared = true;
      this.events.push({ type: 'clear', x: this.player.x });
      return;
    }
    if (this.stage !== before) this.enterStage(before);

    for (const key of TIMERS) this[key] = Math.max(0, this[key] - dt);
    if (input.shield && this.shieldCooldown === 0) {
      this.shield = Math.max(this.shield, P.shieldSec);
      this.shieldCooldown = this.preset.shieldCooldownSec;
      this.events.push({ type: 'shield', x: this.player.x });
    }
    this.director.update(this, dt);

    const x = Math.max(-1, Math.min(1, input.x)) * this.halfWidth;
    movePlayer(this.player, x, dt);
    const wind = this.wind;
    if (wind) this.player.x = Math.max(-this.halfWidth, Math.min(this.halfWidth, this.player.x + wind * dt));

    const dz = this.speed * dt;
    this.advanceMeteors(dz);
    advanceLasers(this, dz);
    this.advancePickups(dz);
    if (this.over) return;

    this.foodIn -= dt;
    if (this.transition > 0) return; // 숨 고르기: 새 웨이브를 만들지 않는다
    this.travelled += dz;
    while (this.travelled >= this.spacing) {
      this.travelled -= this.spacing;
      this.spawnWave(-F.spawnZ + this.travelled);
    }
  }

  /** 스테이지 하나를 끝냈을 때의 보상 */
  private finishStage(index: number) {
    const def = STAGES[index];
    this.bonus += S.stageClear;
    if (!def.boss) return;
    this.bonus += S.bossClear;
    this.lasers.length = 0;
    this.events.push({ type: 'bossDown', x: this.player.x });
    if (def.onClear) this.director.start(this, def.onClear);
  }

  private enterStage(from: number) {
    this.finishStage(from);
    this.transition = D.transitionSec;
    this.foodIn = Math.min(this.foodIn, nextFoodDelay(this.stageDef, this.rand, this.preset.foodEvery) * 0.5);
    this.events.push({ type: 'level', x: this.player.x });
  }

  private advanceMeteors(dz: number) {
    const px = this.player.x;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      const z0 = m.z;
      m.z += dz;
      if (m.bend && m.baseX !== undefined) m.x = m.baseX + bendAt(m, m.z);
      if (sweptHit(m.x - px, z0, m.z, m.r * this.preset.hitScale + P.radius)) {
        if (this.shield > 0 || this.starpower > 0) {
          this.events.push({ type: 'block', x: m.x });
          this.meteors.splice(i, 1);
        } else if (this.hurt(px)) this.meteors.splice(i, 1);
        else m.through = true;
        continue;
      }
      if (z0 <= 0 && m.z > 0 && Math.abs(m.x - px) < F.laneWidth * 1.5) this.events.push({ type: 'whoosh', x: m.x });
      if (z0 <= DODGE_Z && m.z > DODGE_Z && !m.through) {
        // 피했다: 연속으로 피할수록 배율이 오른다
        this.addScore(S.dodge * this.comboMultiplier);
        this.combo++;
        this.addGauge(EVENT_RULES.gauge.dodge);
        this.events.push({ type: 'dodge', x: m.x });
      }
      if (m.z > F.despawnZ) this.meteors.splice(i, 1);
    }
  }

  private advancePickups(dz: number) {
    const reach = this.magnet > 0 ? ITEM_RULES.magnetReach : PICKUP_RADIUS;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const s = this.pickups[i];
      const z0 = s.z;
      s.z += dz;
      if (sweptHit(s.x - this.player.x, z0, s.z, reach)) {
        this.pickups.splice(i, 1);
        if (s.kind && s.kind !== 'star') eatFood(this, s.kind);
        else {
          this.stars++;
          this.addScore(S.star * (this.eventOn('jackpot') ? EVENT_RULES.jackpotMultiplier : 1));
          this.addGauge(EVENT_RULES.gauge.star);
          this.events.push({ type: 'star', x: s.x });
        }
      } else if (s.z > F.despawnZ) this.pickups.splice(i, 1);
    }
  }

  /** 지금 스테이지의 웨이브 간격(거리) */
  private spacingNow() {
    if (this.stageDef.tutorial) return this.curve.spacingAt(this.level) * this.preset.tutorialGap;
    // 랜덤 요소: 웨이브 간격이 들쭉날쭉하다. 옮겨갈 수 있는 칸 수는 실제 간격으로 다시 계산하므로 길은 계속 보장된다
    return this.curve.spacingAt(this.level) * (1 + (this.rand() * 2 - 1) * this.preset.spacingJitter);
  }

  private spawnWave(z: number) {
    const level = this.level;
    const def = this.stageDef;
    const boss = def.boss;
    this.waveNo++;
    // 보스의 공격 무늬: 엑스포 우주운석은 한 번 걸러 레이저, 우주대왕운석은 세 번에 한 번 레이저
    const laser = (boss === 'expo' && this.waveNo % 2 === 0) || (boss === 'king' && this.waveNo % 3 === 0);
    // 소용돌이: 운석 폭풍 이벤트, 소용돌이 운석, 우주대왕운석
    const swirl = !laser && (this.eventOn('storm') || boss === 'vortex' || boss === 'king');
    let count = def.tutorial ? 1 : Math.floor(this.lanes * this.curve.densityAt(level) + this.rand());
    // 레이저는 닿기 전부터 켜지므로 그만큼 옮겨갈 시간이 줄어든다
    const usable = laser ? this.spacing - fireDistance(this.curve.speedAt(level + 1)) : this.spacing;
    const maxShift = this.curve.maxShiftFor(usable, level);
    let force: number | undefined;
    if (laser) count = laserCount(this.lanes);
    else if (swirl) {
      const next = stormLane(this.safeLane, this.lanes, this.stormDir, maxShift >= 1);
      this.stormDir = next.dir;
      force = next.lane;
      count = this.lanes - 1;
    }
    const wave = nextWave(this.lanes, this.safeLane, maxShift, count, this.rand, def.tutorial ? this.recent : [], force);
    this.safeLane = wave.safeLane;
    this.recent = [...wave.blocked, ...this.recent].slice(0, 2);
    const safeX = this.laneX(wave.safeLane);
    const blocked = laser && boss === 'expo' ? sideLanes(this.lanes, wave.safeLane, this.waveNo % 4 === 0 ? 1 : -1) : wave.blocked;

    // 휘어 오는 운석: 닿는 자리는 그대로 두고 출발 위치만 옆으로 벗어나게 한다
    let curve: Meteor['curve'] = this.eventOn('wave') ? 'wave' : this.eventOn('gravity') || boss === 'vortex' || boss === 'king' ? 'gravity' : undefined;
    let side = this.waveNo % 2 ? 1 : -1;
    if (!curve && !def.tutorial && this.rand() < this.preset.bendChance) {
      // 랜덤 요소: 이벤트가 없어도 가끔 웨이브 하나가 휘어 온다
      curve = this.rand() < 0.5 ? 'gravity' : 'wave';
      side = this.rand() < 0.5 ? 1 : -1;
    }
    const bend = (curve === 'wave' ? EVENT_RULES.waveDrift : curve === 'gravity' ? EVENT_RULES.gravityBend : 0) * (curve === 'wave' && this.eventOn('wave') ? 1 : side);

    for (const lane of blocked) {
      const baseX = this.laneX(lane);
      if (this.starpower > 0) this.pickups.push({ id: this.nextId++, x: baseX, z, kind: 'star' }); // 별 잔치: 운석 대신 별
      else if (laser) this.lasers.push({ id: this.nextId++, x: baseX, z, safeX });
      else {
        const m: Meteor = {
          id: this.nextId++,
          x: baseX + (this.rand() * 2 - 1) * M.jitter,
          z,
          r: M.radiusMin + this.rand() * (M.radiusMax - M.radiusMin),
          safeX,
        };
        if (curve) Object.assign(m, { baseX: m.x, bend, curve, x: m.x + bendAt({ bend, curve }, z) });
        this.meteors.push(m);
      }
    }
    // 수집물은 언제나 안전 레인에: 따라가면 길이 되도록
    const bread = this.eventOn('bread');
    const food = bread ? pickFood(this, this.rand, BREADS) : this.foodIn <= 0 ? pickFood(this, this.rand) : null;
    if (food) {
      this.pickups.push({ id: this.nextId++, x: safeX, z, kind: food });
      if (!bread) this.foodIn = nextFoodDelay(def, this.rand, this.preset.foodEvery);
    } else if (this.eventOn('jackpot') || this.rand() < this.preset.starChance) this.pickups.push({ id: this.nextId++, x: safeX, z, kind: 'star' });
    this.spacing = this.spacingNow();
  }
}

/**
 * 휘어 오는 운석이 z 에 있을 때 제자리(baseX)에서 옆으로 벗어난 거리.
 * 플레이어에 닿는 z=0 에서는 0 이 되어, 충돌 판정은 언제나 제 레인에서 일어난다.
 */
export function bendAt(m: Pick<Meteor, 'bend' | 'curve'>, z: number): number {
  const t = Math.min(1, Math.max(0, -z) / F.spawnZ);
  return (m.bend ?? 0) * (m.curve === 'wave' ? t : t * t);
}
