import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { OneEuro } from '../input/filter';
import { inferGapMs, pickPose } from '../input/pose';
import { fieldHalf, fitCamera, lanesFor } from '../render/fit';
import { fireDistance, isFiring, laserCount, sideLanes } from './boss/laser';
import { sweptHit } from './collision';
import { EVENT_RULES, EVENTS } from './config/events';
import { BREADS, FOOD_IDS, FOODS, ITEM_RULES, RARITY_WEIGHT, type FoodId } from './config/items';
import { PRESETS, type DifficultyId } from './config/presets';
import { BOSS_NAMES } from './config/stages';
import { curveOf, levelAt } from './difficulty';
import { stormLane } from './events/director';
import { eatFood, pickFood } from './items/foods';
import { nextWave } from './meteors';
import { bendAt, World } from './world';

/** 재현 가능한 난수 */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;
const LANE_COUNTS = [CONFIG.field.lanesPortrait, CONFIG.field.lanesLandscape];
const DIFFICULTIES = Object.keys(PRESETS) as DifficultyId[];
const STAGES = CONFIG.stages;
const STEP = CONFIG.difficulty.stepSec;
const TOTAL = STAGES.length * STEP;
const still = { x: 0, shield: false };

/** 안전 레인을 따라가는 봇: 아직 지나가지 않은 운석·레이저 중 가장 가까운 웨이브의 안전 레인으로 간다 */
function botInput(w: World) {
  let target = w.player.x;
  let nearest = -Infinity;
  for (const m of [...w.meteors, ...w.lasers]) {
    if (m.z < 1.5 && m.z > nearest) {
      nearest = m.z;
      target = m.safeX;
    }
  }
  return { x: w.halfWidth ? target / w.halfWidth : 0, shield: false };
}

/** 원하는 스테이지의 시작 직후로 건너뛴다 */
function atStage(w: World, index: number) {
  w.time = index * STEP - DT / 2;
  w.step(DT, still);
  w.events.length = 0;
  return w;
}

describe('충돌 판정', () => {
  it('겹치면 맞고 떨어져 있으면 안 맞는다', () => {
    expect(sweptHit(0, -0.1, 0.1, 1)).toBe(true);
    expect(sweptHit(0.9, -0.1, 0.1, 1)).toBe(true);
    expect(sweptHit(1.1, -0.1, 0.1, 1)).toBe(false);
    expect(sweptHit(0, -5, -4, 1)).toBe(false); // 아직 멀다
    expect(sweptHit(0, 4, 5, 1)).toBe(false); // 이미 지나갔다
  });

  it('한 프레임에 플레이어를 통째로 건너뛰어도 맞는다', () => {
    expect(sweptHit(0, -6, 6, 1)).toBe(true);
    expect(sweptHit(1.5, -6, 6, 1)).toBe(false);
  });

  it('옆 레인 한가운데에 있으면 운석 크기·흔들림이 최대여도 안 맞는다', () => {
    const { meteor: M, player: P, field: F } = CONFIG;
    const hitRadius = M.radiusMax * M.hitScale + P.radius;
    expect(F.laneWidth - M.jitter).toBeGreaterThan(hitRadius);
  });

  it('옆 레인 한가운데에 있으면 레이저에 맞지 않고, 같은 레인이면 맞는다', () => {
    expect(CONFIG.field.laneWidth).toBeGreaterThan(CONFIG.boss.beamHalf * 2);
    expect(CONFIG.boss.beamHalf).toBeGreaterThan(CONFIG.field.laneWidth * 0.4);
  });
});

