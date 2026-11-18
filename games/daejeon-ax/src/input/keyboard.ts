import { CONFIG } from '../config';
import { clamp1, type InputSource } from './index';

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];

export class KeyboardInput implements InputSource {
  readonly state = { x: 0, shield: false };
  readonly relative = true;
  activeAt = 0;
  private down = new Set<string>();

  constructor() {
    addEventListener('keydown', (e) => {
      this.down.add(e.code);
      if (e.code === 'Space') this.state.shield = true;
    });
    addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      if (e.code === 'Space') this.state.shield = false;
    });
    addEventListener('blur', () => {
      this.down.clear();
      this.state.shield = false;
    });
  }

  update(dt: number): void {
    const dir = Number(RIGHT.some((k) => this.down.has(k))) - Number(LEFT.some((k) => this.down.has(k)));
    if (!dir) return;
    this.state.x = clamp1(this.state.x + dir * CONFIG.keyboard.rate * dt);
    this.activeAt = performance.now();
  }
}
