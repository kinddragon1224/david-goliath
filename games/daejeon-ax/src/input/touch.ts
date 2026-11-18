import { CONFIG } from '../config';
import { clamp1, type InputSource } from './index';

/** 화면 좌우 드래그. 두 손가락을 대면 보호막. 마우스 드래그도 같은 경로. */
export class TouchInput implements InputSource {
  readonly state = { x: 0, shield: false };
  readonly relative = true;
  activeAt = 0;
  private pointers = new Set<number>();
  private id = -1;
  private startX = 0;
  private startValue = 0;

  constructor() {
    addEventListener('pointerdown', (e) => {
      this.pointers.add(e.pointerId);
      this.state.shield = this.pointers.size >= 2;
      if (this.id !== -1) return;
      this.id = e.pointerId;
      this.startX = e.clientX;
      this.startValue = this.state.x;
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.id) return;
      const dx = (e.clientX - this.startX) / (innerWidth * CONFIG.touch.dragRange);
      this.state.x = clamp1(this.startValue + dx);
    });
    const end = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.state.shield = this.pointers.size >= 2;
      if (e.pointerId === this.id) this.id = -1;
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  }

  update(): void {
    if (this.id !== -1) this.activeAt = performance.now(); // 끄는 동안은 기울기에 뺏기지 않는다
  }
}