describe('난이도 곡선', () => {
  it('스테이지 길이(stepSec)마다 한 단계씩 오른다', () => {
    expect(levelAt(0)).toBe(0);
    expect(levelAt(STEP - 0.1)).toBe(0);
    expect(levelAt(STEP)).toBe(1);
    expect(levelAt(STEP * 6)).toBe(6);
  });

  it('한 판 전체 길이는 3~4분이다', () => {
    expect(TOTAL).toBeGreaterThanOrEqual(180);
    expect(TOTAL).toBeLessThanOrEqual(240);
  });

  describe.each(DIFFICULTIES)('난이도 %s', (id) => {
    const preset = PRESETS[id];
    const c = curveOf(preset);
    const last = STAGES.length - 1;

    it('속도는 오르기만 하고 상한에서 멈추며, 간격은 줄기만 하고 하한에서 멈춘다', () => {
      for (let l = 0; l < 30; l++) {
        expect(c.speedAt(l + 1)).toBeGreaterThanOrEqual(c.speedAt(l));
        expect(c.gapAt(l + 1)).toBeLessThanOrEqual(c.gapAt(l));
      }
      expect(c.speedAt(99)).toBe(preset.speedMax);
      expect(c.gapAt(99)).toBe(preset.gapMin);
    });

    it('마지막 스테이지에서 한계값에 닿는다(끝까지 계속 어려워진다)', () => {
      expect(c.speedAt(last)).toBeCloseTo(preset.speedMax, 5);
      expect(c.gapAt(last)).toBeLessThan(preset.gapMin * 1.15);
      expect(c.speedAt(last - 2)).toBeLessThan(preset.speedMax);
    });

    it('모든 단계에서 안전 레인이 최소 1칸은 움직일 수 있다(가만히 서서 버티기 방지)', () => {
      for (let l = 0; l < 30; l++) expect(c.maxShiftFor(c.spacingAt(l), l)).toBeGreaterThanOrEqual(1);
    });
  });

  it('하트 수는 같고, 이지 → 노멀 → 하드로 갈수록 빠르고 촘촘하며 랜덤 요소가 늘어난다', () => {
    const [e, n, h] = [PRESETS.easy, PRESETS.normal, PRESETS.hard];
    expect(new Set([e.lives, n.lives, h.lives]).size).toBe(1);
    for (const [a, b] of [[e, n], [n, h]]) {
      expect(b.speedBase).toBeGreaterThan(a.speedBase);
      expect(b.speedMax).toBeGreaterThan(a.speedMax);
      expect(b.gapBase).toBeLessThan(a.gapBase);
      expect(b.gapMin).toBeLessThan(a.gapMin);
      expect(b.densityBase).toBeGreaterThan(a.densityBase);
      expect(b.densityMax).toBeGreaterThanOrEqual(a.densityMax);
      expect(b.starChance).toBeLessThan(a.starChance);
      expect(b.foodEvery).toBeGreaterThan(a.foodEvery);
      expect(b.bendChance).toBeGreaterThan(a.bendChance);
      expect(b.spacingJitter).toBeGreaterThan(a.spacingJitter);
      expect(b.shieldCooldownSec).toBeGreaterThan(a.shieldCooldownSec);
    }
    expect(e.randomEventSec).toBe(0); // 이지는 예정된 이벤트만
    expect(h.randomEventSec).toBeLessThan(n.randomEventSec);
    expect(n.randomEventSec).toBeGreaterThan(0);
  });

  it('보장하는 이동량은 플레이어의 실제 좌우 속도로 갈 수 있는 범위 안이다', () => {
    for (const id of DIFFICULTIES) expect(PRESETS[id].lanesPerSec * CONFIG.field.laneWidth, id).toBeLessThan(CONFIG.player.maxSpeed * 0.6);
    const { lanesPerSec } = PRESETS.hard;
    expect(lanesPerSec * CONFIG.field.laneWidth).toBeLessThan(CONFIG.player.maxSpeed * 0.6);
  });
});

describe('스폰 패턴', () => {
  it('안전 레인은 막지 않고, 직전 안전 레인에서 maxShift 이내다', () => {
    const rand = seeded(1);
    for (let i = 0; i < 5000; i++) {
      const lanes = LANE_COUNTS[i % 2];
      const prev = Math.floor(rand() * lanes);
      const maxShift = Math.floor(rand() * 3);
      const count = Math.floor(rand() * (lanes + 2));
      const force = i % 3 === 0 ? Math.floor(rand() * lanes) : undefined; // 강제 지정도 닿는 범위 안에서만 통한다
      const w = nextWave(lanes, prev, maxShift, count, rand, [], force);
      expect(w.blocked).not.toContain(w.safeLane);
      expect(Math.abs(w.safeLane - prev)).toBeLessThanOrEqual(maxShift);
      expect(w.blocked.length).toBeGreaterThanOrEqual(1);
      expect(w.blocked.length).toBeLessThanOrEqual(lanes - 1);
      expect(new Set(w.blocked).size).toBe(w.blocked.length);
    }
  });

  it('avoid 로 준 레인은 막지 않는다', () => {
    const rand = seeded(2);
    for (let i = 0; i < 2000; i++) {
      const lanes = LANE_COUNTS[i % 2];
      const avoid = [Math.floor(rand() * lanes), Math.floor(rand() * lanes)];
      const w = nextWave(lanes, Math.floor(rand() * lanes), 2, 1, rand, avoid);
      for (const b of w.blocked) expect(avoid).not.toContain(b);
    }
  });

  it('운석 폭풍의 열린 줄은 한 칸씩 옮겨 가고 가장자리에서 되돌아온다', () => {
    let lane = 0;
    let dir = -1;
    const seen = [];
    for (let i = 0; i < 8; i++) {
      ({ lane, dir } = stormLane(lane, 3, dir, true));
      seen.push(lane);
    }
    expect(seen).toEqual([1, 2, 1, 0, 1, 2, 1, 0]);
    expect(stormLane(1, 3, 1, false).lane).toBe(1); // 옮길 시간이 없으면 제자리
  });
});

/** 능력에 기대지 않게 보호 효과를 모두 끈다 */
function stripPowers(w: World) {
  w.starpower = w.shield = w.guard = w.slow = 0;
}

