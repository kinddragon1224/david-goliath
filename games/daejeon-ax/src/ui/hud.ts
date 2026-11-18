import { CONFIG } from '../config';
import { EVENTS } from '../game/config/events';
import type { World } from '../game/world';
import { $ } from './screens';

export const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

/** "3/9 · 엑스포다리 · 갑천" 처럼 몇 번째 여행지인지 */
export const stageLabel = (stage: number) => `${stage + 1}/${CONFIG.stages.length} · ${CONFIG.stages[stage].name}`;

/** 지금 켜져 있는 이벤트·능력과 남은 시간. 없으면 빈 문자열 */
export function powerLabel(w: World): string {
  const left = (sec: number) => ` ${Math.ceil(sec)}`;
  const parts: string[] = [];
  const event = w.event;
  if (event) parts.push(event.warn > 0 ? `곧 ${EVENTS[event.id].name}` : EVENTS[event.id].name + left(event.left));
  if (w.starpower > 0) parts.push(`무적${left(w.starpower)}`);
  if (w.double > 0) parts.push(`점수 2배${left(w.double)}`);
  if (w.slow > 0) parts.push(`슬로${left(w.slow)}`);
  if (w.magnet > 0) parts.push(`자석${left(w.magnet)}`);
  if (w.tough > 0) parts.push(`오뚝이${left(w.tough)}`);
  if (w.shield > 0) parts.push(`보호막${left(w.shield)}`);
  if (w.guard > 0) parts.push('방어 1회');
  if (w.protect > 0) parts.push('보호 중');
  return parts.slice(0, 3).join(' · ');
}

/** 연속 회피 배율. 1배일 때는 표시하지 않는다 */
export const comboLabel = (w: World) => (w.comboMultiplier > 1 ? `콤보 ×${w.comboMultiplier}` : '');
/** 목숨·점수·시간과 지금 지나는 여행지. 값이 바뀔 때만 DOM 을 건드린다. */
export class Hud {
  private cache = ['', '', '', '', '', ''];
  private els = [$('hud-lives'), $('hud-score-value'), $('hud-time'), $('hud-stage'), $('hud-power'), $('hud-combo')];
  private gauge = $('hud-gauge-fill');
  private gaugeWidth = -1;

  update(w: World): void {
    const lives = Math.max(0, w.lives);
    const next = ['♥'.repeat(lives) + '♡'.repeat(w.maxLives - lives), String(w.score), formatTime(w.time), stageLabel(w.stage), powerLabel(w), comboLabel(w)];
    next.forEach((text, i) => {
      if (text !== this.cache[i]) this.els[i].textContent = this.cache[i] = text;
    });
    // 피버 게이지: 차오르다가, 대전 피버 중에는 남은 시간만큼 줄어든다
    const fill = Math.round(w.fever > 0 ? (w.fever / EVENTS.fever.sec) * 100 : w.gauge);
    if (fill !== this.gaugeWidth) {
      this.gauge.style.width = `${(this.gaugeWidth = fill)}%`;
      this.gauge.classList.toggle('on', w.fever > 0);
    }
  }
}
