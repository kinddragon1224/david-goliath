/** 모든 입력 방식이 내놓는 공통 값 */
export interface InputState {
  /** -1(왼쪽 끝) ~ 1(오른쪽 끝) */
  x: number;
  shield: boolean;
}

export interface InputSource {
  readonly state: InputState;
  /** 마지막으로 사용자가 이 입력을 쓴 시각(performance.now) */
  activeAt: number;
  /** 드래그·키보드처럼 현재 위치에서 이어서 움직이는 입력 */
  readonly relative: boolean;
  update?(dt: number): void;
}

export const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/** 키보드·터치·기울기 중 가장 최근에 쓴 것을 따른다 */
export class ManualInput {
  readonly state: InputState = { x: 0, shield: false };
  constructor(private sources: InputSource[]) {}

  update(dt: number): void {
    let active = this.sources[0];
    for (const s of this.sources) {
      s.update?.(dt);
      if (s.activeAt > active.activeAt) active = s;
    }
    this.state.x = active.state.x;
    this.state.shield = this.sources.some((s) => s.state.shield);
    // 쉬고 있는 상대 입력은 현재 위치를 이어받아, 전환할 때 튀지 않게 한다
    for (const s of this.sources) if (s !== active && s.relative) s.state.x = active.state.x;
  }

  reset(): void {
    for (const s of this.sources) if (s.relative) s.state.x = 0;
    this.state.x = 0;
  }
}
