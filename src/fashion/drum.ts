import type { Level } from "./core";

/** 몽글 드럼 규칙(그림·소리 없이). 큰 북 하나를 두 손으로 친다: 0 왼쪽, 1 오른쪽. */
export type Lane = 0 | 1;

const PATTERN: Lane[] = [0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0];
/** 8박마다 이 박부터 반 박 연타가 낀다(다른 손이 받는다). 8이면 없음. */
const FILL_FROM = [8, 6, 4];

/** 박 번호(0부터)별 음표. 첫 네 박은 세기만 한다. */
export function chart(lastBeat: number, level: Level): { beat: number; lane: Lane }[] {
  const out: { beat: number; lane: Lane }[] = [];
  for (let i = 4; i <= lastBeat; i++) {
    const lane = PATTERN[i % PATTERN.length];
    out.push({ beat: i, lane });
    if (i % 8 >= FILL_FROM[level] && i < lastBeat)
      out.push({ beat: i + 0.5, lane: lane ? 0 : 1 });
  }
  return out;
}

type Track = { y: number; time: number; armed: boolean; lastHit: number };

/** 내려치기 찾기: 손을 줄 위로 올렸다가, 충분히 빠르게 줄을 지나 내려오면 한 번. 좌표는 0~1. */
export class StrikeDetector {
  private tracks = new Map<number, Track>();

  reset(): void {
    this.tracks.clear();
  }

  update(
    id: number,
    point: { x: number; y: number } | null,
    timeMs: number,
    line: number,
    speed: number,
  ): { lane: Lane; timeMs: number } | null {
    if (!point) {
      this.tracks.delete(id);
      return null;
    }
    const prev = this.tracks.get(id);
    if (!prev || timeMs - prev.time > 250) {
      this.tracks.set(id, {
        y: point.y,
        time: timeMs,
        armed: point.y < line - 0.04,
        lastHit: -Infinity,
      });
      return null;
    }
    const dt = (timeMs - prev.time) / 1000;
    if (dt <= 0) return null;
    const y = prev.y * 0.18 + point.y * 0.82;
    const armed = prev.armed || y < line - 0.045;
    const hit =
      armed &&
      prev.y < line &&
      y >= line &&
      (y - prev.y) / dt >= speed &&
      timeMs - prev.lastHit >= 170;
    this.tracks.set(id, {
      y,
      time: timeMs,
      armed: hit ? false : armed,
      lastHit: hit ? timeMs : prev.lastHit,
    });
    if (!hit) return null;
    // 줄을 지난 순간을 프레임 사이에서 짚는다
    const at = prev.time + ((line - prev.y) / (y - prev.y)) * (timeMs - prev.time);
    return { lane: point.x < 0.5 ? 0 : 1, timeMs: at };
  }
}
