/** 옷본 모양. 단위 상자(0~1) 안의 닫힌 선. 다리미·가위질이 같이 쓴다. */

export type Pt = [number, number];

export type Garment = {
  name: string;
  /** 너비/높이 비율. */
  aspect: number;
  color: string;
  shade: string;
  pts: Pt[];
};

/** 타원 호 위의 점들. a0→a1(라디안), n개. */
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  a0: number,
  a1: number,
  n: number,
): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}

/** 물결 밑단. */
function wave(x0: number, x1: number, y: number, amp: number, waves: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    out.push([x0 + (x1 - x0) * k, y + Math.sin(k * Math.PI * 2 * waves) * amp]);
  }
  return out;
}

export const SHIRT: Garment = {
  name: "티셔츠",
  aspect: 1.05,
  color: "#f7f3ff",
  shade: "#b9acd9",
  pts: [
    [0.34, 0.04],
    ...arc(0.5, 0.04, 0.16, 0.1, Math.PI, 0, 10).slice(1, -1),
    [0.66, 0.04],
    [0.84, 0.1],
    [1.0, 0.32],
    [0.86, 0.44],
    [0.78, 0.36],
    [0.78, 0.97],
    [0.22, 0.97],
    [0.22, 0.36],
    [0.14, 0.44],
    [0.0, 0.32],
    [0.16, 0.1],
  ],
};

export const DRESS: Garment = {
  name: "원피스",
  aspect: 0.82,
  color: "#ffd9ea",
  shade: "#d690b4",
  pts: [
    [0.34, 0.03],
    ...arc(0.5, 0.03, 0.16, 0.12, Math.PI, 0, 10).slice(1, -1),
    [0.66, 0.03],
    [0.76, 0.06],
    [0.74, 0.3],
    [0.66, 0.42],
    ...wave(1.0, 0.0, 0.96, 0.025, 4, 24),
    [0.34, 0.42],
    [0.26, 0.3],
    [0.24, 0.06],
  ],
};

export const PANTS: Garment = {
  name: "바지",
  aspect: 0.8,
  color: "#d6e6ff",
  shade: "#7f9cc9",
  pts: [
    [0.14, 0.03],
    [0.86, 0.03],
    [0.97, 0.97],
    [0.6, 0.97],
    [0.5, 0.38],
    [0.4, 0.97],
    [0.03, 0.97],
  ],
};

export const SKIRT: Garment = {
  name: "치마",
  aspect: 1.1,
  color: "#cdf3e8",
  shade: "#6fb8a4",
  pts: [[0.3, 0.08], [0.7, 0.08], ...wave(0.98, 0.02, 0.9, 0.03, 3, 18)],
};

export const JACKET: Garment = {
  name: "재킷",
  aspect: 1.05,
  color: "#fff0d2",
  shade: "#c9a46a",
  pts: [
    [0.36, 0.03],
    [0.5, 0.3],
    [0.64, 0.03],
    [0.84, 0.08],
    [1.0, 0.8],
    [0.88, 0.82],
    [0.78, 0.4],
    [0.8, 0.97],
    [0.2, 0.97],
    [0.22, 0.4],
    [0.12, 0.82],
    [0.0, 0.8],
    [0.16, 0.08],
  ],
};

const ALL = [SHIRT, DRESS, PANTS, SKIRT, JACKET];
const BOTTOMS = [PANTS, SKIRT];

/** 피날레에 입힐 옷: 완성한 옷 중 마지막 상의(원피스 포함) + 마지막 하의. 하나도 없으면 기본 한 벌. */
export function pickOutfit(names: string[], fallback: Garment = SHIRT): Garment[] {
  const made = names.map((n) => ALL.find((g) => g.name === n)).filter((g): g is Garment => !!g);
  const top = made.filter((g) => !BOTTOMS.includes(g)).at(-1);
  const bottom = made.filter((g) => BOTTOMS.includes(g)).at(-1);
  if (top === DRESS) return [DRESS];
  const out = [bottom, top].filter((g): g is Garment => !!g);
  return out.length ? out : [fallback];
}

