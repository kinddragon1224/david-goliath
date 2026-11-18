import { EVENT_IDS, EVENTS, type EventId } from '../config/events';
import type { World } from '../world';

export interface ActiveEvent {
  id: EventId;
  /** 효과가 시작되기까지 남은 경고 시간 */
  warn: number;
  /** 효과가 끝나기까지 남은 시간 */
  left: number;
}

/**
 * 운석 폭풍·소용돌이의 웨이브 무늬: 한 줄만 열어 두되 그 줄이 한 칸씩 옆으로 옮겨 간다.
 * 가장자리에 닿으면 방향을 바꾼다.
 * @returns 열어 둘 레인과 다음에 쓸 진행 방향
 */
export function stormLane(prevSafe: number, lanes: number, dir: number, canShift: boolean): { lane: number; dir: number } {
  if (!canShift || lanes < 2) return { lane: prevSafe, dir };
  let next = prevSafe + dir;
  if (next < 0 || next >= lanes) {
    dir = -dir;
    next = prevSafe + dir;
  }
  return { lane: next, dir };
}

/**
 * 돌발 이벤트 관리자. 규칙은 config/events.ts 의 데이터가 정하고, 여기서는 그 데이터대로 켜고 끈다.
 *  - 한 번에 한 종류만 켠다. 다른 이벤트가 켜져 있으면 예정된 이벤트는 차례를 기다린다.
 *  - 보스 스테이지에 들어가면 inBoss 가 아닌 이벤트는 그 자리에서 해제하고 새로 시작하지도 않는다.
 *  - 끝난 이벤트는 쿨다운이 지나야 다시 시작할 수 있다.
 */
export class EventDirector {
  active: ActiveEvent | null = null;
  private stage = -1;
  private fired = 0;
  private readyAt: Partial<Record<EventId, number>> = {};
  private randomIn = 0;

  /** 그 이벤트의 효과가 지금 켜져 있는지(경고 중에는 아직 아니다) */
  is(id: EventId): boolean {
    return this.active?.id === id && this.active.warn <= 0;
  }

  /** 이벤트를 시작한다. 조건이 맞지 않으면 false */
  start(w: World, id: EventId): boolean {
    const def = EVENTS[id];
    if (w.stageDef.boss && !def.inBoss) return false;
    if (def.sec === 0) {
      // 즉시 이벤트: 켜져 있는 다른 이벤트와 상관없이 한 번 터진다
      if (id === 'starpower') w.meteorsToStars();
      w.events.push({ type: 'event', x: w.player.x, event: id });
      return true;
    }
    if (this.active || (this.readyAt[id] ?? 0) > w.time) return false;
    this.active = { id, warn: def.warnSec, left: def.sec };
    w.events.push({ type: 'event', x: w.player.x, event: id });
    return true;
  }

  update(w: World, dt: number): void {
    if (w.stage !== this.stage) {
      this.stage = w.stage;
      this.fired = 0;
      if (this.active && w.stageDef.boss && !EVENTS[this.active.id].inBoss) this.end(w); // 해제 조건: 보스전 시작
    }
    if (this.active) {
      if (this.active.warn > 0) this.active.warn -= dt;
      else if ((this.active.left -= dt) <= 0) this.end(w); // 해제 조건: 시간이 다 됨
    }
    // 스테이지에 예정된 이벤트: 시각이 됐고 자리가 비었으면 시작한다
    const list = w.stageDef.events ?? [];
    if (this.fired < list.length && w.stageTime >= list[this.fired].at && this.start(w, list[this.fired].id)) this.fired++;
    // 피버 게이지가 가득 차면 대전 피버
    if (w.gauge >= 100 && this.start(w, 'fever')) w.gauge = 0;
    this.rollRandom(w, dt);
  }

  /**
   * 랜덤 요소: 난이도가 정한 평균 간격마다 예고 없이 이벤트 하나를 가중치대로 뽑아 시작한다.
   * 튜토리얼·보스전·숨 고르기 중이거나 다른 이벤트가 켜져 있으면 미룬다.
   */
  private rollRandom(w: World, dt: number): void {
    const every = w.preset.randomEventSec;
    if (!every || w.stageDef.tutorial || w.stageDef.boss) return;
    if (this.randomIn <= 0) this.randomIn = every * (0.6 + w.roll() * 0.8);
    if (this.active || w.transition > 0 || (this.randomIn -= dt) > 0) return;
    const pool = EVENT_IDS.filter((id) => EVENTS[id].random > 0 && (this.readyAt[id] ?? 0) <= w.time);
    let pick = w.roll() * pool.reduce((sum, id) => sum + EVENTS[id].random, 0);
    const id = pool.find((x) => (pick -= EVENTS[x].random) < 0);
    if (id && this.start(w, id)) this.randomIn = every * (0.6 + w.roll() * 0.8);
    else this.randomIn = 2; // 지금은 안 되면 조금 뒤에 다시
  }

  private end(w: World): void {
    if (!this.active) return;
    this.readyAt[this.active.id] = w.time + EVENTS[this.active.id].cooldownSec;
    this.active = null;
  }
}