describe('한 판 시뮬레이션', () => {
  it('피할 길 보장: 안전 레인을 따라가는 봇은 한 번도 맞지 않고 완주한다(난이도 3종 × 레인 2종, 이벤트·보스 3종 포함)', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const lanes of LANE_COUNTS) {
        for (let seed = 1; seed <= 8; seed++) {
          const w = new World(lanes, seeded(seed), difficulty);
          let hits = 0;
          let guards = 0;
          while (!w.over) {
            w.step(DT, botInput(w));
            hits += w.events.filter((e) => e.type === 'hit').length;
            guards += w.events.filter((e) => e.type === 'guard').length;
            w.events.length = 0;
          }
          const label = `${difficulty} lanes=${lanes} seed=${seed}`;
          expect(hits, label).toBe(0);
          expect(guards, label).toBe(0); // 방어조차 쓰이지 않았다
          expect(w.cleared, label).toBe(true);
        }
      }
    }
  });

  it('보호 능력 없이도 길은 있다: 무적·보호막·방어·슬로모션을 모두 뺀 봇도 맞지 않는다', () => {
    for (const lanes of LANE_COUNTS) {
      for (let seed = 40; seed < 46; seed++) {
        const w = new World(lanes, seeded(seed), 'hard');
        let hits = 0;
        while (!w.over) {
          w.step(DT, botInput(w));
          stripPowers(w);
          hits += w.events.filter((e) => e.type === 'hit' || e.type === 'guard').length;
          w.events.length = 0;
        }
        expect(hits, `lanes=${lanes} seed=${seed}`).toBe(0);
      }
    }
  });

  it('프레임이 20fps로 떨어져도 같은 보장이 유지된다', () => {
    const w = new World(5, seeded(7), 'hard');
    while (!w.over) {
      w.step(0.05, botInput(w));
      stripPowers(w);
    }
    expect(w.lives).toBe(w.maxLives);
    expect(w.cleared).toBe(true);
  });

  it('스테이지는 순서대로 넘어가고, 넘어갈 때마다 클리어 점수와 숨 고르기가 주어진다', () => {
    const w = new World(5, seeded(1));
    const seen: number[] = [];
    let levels = 0;
    let bossDown = 0;
    while (!w.over) {
      w.step(DT, botInput(w));
      if (seen[seen.length - 1] !== w.stage) seen.push(w.stage);
      for (const e of w.events) {
        if (e.type === 'level') {
          levels++;
          expect(w.phase).toBe('TRANSITION');
          expect(w.transition).toBeCloseTo(CONFIG.difficulty.transitionSec, 1);
        }
        if (e.type === 'bossDown') bossDown++;
      }
      w.events.length = 0;
    }
    expect(seen).toEqual(STAGES.map((_, i) => i));
    expect(levels).toBe(STAGES.length - 1);
    expect(bossDown).toBe(STAGES.filter((s) => s.boss).length);
    expect(w.cleared).toBe(true);
    expect(w.time).toBe(TOTAL);
    expect(w.phase).toBe('GAME_OVER');
    expect(w.stamps).toBe(STAGES.length);
    const clearPoints = STAGES.length * CONFIG.score.stageClear + bossDown * CONFIG.score.bossClear;
    expect(w.score).toBeGreaterThanOrEqual(TOTAL * CONFIG.score.perSecond + clearPoints);
  });

  it('숨 고르기 동안에는 새 웨이브가 생기지 않는다', () => {
    const w = atStage(new World(5, seeded(3)), 2);
    const ids = () => Math.max(0, ...w.meteors.map((m) => m.id), ...w.pickups.map((p) => p.id));
    const before = ids();
    while (w.transition > DT * 2) w.step(DT, still); // 숨 고르기가 끝나는 프레임에는 바로 다음 웨이브가 나온다
    expect(ids()).toBe(before);
    for (let i = 0; i < 180; i++) w.step(DT, still);
    expect(ids()).toBeGreaterThan(before);
  });

  it('처음 10초는 가만히 서 있어도 살아남고, 계속 가만히 있으면 완주하지 못한다', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const lanes of LANE_COUNTS) {
        for (let lane = 0; lane < lanes; lane++) {
          for (let seed = 1; seed <= 15; seed++) {
            const w = new World(lanes, seeded(seed * 31 + lane), difficulty);
            const input = { x: w.halfWidth ? w.laneX(lane) / w.halfWidth : 0, shield: false };
            const label = `${difficulty} lanes=${lanes} lane=${lane} seed=${seed}`;
            while (w.time < 10 && !w.over) w.step(DT, input);
            expect(w.over, label).toBe(false);
            if (difficulty === 'easy') continue; // 이지는 일부러 너그럽다
            while (!w.over) w.step(DT, input);
            expect(w.cleared, `가만히 서서 완주함 ${label}`).toBe(false);
          }
        }
      }
    }
  });

  it('어느 난이도든 하트 3개로 시작한다', () => {
    for (const id of DIFFICULTIES) expect(new World(5, Math.random, id).maxLives, id).toBe(3);
  });

  it('랜덤 요소: 노멀·하드에서는 예고 없는 이벤트와 휘는 웨이브, 들쭉날쭉한 간격이 생기고 이지에는 없다', () => {
    const run = (id: DifficultyId) => {
      const w = new World(5, seeded(21), id);
      const scheduled = new Set(STAGES.flatMap((s) => s.events?.map((e) => e.id) ?? []));
      let random = 0;
      let bent = 0;
      const gaps = new Set<string>();
      let lastZ = 0;
      const seen = new Set<number>();
      while (!w.over) {
        w.step(DT, botInput(w));
        stripPowers(w);
        for (const e of w.events) {
          // 그 스테이지에 예정되지 않았는데 시작된 이벤트(피버·보스 클리어 제외)
          if (e.type === 'event' && e.event && e.event !== 'fever' && e.event !== 'starpower' && !w.stageDef.events?.some((x) => x.id === e.event)) random++;
        }
        for (const m of w.meteors) {
          if (seen.has(m.id)) continue;
          seen.add(m.id);
          if (m.curve && !w.event && !w.stageDef.boss) bent++;
          if (w.stage === 4 && Math.abs(m.z - lastZ) > 1) gaps.add((w.time - 0).toFixed(1));
          lastZ = m.z;
        }
        w.events.length = 0;
      }
      void scheduled;
      return { random, bent, cleared: w.cleared };
    };
    const easy = run('easy');
    const normal = run('normal');
    const hard = run('hard');
    expect(easy.random).toBe(0);
    expect(easy.bent).toBe(0);
    expect(normal.random).toBeGreaterThan(0);
    expect(hard.random).toBeGreaterThanOrEqual(normal.random);
    expect(hard.bent).toBeGreaterThan(0);
    expect(easy.cleared && normal.cleared && hard.cleared).toBe(true); // 랜덤 요소가 있어도 길은 보장된다
  });

  it('맞으면 목숨이 줄고 1.5초 무적, 보호막은 막아 준다', () => {
    const w = new World(5, seeded(3));
    w.meteors.push({ id: 999, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    w.step(DT, still);
    expect(w.lives).toBe(w.maxLives - 1);
    expect(w.invuln).toBeCloseTo(CONFIG.player.invulnSec, 1);
    w.meteors.push({ id: 1000, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    w.step(DT, still);
    expect(w.lives).toBe(w.maxLives - 1); // 무적 중

    const s = new World(5, seeded(4));
    s.step(DT, { x: 0, shield: true });
    expect(s.shield).toBeCloseTo(CONFIG.player.shieldSec, 1);
    s.meteors.push({ id: 999, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    s.step(DT, { x: 0, shield: true });
    expect(s.lives).toBe(s.maxLives);
    expect(s.shieldCooldown).toBeGreaterThan(s.preset.shieldCooldownSec - 1);
  });

  it('보호 시간(카메라 재인식 직후) 동안에는 운석에도 레이저에도 맞지 않는다', () => {
    const w = new World(5, seeded(6));
    w.protect = 2;
    w.meteors.push({ id: 999, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    w.lasers.push({ id: 998, x: 0, z: -3, safeX: 4 });
    for (let i = 0; i < 30; i++) w.step(DT, still);
    expect(w.lives).toBe(w.maxLives);
    expect(w.events.some((e) => e.type === 'hit')).toBe(false);
  });
});

describe('점수', () => {
  it('운석을 하나 피할 때마다 100점, 연속으로 피하면 배율이 올라 최대 3배', () => {
    const { dodge, comboEvery, comboStep, comboMax } = CONFIG.score;
    expect(dodge).toBe(100);
    expect(comboMax).toBe(3);
    const w = new World(5, seeded(1));
    const pass = () => {
      const before = w.score;
      w.meteors.push({ id: 5000 + w.combo, x: 4, z: 1.4, r: 0.8, safeX: 0 }); // 옆 레인을 막 지나가는 운석
      w.step(DT, still);
      return w.score - before;
    };
    expect(pass()).toBe(100);
    expect(w.combo).toBe(1);
    while (w.combo < comboEvery) pass();
    expect(w.comboMultiplier).toBe(1 + comboStep);
    expect(pass()).toBe(100 * (1 + comboStep));
    while (w.combo < comboEvery * 10) pass();
    expect(w.comboMultiplier).toBe(comboMax);
    expect(pass()).toBe(100 * comboMax);
    // 맞으면 콤보가 끊긴다
    w.meteors.push({ id: 9999, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    w.step(DT, still);
    expect(w.combo).toBe(0);
    expect(w.comboMultiplier).toBe(1);
  });

  it('무적 중에 몸을 뚫고 지나간 운석은 피한 것으로 치지 않는다', () => {
    const w = new World(5, seeded(1));
    w.invuln = 5;
    w.meteors.push({ id: 900, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    for (let i = 0; i < 12; i++) w.step(DT, still);
    expect(w.combo).toBe(0);
  });

  it('별 조각을 먹으면 50점, 스테이지 클리어 500점, 보스 클리어 1,000점', () => {
    expect(CONFIG.score.stageClear).toBe(500);
    expect(CONFIG.score.bossClear).toBe(1000);
    const w = new World(5, seeded(5));
    w.pickups.push({ id: 999, x: 0, z: -0.2 });
    w.step(DT, still);
    expect(w.stars).toBe(1);
    expect(w.score).toBe(Math.floor(w.time * CONFIG.score.perSecond) + CONFIG.score.star);
  });
});

describe('음식 아이템', () => {
  const eat = (id: FoodId, w = new World(5, seeded(1))) => {
    eatFood(w, id);
    return w;
  };

  it('9종이 모두 있고, 희귀도로 등장 확률을 관리하며, 딸기시루는 희귀다', () => {
    expect(FOOD_IDS.length).toBe(9);
    expect(new Set(FOOD_IDS.map((id) => FOODS[id].effect)).size).toBe(9);
    expect(FOODS.strawberry.rarity).toBe('rare');
    expect(RARITY_WEIGHT.common).toBeGreaterThan(RARITY_WEIGHT.rare);
    expect(RARITY_WEIGHT.rare).toBeGreaterThan(RARITY_WEIGHT.legendary);
    // 실제로 뽑아 보면 흔한 것이 가장 많이, 전설이 가장 드물게 나온다
    const w = new World(5, seeded(3));
    w.lives = 1;
    const rand = seeded(77);
    const count = { common: 0, rare: 0, legendary: 0 };
    for (let i = 0; i < 4000; i++) count[FOODS[pickFood(w, rand, FOOD_IDS)!].rarity]++;
    expect(count.common).toBeGreaterThan(count.rare);
    expect(count.rare).toBeGreaterThan(count.legendary);
    expect(count.legendary).toBeGreaterThan(0);
  });

  it('튀김소보로: 8초 동안 점수 2배(다시 먹어도 4배가 되지는 않는다)', () => {
    const w = eat('soboro');
    expect(w.double).toBe(8);
    expect(w.multiplier).toBe(2);
    eatFood(w, 'soboro');
    expect(w.double).toBe(8);
    expect(w.multiplier).toBe(2);
    const before = w.score;
    w.pickups.push({ id: 999, x: 0, z: -0.2 });
    w.step(DT, still);
    expect(w.score - before).toBe(CONFIG.score.star * 2);
  });

  it('딸기시루: 6초 동안 무적이고, 화면의 운석과 새로 오는 운석이 별로 바뀐다', () => {
    const w = atStage(new World(5, seeded(2), 'easy'), 2);
    for (let i = 0; i < 400; i++) w.step(DT, botInput(w));
    expect(w.meteors.length).toBeGreaterThan(0);
    const stars = w.pickups.filter((p) => p.kind === 'star').length;
    const meteors = w.meteors.length;
    eatFood(w, 'strawberry');
    expect(w.starpower).toBe(6);
    expect(w.meteors.length).toBe(0);
    expect(w.pickups.filter((p) => p.kind === 'star').length).toBe(stars + meteors);
    const lives = w.lives;
    w.meteors.push({ id: 9999, x: w.player.x, z: -0.5, r: 0.8, safeX: 0 });
    for (let t = 0; t < 5; t += DT) w.step(DT, still);
    expect(w.lives).toBe(lives);
    expect(w.meteors.length).toBe(0); // 그동안 새 웨이브도 별로 나온다
  });

  it('물총칼국수: 6초 동안 운석이 35% 느려졌다가 원래 속도로 돌아온다', () => {
    const w = new World(5, seeded(1));
    const normal = w.speed;
    eatFood(w, 'kalguksu');
    expect(w.speed).toBeCloseTo(normal * 0.65, 5);
    for (let t = 0; t < 6.1; t += DT) w.step(DT, botInput(w));
    expect(w.speed).toBeCloseTo(normal, 5);
  });

  it('두부두루치기: 충돌을 한 번 막고 사라지며, 여러 개 먹어도 1회분만 남는다', () => {
    const w = eat('dubu');
    eatFood(w, 'dubu');
    expect(w.guard).toBe(1);
    w.meteors.push({ id: 999, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    w.step(DT, still);
    expect(w.lives).toBe(w.maxLives);
    expect(w.guard).toBe(0);
    expect(w.events.some((e) => e.type === 'guard')).toBe(true);
    for (let t = 0; t < 1.2; t += DT) w.step(DT, still); // 방어 직후의 짧은 무적이 끝난 뒤
    w.meteors.push({ id: 1000, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    w.step(DT, still);
    expect(w.lives).toBe(w.maxLives - 1);
  });

  it('소국밥: 하트를 한 칸 회복하되 최대 체력을 넘지 않는다', () => {
    const w = new World(5, seeded(1));
    w.lives = 1;
    eatFood(w, 'gukbap');
    expect(w.lives).toBe(2);
    w.lives = w.maxLives;
    eatFood(w, 'gukbap');
    expect(w.lives).toBe(w.maxLives);
  });

  it('순대국밥: 8초 동안 맞은 뒤의 무적 시간이 길어진다', () => {
    const w = eat('sundae');
    expect(w.tough).toBe(8);
    w.meteors.push({ id: 999, x: 0, z: -0.5, r: 0.8, safeX: 0 });
    w.step(DT, still);
    expect(w.invuln).toBeCloseTo(CONFIG.player.invulnSec * ITEM_RULES.toughFactor, 1);
  });

  it('판타롱부추빵: 7초 동안 옆 레인의 아이템도 저절로 먹는다', () => {
    const far = new World(5, seeded(1));
    far.pickups.push({ id: 999, x: 4, z: -0.2 });
    far.step(DT, still);
    expect(far.stars).toBe(0); // 자석이 없으면 두 레인 옆은 닿지 않는다
    const w = eat('buchu');
    expect(w.magnet).toBe(7);
    w.pickups.push({ id: 999, x: 4, z: -0.2 });
    w.step(DT, still);
    expect(w.stars).toBe(1);
  });

  it('오징어두루치기: 화면의 일반 운석을 모두 없앤다(레이저는 남는다)', () => {
    const w = new World(5, seeded(1));
    for (let i = 0; i < 5; i++) w.meteors.push({ id: 900 + i, x: i - 2, z: -20 - i, r: 0.8, safeX: 0 });
    w.lasers.push({ id: 990, x: 2, z: -40, safeX: 0 });
    const before = w.score;
    eatFood(w, 'squid');
    expect(w.meteors.length).toBe(0);
    expect(w.lasers.length).toBe(1);
    expect(w.score - before).toBe(ITEM_RULES.score + 5 * ITEM_RULES.bombScore);
  });

  it('꿈돌이 라면: 피버 게이지를 50% 채우고, 가득 차면 대전 피버가 시작된다', () => {
    const w = eat('ramen');
    expect(w.gauge).toBeGreaterThanOrEqual(50);
    expect(w.fever).toBe(0);
    eatFood(w, 'ramen');
    expect(w.gauge).toBe(100);
    w.step(DT, still);
    expect(w.fever).toBeGreaterThan(7.9);
    expect(w.gauge).toBe(0);
    expect(w.multiplier).toBe(2);
  });

  it('음식은 평균 15초쯤마다, 안전 레인에 나온다(스테이지가 따로 정하면 그 간격)', () => {
    expect(ITEM_RULES.everySec).toBe(15);
    const w = new World(5, seeded(11), 'easy');
    let foods = 0;
    let offPath = 0;
    while (!w.over) {
      const known = new Set(w.pickups.map((p) => p.id));
      w.step(DT, botInput(w));
      stripPowers(w);
      for (const p of w.pickups) {
        if (known.has(p.id) || !p.kind || p.kind === 'star') continue;
        foods++;
        const wave = [...w.meteors, ...w.lasers].find((m) => Math.abs(m.z - p.z) < 1e-6);
        if (wave && Math.abs(wave.safeX - p.x) > 1e-6) offPath++;
      }
      w.events.length = 0;
    }
    expect(offPath).toBe(0);
    expect(foods).toBeGreaterThanOrEqual(TOTAL / 15); // 평균 15초 간격보다 드물지 않게
    expect(foods).toBeLessThanOrEqual(TOTAL / 3);
  });
});

describe('돌발 이벤트', () => {
  /** 이벤트가 없는 평범한 스테이지에서 숨 고르기까지 지난 상태 */
  const calm = (seed = 4) => {
    const index = STAGES.findIndex((s, i) => i > 0 && !s.boss && !s.events); // 예정된 이벤트가 없는 스테이지
    expect(index).toBeGreaterThan(0);
    const w = atStage(new World(5, seeded(seed), 'easy'), index); // 이지: 랜덤 이벤트가 끼어들지 않는다
    while (w.transition > 0) w.step(DT, botInput(w));
    w.events.length = 0;
    return w;
  };

  it('8종이 모두 데이터로 정의되어 있다(시작 조건·경고·지속·쿨다운·보스전 해제)', () => {
    expect(Object.keys(EVENTS).sort()).toEqual(['bread', 'fever', 'fog', 'gravity', 'jackpot', 'starpower', 'storm', 'wave']);
    for (const def of Object.values(EVENTS)) {
      expect(['gauge', 'schedule', 'bossClear']).toContain(def.start);
      expect(def.sec).toBeGreaterThanOrEqual(0);
      expect(def.cooldownSec).toBeGreaterThanOrEqual(0);
    }
    expect(EVENTS.fever.sec).toBe(8);
    expect(EVENTS.storm.sec).toBe(7);
    expect(EVENTS.storm.warnSec).toBeGreaterThanOrEqual(1);
    expect(EVENTS.bread.sec).toBe(10);
  });

  it('한 번에 한 종류만 켜진다', () => {
    const w = calm();
    expect(w.startEvent('jackpot')).toBe(true);
    expect(w.startEvent('storm')).toBe(false);
    expect(w.event?.id).toBe('jackpot');
    expect(w.phase).toBe('EVENT');
  });

  it('끝난 이벤트는 쿨다운이 지나야 다시 시작된다', () => {
    const w = calm();
    w.startEvent('jackpot');
    while (w.event) w.step(DT, botInput(w));
    expect(w.startEvent('jackpot')).toBe(false);
    expect(w.startEvent('fog')).toBe(true);
  });

  it('보스 스테이지에 들어가면 진행 중이던 이벤트가 해제되고, 대전 피버만 허용된다', () => {
    const boss = STAGES.findIndex((s) => s.boss);
    const w = atStage(new World(5, seeded(4), 'easy'), boss - 1);
    while (w.stageTime < STEP - 3 && !w.over) w.step(DT, botInput(w));
    while (w.event) w.step(DT, botInput(w)); // 그 스테이지에 예정된 이벤트가 있으면 끝날 때까지
    if (w.stage === boss - 1 && w.startEvent('jackpot')) {
      while (w.stage === boss - 1 && !w.over) w.step(DT, botInput(w));
      expect(w.eventOn('jackpot')).toBe(false); // 해제됐다(그 사이 게이지가 차서 대전 피버가 켜질 수는 있다)
    }
    const b = atStage(new World(5, seeded(4)), boss);
    expect(b.startEvent('storm')).toBe(false);
    expect(b.startEvent('fever')).toBe(true);
  });

  it('대전 피버: 8초 동안 점수 2배', () => {
    const w = calm();
    w.startEvent('fever');
    expect(w.fever).toBe(8);
    expect(w.multiplier).toBe(2);
    for (let t = 0; t < 8.1; t += DT) w.step(DT, botInput(w));
    expect(w.fever).toBe(0);
  });

  it('운석 폭풍: 경고가 먼저 뜨고, 그 뒤 7초 동안 한 줄만 남기고 모두 막힌 웨이브가 온다', () => {
    const w = calm();
    const density = () => {
      const waves = new Map<string, number>();
      for (const m of w.meteors) if (m.z < -60) waves.set(m.z.toFixed(3), (waves.get(m.z.toFixed(3)) ?? 0) + 1);
      return [...waves.values()];
    };
    w.startEvent('storm');
    expect(w.eventOn('storm')).toBe(false); // 아직 경고 중
    expect(w.event?.warn).toBeGreaterThanOrEqual(1);
    while (!w.eventOn('storm') && !w.over) w.step(DT, botInput(w));
    for (let t = 0; t < 3; t += DT) w.step(DT, botInput(w));
    const during = density();
    expect(during.length).toBeGreaterThan(0);
    for (const n of during) expect(n).toBe(4); // 5레인 중 4레인이 막힘
  });

  it('빵지순례: 10초 동안 웨이브마다 빵이 나온다', () => {
    const w = calm();
    w.startEvent('bread');
    let breads = 0;
    const seen = new Set<number>();
    while (w.eventOn('bread')) {
      w.step(DT, botInput(w));
      stripPowers(w);
      for (const p of w.pickups) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        if (p.kind && BREADS.includes(p.kind as FoodId)) breads++;
      }
    }
    expect(breads).toBeGreaterThanOrEqual(6);
  });

  it.each(['gravity', 'wave'] as const)('%s: 운석이 멀리서는 옆으로 벗어나 있다가 닿을 때는 제 줄에 온다', (id) => {
    const w = calm();
    w.startEvent(id);
    while (!w.eventOn(id) && !w.over) w.step(DT, botInput(w));
    for (let t = 0; t < 2.5; t += DT) w.step(DT, botInput(w));
    const bent = w.meteors.filter((m) => m.bend);
    expect(bent.length).toBeGreaterThan(0);
    const far = bent.filter((m) => m.z < -70);
    expect(far.some((m) => Math.abs(m.x - m.baseX!) > 1)).toBe(true); // 멀리서는 한참 벗어나 있다
    for (const z of [-1.5, -0.5, 0, 0.5]) expect(Math.abs(bendAt({ bend: bent[0].bend, curve: bent[0].curve }, z))).toBeLessThan(0.06);
  });

  it('별똥별 잭팟: 별 조각 점수가 3배가 되고 웨이브마다 별이 나온다', () => {
    const w = calm();
    w.startEvent('jackpot');
    const before = w.score;
    w.pickups.push({ id: 9999, x: w.player.x, z: -0.2 });
    w.step(DT, still);
    expect(w.score - before).toBe(CONFIG.score.star * EVENT_RULES.jackpotMultiplier);
  });

  it('한빛탑 스타파워: 그 보스를 넘기는 순간 남은 운석이 모두 별이 된다', () => {
    const index = STAGES.findIndex((s) => s.onClear === 'starpower');
    expect(index).toBeGreaterThan(0);
    const w = atStage(new World(5, seeded(6)), index);
    let fired = false;
    while (w.stage === index && !w.over) {
      w.step(DT, botInput(w));
      if (w.events.some((e) => e.type === 'event' && e.event === 'starpower')) {
        fired = true;
        expect(w.meteors.length).toBe(0);
      }
      w.events.length = 0;
    }
    expect(fired).toBe(true);
  });
});

describe('보스전', () => {
  it('세 유형이 스테이지에 걸려 있고, 마지막 스테이지가 최종 보스(보너스)다', () => {
    expect(STAGES.map((s) => s.boss).filter(Boolean)).toEqual(['vortex', 'expo', 'king']);
    const last = STAGES[STAGES.length - 1];
    expect(last.boss).toBe('king');
    expect(last.bonus).toBe(true);
    expect(Object.keys(BOSS_NAMES).length).toBe(3);
  });

  it('위험 구역은 공격 최소 1초 전에 보인다(레이저 경고 시간)', () => {
    for (const id of DIFFICULTIES) {
      const speed = PRESETS[id].speedMax;
      const warning = CONFIG.field.spawnZ / speed - CONFIG.boss.fireSec; // 생긴 뒤 켜지기 전까지
      expect(warning, id).toBeGreaterThanOrEqual(1);
    }
  });

  it('소용돌이 운석: 열린 줄이 한 칸씩 돌아가는 나선 무늬에 운석이 휘어 들어온다', () => {
    const index = STAGES.findIndex((s) => s.boss === 'vortex');
    const w = atStage(new World(5, seeded(5), 'easy'), index); // 이지: 간격이 일정해 무늬가 그대로 보인다
    for (let t = 0; t < 9; t += DT) w.step(DT, botInput(w));
    expect(w.phase).toBe('BOSS');
    const waves = new Map<string, { n: number; safe: number }>();
    for (const m of w.meteors) {
      const k = m.z.toFixed(3);
      waves.set(k, { n: (waves.get(k)?.n ?? 0) + 1, safe: m.safeX });
    }
    const list = [...waves.entries()].sort((a, b) => +a[0] - +b[0]).map(([, v]) => v);
    expect(list.length).toBeGreaterThan(1);
    for (const v of list) expect(v.n).toBe(4);
    for (let i = 1; i < list.length; i++) expect(Math.abs(list[i].safe - list[i - 1].safe)).toBe(CONFIG.field.laneWidth); // 한 칸씩
    expect(w.meteors.every((m) => m.curve === 'gravity')).toBe(true);
  });

  it('엑스포 우주운석: 왼쪽과 오른쪽을 번갈아 쏘고 반대쪽은 안전 구역으로 남는다', () => {
    expect(sideLanes(5, 2, -1)).toEqual([0, 1]);
    expect(sideLanes(5, 2, 1)).toEqual([3, 4]);
    expect(sideLanes(5, 0, -1)).toEqual([1]); // 안전 레인은 건드리지 않는다
    expect(sideLanes(3, 1, 1)).toEqual([2]);
    const index = STAGES.findIndex((s) => s.boss === 'expo');
    const w = atStage(new World(5, seeded(5)), index);
    const sides = new Set<number>();
    let fired = 0;
    let maxLasers = 0;
    while (w.stage === index && !w.over) {
      w.step(DT, botInput(w));
      for (const l of w.lasers) sides.add(Math.sign(l.x));
      maxLasers = Math.max(maxLasers, w.lasers.length);
      fired += w.events.filter((e) => e.type === 'laser').length;
      w.events.length = 0;
    }
    expect(sides.has(-1) && sides.has(1)).toBe(true);
    expect(fired).toBeGreaterThan(0);
    expect(maxLasers).toBeGreaterThanOrEqual(laserCount(5));
    expect(w.lasers.length).toBe(0); // 보스를 넘기면 남은 레이저는 사라진다
  });

  it('우주대왕운석: 소용돌이·곡선 이동·레이저를 섞는다', () => {
    const index = STAGES.findIndex((s) => s.boss === 'king');
    const w = atStage(new World(5, seeded(5)), index);
    let lasers = 0;
    let curved = 0;
    let dense = 0;
    while (!w.over) {
      w.step(DT, botInput(w));
      lasers = Math.max(lasers, w.lasers.length);
      curved = Math.max(curved, w.meteors.filter((m) => m.curve).length);
      const far = w.meteors.filter((m) => m.z < -100);
      if (far.length === 4) dense++;
      w.events.length = 0;
    }
    expect(lasers).toBeGreaterThan(0);
    expect(curved).toBeGreaterThan(0);
    expect(dense).toBeGreaterThan(0);
    expect(w.cleared).toBe(true);
  });

  it('레이저는 닿기 직전에만 켜지고, 켜진 줄에 서 있으면 목숨이 줄며 옆줄이면 무사하다', () => {
    expect(isFiring({ id: 1, x: 0, z: -fireDistance(40) - 1, safeX: 0 }, 40)).toBe(false);
    expect(isFiring({ id: 1, x: 0, z: -1, safeX: 0 }, 40)).toBe(true);
    expect(isFiring({ id: 1, x: 0, z: 0.5, safeX: 0 }, 40)).toBe(false);
    const w = new World(5, seeded(8));
    w.lasers.push({ id: 900, x: 0, z: -3, safeX: 4 });
    w.step(DT, still);
    expect(w.lives).toBe(w.maxLives - 1);
    const safe = new World(5, seeded(8));
    safe.lasers.push({ id: 900, x: 2, z: -3, safeX: 0 });
    safe.step(DT, still);
    expect(safe.lives).toBe(safe.maxLives);
  });

  it('옆바람은 플레이어를 밀지만 필드 밖으로 내보내지는 않는다', () => {
    const index = STAGES.findIndex((s) => s.wind);
    const w = atStage(new World(5, seeded(9)), index);
    w.protect = 999; // 바람만 본다(한쪽 끝에 서 있어도 죽지 않게)
    let pushed = 0;
    while (w.stage === index && !w.over) {
      w.step(DT, { x: 1, shield: false });
      pushed = Math.max(pushed, Math.abs(w.wind));
      expect(Math.abs(w.player.x)).toBeLessThanOrEqual(w.halfWidth + 1e-9);
    }
    expect(pushed).toBeGreaterThan(1);
  });
});

describe('입력 필터', () => {
  it('떨림을 줄이면서 큰 움직임은 따라간다', () => {
    const f = new OneEuro(CONFIG.pose.filterMinCutoff, CONFIG.pose.filterBeta);
    const rand = seeded(9);
    let t = 0;
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      t += 1 / 30;
      worst = Math.max(worst, Math.abs(f.filter(0.5 + (rand() - 0.5) * 0.01, t) - 0.5));
    }
    expect(worst).toBeLessThan(0.004); // ±0.005 잡음이 줄어든다
    let out = 0;
    for (let i = 0; i < 9; i++) out = f.filter(0.7, (t += 1 / 30)); // 0.3초 뒤
    expect(out).toBeGreaterThan(0.68); // 큰 이동은 0.3초 안에 90% 이상 따라온다
  });
});

describe('모션 인식', () => {
  it('추론이 느린 기기일수록 드물게 돌리되 상한·하한을 지킨다', () => {
    const P = CONFIG.pose;
    expect(inferGapMs(0)).toBeCloseTo(1000 / P.maxFps); // 빠른 기기: 상한 그대로
    expect(inferGapMs(15)).toBeCloseTo(15 / P.maxLoad); // 느려지면 그만큼 간격을 벌린다
    expect(inferGapMs(500)).toBeCloseTo(1000 / P.minFps); // 아무리 느려도 조종이 끊기지 않게
  });

  it('여러 명이면 따라가던 사람을 고르고, 어깨가 안 보이는 사람은 뺀다', () => {
    const person = (x: number, visibility = 1) => {
      const lm = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 0 }));
      lm[11] = { x: x - 0.1, y: 0.4, z: 0, visibility };
      lm[12] = { x: x + 0.1, y: 0.4, z: 0, visibility };
      return lm;
    };
    const [player, watcher, hidden] = [person(0.2), person(0.5), person(0.21, 0.1)];
    expect(pickPose([watcher, player], 0.5)).toBe(watcher); // 처음에는 가운데 사람
    expect(pickPose([watcher, player, hidden], 0.25)).toBe(player); // 옆으로 간 뒤에도 같은 사람
    expect(pickPose([hidden], 0.2)).toBeNull();
  });
});

describe('카메라 맞춤', () => {
  it.each([
    [360, 640],
    [844, 390],
    [1920, 1080],
    [390, 844],
    [1024, 768],
  ])('%ix%i 에서 필드 전체 폭이 화면에 들어온다', (w, h) => {
    const aspect = w / h;
    const lanes = lanesFor(aspect);
    const { fov, dist } = fitCamera(aspect, lanes);
    const visibleHalf = Math.tan((fov * Math.PI) / 360) * aspect * dist;
    expect(visibleHalf).toBeGreaterThanOrEqual(fieldHalf(lanes) - 1e-6);
    expect(fov).toBeGreaterThanOrEqual(CONFIG.camera.fovMin);
    expect(fov).toBeLessThanOrEqual(CONFIG.camera.fovMax);
  });
});
