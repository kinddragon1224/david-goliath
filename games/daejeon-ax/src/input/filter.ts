/** One Euro Filter (Casiez 2012): 느릴 때는 떨림을 강하게, 빠를 때는 지연을 줄인다. */
export class OneEuro {
  private x?: number;
  private dx = 0;
  private t = 0;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff = 1,
  ) {}

  /** @param t 초 단위 시각 */
  filter(value: number, t: number): number {
    if (this.x === undefined) {
      this.x = value;
      this.t = t;
      return value;
    }
    const dt = Math.max(1e-3, t - this.t);
    this.t = t;
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.dx += alpha(this.dCutoff) * ((value - this.x) / dt - this.dx);
    this.x += alpha(this.minCutoff + this.beta * Math.abs(this.dx)) * (value - this.x);
    return this.x;
  }

  reset(): void {
    this.x = undefined;
    this.dx = 0;
  }
}
