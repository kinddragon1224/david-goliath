export type Screen = 'loading' | 'title' | 'select' | 'permission' | 'calibrate' | 'countdown' | 'play' | 'result';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** 화면별 DOM 오버레이 전환. CSS 는 body[data-screen] 으로 카메라 미리보기 위치 등을 바꾼다. */
export function showScreen(name: Screen): void {
  document.body.dataset.screen = name;
  for (const el of document.querySelectorAll<HTMLElement>('.screen')) el.hidden = el.dataset.for !== name;
}