/** 몸에 맞출 때 어깨(하의는 골반) 폭·몸통 길이에 곱하는 수. top은 기준선 위로 올리는 비율. */
const FIT: Record<string, { anchor: "shoulder" | "hip"; sw: number; th: number; top: number }> = {
  [SHIRT.name]: { anchor: "shoulder", sw: 1.5, th: 1.2, top: 0.08 },
  [JACKET.name]: { anchor: "shoulder", sw: 1.55, th: 1.25, top: 0.07 },
  [DRESS.name]: { anchor: "shoulder", sw: 1.9, th: 2.1, top: 0.05 },
  [PANTS.name]: { anchor: "hip", sw: 2.4, th: 1.7, top: 0.04 },
  [SKIRT.name]: { anchor: "hip", sw: 3.0, th: 0.95, top: 0.1 },
};

export type Body = { ls: Pt; rs: Pt; lh: Pt; rh: Pt };

/** 옷을 몸 위 어디에 얼마나 크게, 몇 도로 그릴지. 좌표는 몸 좌표 그대로(픽셀). */
export function fitGarment(
  g: Garment,
  b: Body,
): { cx: number; y: number; w: number; h: number; angle: number } {
  const f = FIT[g.name] ?? FIT[SHIRT.name];
  const mid = (p: Pt, q: Pt): Pt => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const sm = mid(b.ls, b.rs);
  const hm = mid(b.lh, b.rh);
  const torso = Math.max(1, Math.hypot(hm[0] - sm[0], hm[1] - sm[1]));
  const [p, q] = f.anchor === "shoulder" ? [b.ls, b.rs] : [b.lh, b.rh];
  // 골반 점은 실제 골반보다 안쪽이라 어깨 폭과 섞어 너무 좁아지지 않게
  const span =
    f.anchor === "shoulder"
      ? Math.hypot(q[0] - p[0], q[1] - p[1])
      : Math.max(
          Math.hypot(q[0] - p[0], q[1] - p[1]),
          Math.hypot(b.rs[0] - b.ls[0], b.rs[1] - b.ls[1]) * 0.55,
        );
  const base = f.anchor === "shoulder" ? sm : hm;
  const w = span * f.sw;
  const h = torso * f.th;
  return {
    cx: base[0],
    y: base[1] - h * f.top,
    w,
    h,
    angle: Math.atan2(q[1] - p[1], q[0] - p[0]),
  };
}

export type Placed = { x: number; y: number; w: number; h: number };

/** 화면 상자 안에 옷을 가운데 맞춰 놓는다. */
export function place(g: Garment, cx: number, cy: number, maxW: number, maxH: number): Placed {
  let h = maxH;
  let w = h * g.aspect;
  if (w > maxW) {
    w = maxW;
    h = w / g.aspect;
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function toWorld(g: Garment, p: Placed): Pt[] {
  return g.pts.map(([x, y]) => [p.x + x * p.w, p.y + y * p.h]);
}

export function pathOf(pts: Pt[]): Path2D {
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  return path;
}

/** 닫힌 선을 일정 간격 점들로 다시 찍는다. */
export function resample(pts: Pt[], step: number): Pt[] {
  const closed = [...pts, pts[0]];
  const out: Pt[] = [closed[0]];
  let carry = 0;
  for (let i = 1; i < closed.length; i++) {
    const [x0, y0] = closed[i - 1];
    const [x1, y1] = closed[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let d = step - carry;
    while (d <= len) {
      const k = d / len;
      out.push([x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]);
      d += step;
    }
    carry = len - (d - step);
  }
  return out;
}

/** 점이 다각형 안에 있나(짝홀 규칙). */
export function inside(pts: Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
