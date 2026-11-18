import { CONFIG } from '../config';

export type QualityLevel = (typeof CONFIG.quality.levels)[number];

/**
 * 프레임 시간을 재서 느리면 품질을 한 단계씩 내린다.
 * ponytail: 내리기만 한다(올렸다 내렸다 출렁임 방지). 새로고침하면 처음 단계로 돌아간다.
 * 다시 올리는 로직이 필요해지면 여기에 히스테리시스를 넣을 것.
 */
export class Quality {
  level = 0;
  private elapsed = 0;
  private frames = 0;

  constructor(private apply: (q: QualityLevel) => void) {
    apply(CONFIG.quality.levels[0]);
  }

  /** @param ms 직전 프레임에 걸린 시간 */
  tick(ms: number): void {
    const Q = CONFIG.quality;
    if (ms > 250) return; // 탭 전환·모델 로딩 같은 일시적 멈춤은 무시
    this.elapsed += ms;
    this.frames++;
    if (this.elapsed < Q.windowMs) return;
    const fps = (this.frames * 1000) / this.elapsed;
    this.elapsed = this.frames = 0;
    const threshold = this.level === 0 ? Q.firstStepFps : Q.minFps;
    if (fps < threshold && this.level < Q.levels.length - 1) this.apply(Q.levels[++this.level]);
  }
}
