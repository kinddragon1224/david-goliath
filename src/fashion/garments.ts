/** 옷본 모양. 단위 상자(0~1) 안의 닫힌 선. 다리미·가위질이 같이 쓴다. */

export type Pt = [number, number];

export type Garment = {
  name: string;
  /** 위브온 중촌 청년 디자이너 브랜드(룩북 기준). */
  brand?: string;
  /** 룩북 실제 사진(public/brand/<photo>.webp). */
  photo?: string;
  /** 피날레에 입힐 때: 상의·하의는 한 벌로 겹쳐 입고, whole(원피스류)은 혼자. */
  kind?: "top" | "bottom" | "whole";
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
  kind: "whole",
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

/* ── 위브온 중촌 창작자×예술인 콜라보 6팀의 시그니처 옷.
   photo는 배경을 지운 제품 사진(public/brand), pts는 그 사진에서 딴 바깥 윤곽이라 사진과 딱 겹친다. ── */

export const TAILORED: Garment = {
  name: "베이지 수트",
  brand: "042테일러링",
  photo: "tailored",
  kind: "whole",
  aspect: 0.392,
  color: "#d8c8b7",
  shade: "#857c71",
  pts: [
    [0.524, 0.0],
    [0.482, 0.0],
    [0.45, 0.015],
    [0.446, 0.038],
    [0.313, 0.046],
    [0.235, 0.076],
    [0.179, 0.078],
    [0.107, 0.099],
    [0.059, 0.191],
    [0.01, 0.484],
    [0.02, 0.49],
    [0.143, 0.49],
    [0.147, 0.53],
    [0.176, 0.536],
    [0.182, 0.915],
    [0.176, 0.934],
    [0.052, 0.934],
    [0.046, 0.959],
    [0.003, 0.961],
    [0.0, 0.967],
    [0.085, 0.972],
    [0.153, 0.989],
    [0.264, 1.0],
    [0.404, 0.991],
    [0.55, 0.991],
    [0.7, 1.0],
    [0.785, 0.986],
    [0.782, 0.922],
    [0.769, 0.913],
    [0.772, 0.557],
    [0.808, 0.517],
    [0.808, 0.493],
    [0.935, 0.489],
    [0.935, 0.442],
    [1.0, 0.417],
    [1.0, 0.387],
    [0.922, 0.352],
    [0.909, 0.186],
    [0.883, 0.173],
    [0.879, 0.108],
    [0.772, 0.076],
    [0.71, 0.076],
    [0.681, 0.065],
    [0.625, 0.065],
    [0.603, 0.047],
    [0.56, 0.039],
    [0.528, 0.02],
  ],
};

export const SILUA: Garment = {
  name: "라벤더 미디 드레스",
  brand: "실루아",
  photo: "silua",
  kind: "whole",
  aspect: 0.5,
  color: "#dbcbef",
  shade: "#877d94",
  pts: [
    [0.465, 0.0],
    [0.439, 0.006],
    [0.426, 0.049],
    [0.4, 0.064],
    [0.361, 0.066],
    [0.236, 0.093],
    [0.195, 0.153],
    [0.122, 0.44],
    [0.179, 0.444],
    [0.179, 0.495],
    [0.003, 0.922],
    [0.0, 0.949],
    [0.099, 0.977],
    [0.247, 0.987],
    [0.317, 1.0],
    [0.717, 0.999],
    [0.743, 0.994],
    [0.745, 0.975],
    [0.857, 0.975],
    [0.948, 0.962],
    [1.0, 0.947],
    [0.984, 0.881],
    [0.966, 0.861],
    [0.958, 0.82],
    [0.821, 0.495],
    [0.821, 0.442],
    [0.875, 0.436],
    [0.852, 0.301],
    [0.816, 0.174],
    [0.771, 0.095],
    [0.61, 0.061],
    [0.584, 0.042],
    [0.574, 0.005],
  ],
};

export const RESTITCH: Garment = {
  name: "오프숄더 화이트 셋업",
  brand: "리스티치",
  photo: "restitch",
  kind: "whole",
  aspect: 0.398,
  color: "#ebe9e8",
  shade: "#91908f",
  pts: [
    [0.256, 0.0],
    [0.249, 0.048],
    [0.095, 0.049],
    [0.085, 0.099],
    [0.233, 0.114],
    [0.265, 0.181],
    [0.268, 0.275],
    [0.23, 0.299],
    [0.199, 0.337],
    [0.155, 0.427],
    [0.0, 0.949],
    [0.06, 0.955],
    [0.069, 0.976],
    [0.186, 0.979],
    [0.192, 0.99],
    [0.23, 0.994],
    [0.612, 1.0],
    [0.65, 0.992],
    [0.789, 0.991],
    [0.804, 0.976],
    [0.927, 0.975],
    [0.94, 0.956],
    [1.0, 0.949],
    [0.836, 0.412],
    [0.789, 0.324],
    [0.729, 0.275],
    [0.729, 0.196],
    [0.77, 0.113],
    [0.918, 0.1],
    [0.909, 0.053],
    [0.751, 0.05],
    [0.744, 0.0],
    [0.722, 0.004],
    [0.697, 0.05],
    [0.315, 0.049],
    [0.3, 0.045],
    [0.274, 0.0],
  ],
};

export const ECO: Garment = {
  name: "블랙 세일러 셋업",
  brand: "에코아카이브",
  photo: "eco",
  kind: "whole",
  aspect: 0.863,
  color: "#222023",
  shade: "#151315",
  pts: [
    [0.412, 0.0],
    [0.373, 0.048],
    [0.339, 0.054],
    [0.333, 0.068],
    [0.251, 0.098],
    [0.211, 0.099],
    [0.211, 0.131],
    [0.028, 0.795],
    [0.0, 0.824],
    [0.0, 0.833],
    [0.044, 0.855],
    [0.129, 0.88],
    [0.19, 0.889],
    [0.192, 0.941],
    [0.293, 0.979],
    [0.431, 1.0],
    [0.611, 0.998],
    [0.688, 0.985],
    [0.803, 0.949],
    [0.81, 0.892],
    [0.965, 0.852],
    [0.99, 0.84],
    [1.0, 0.825],
    [0.969, 0.798],
    [0.806, 0.184],
    [0.787, 0.134],
    [0.787, 0.104],
    [0.743, 0.102],
    [0.738, 0.093],
    [0.667, 0.069],
    [0.663, 0.059],
    [0.627, 0.047],
    [0.59, 0.0],
  ],
};

export const SEOLBAEK: Garment = {
  name: "청록 두루마기 한복",
  brand: "설백",
  photo: "seolbaek",
  kind: "whole",
  aspect: 0.386,
  color: "#35617b",
  shade: "#203c4c",
  pts: [
    [0.51, 0.0],
    [0.476, 0.001],
    [0.463, 0.008],
    [0.463, 0.048],
    [0.416, 0.055],
    [0.412, 0.091],
    [0.382, 0.112],
    [0.196, 0.141],
    [0.172, 0.152],
    [0.115, 0.233],
    [0.0, 0.462],
    [0.007, 0.47],
    [0.142, 0.482],
    [0.142, 0.535],
    [0.034, 0.826],
    [0.142, 0.846],
    [0.24, 0.85],
    [0.26, 0.947],
    [0.291, 0.966],
    [0.324, 0.974],
    [0.324, 1.0],
    [0.395, 1.0],
    [0.395, 0.974],
    [0.412, 0.97],
    [0.568, 0.973],
    [0.571, 1.0],
    [0.628, 1.0],
    [0.639, 0.936],
    [0.713, 0.921],
    [0.757, 0.845],
    [0.885, 0.841],
    [0.905, 0.837],
    [0.912, 0.824],
    [0.949, 0.82],
    [0.949, 0.763],
    [0.865, 0.542],
    [0.865, 0.488],
    [0.99, 0.474],
    [1.0, 0.461],
    [0.855, 0.177],
    [0.818, 0.141],
    [0.642, 0.113],
    [0.595, 0.098],
    [0.588, 0.051],
    [0.541, 0.043],
    [0.541, 0.008],
  ],
};

export const LAYOVER: Garment = {
  name: "옐로 튤 드레스",
  brand: "레이오버",
  photo: "layover",
  kind: "whole",
  aspect: 0.657,
  color: "#f1dcac",
  shade: "#95886a",
  pts: [
    [0.355, 0.0],
    [0.296, 0.017],
    [0.259, 0.018],
    [0.241, 0.024],
    [0.208, 0.066],
    [0.192, 0.13],
    [0.192, 0.179],
    [0.167, 0.18],
    [0.167, 0.212],
    [0.137, 0.273],
    [0.143, 0.324],
    [0.176, 0.324],
    [0.182, 0.349],
    [0.229, 0.35],
    [0.229, 0.402],
    [0.01, 0.743],
    [0.022, 0.754],
    [0.016, 0.866],
    [0.0, 0.907],
    [0.045, 0.919],
    [0.049, 0.932],
    [0.153, 0.959],
    [0.227, 0.964],
    [0.229, 0.978],
    [0.263, 0.987],
    [0.431, 1.0],
    [0.639, 0.997],
    [0.643, 0.988],
    [0.724, 0.986],
    [0.743, 0.981],
    [0.745, 0.965],
    [0.882, 0.954],
    [1.0, 0.906],
    [0.98, 0.813],
    [0.98, 0.755],
    [0.998, 0.748],
    [0.763, 0.4],
    [0.763, 0.347],
    [0.804, 0.346],
    [0.808, 0.329],
    [0.841, 0.329],
    [0.841, 0.281],
    [0.865, 0.274],
    [0.837, 0.223],
    [0.835, 0.181],
    [0.806, 0.18],
    [0.806, 0.126],
    [0.788, 0.063],
    [0.775, 0.04],
    [0.751, 0.022],
    [0.704, 0.018],
    [0.627, 0.0],
    [0.545, 0.022],
    [0.453, 0.023],
  ],
};

/** 화면에 띄우는 옷 이름: "설백 쪽빛 한복". */
export function fullName(g: Garment): string {
  return g.brand ? `${g.brand} ${g.name}` : g.name;
}

const ALL = [SHIRT, DRESS, PANTS, SKIRT, JACKET, TAILORED, SILUA, RESTITCH, ECO, SEOLBAEK, LAYOVER];
/** 위브온 중촌 6팀 시그니처 옷(제품 사진이 있는 것). */
export const BRANDS = ALL.filter((g) => g.photo);

/** 피날레에 입힐 옷: 완성한 옷 중 마지막 상의(원피스 포함) + 마지막 하의. 하나도 없으면 기본 한 벌. */
export function pickOutfit(names: string[], fallback: Garment = SHIRT): Garment[] {
  const made = names.map((n) => ALL.find((g) => g.name === n)).filter((g): g is Garment => !!g);
  const isBottom = (g: Garment) => g.kind === "bottom" || g === PANTS || g === SKIRT;
  // 한 벌 옷(드레스·한복)을 하나라도 만들었으면 그게 피날레에 더 화려하다
  const whole = made.filter((g) => g.kind === "whole").at(-1);
  if (whole) return [whole];
  const top = made.filter((g) => !isBottom(g)).at(-1);
  const bottom = made.filter(isBottom).at(-1);
  const out = [bottom, top].filter((g): g is Garment => !!g);
  return out.length ? out : [fallback];
}

/** 몸에 맞출 때 어깨(하의는 골반) 폭·몸통 길이에 곱하는 수. top은 기준선 위로 올리는 비율.
 *  사진 옷은 폭을 사진 비율로 정하므로 sw는 안 쓰고, top은 사진 속 어깨 높이. */
const FIT: Record<string, { anchor: "shoulder" | "hip"; sw: number; th: number; top: number }> = {
  [SHIRT.name]: { anchor: "shoulder", sw: 1.5, th: 1.2, top: 0.08 },
  [JACKET.name]: { anchor: "shoulder", sw: 1.55, th: 1.25, top: 0.07 },
  [DRESS.name]: { anchor: "shoulder", sw: 1.9, th: 2.1, top: 0.05 },
  [PANTS.name]: { anchor: "hip", sw: 2.4, th: 1.7, top: 0.04 },
  [SKIRT.name]: { anchor: "hip", sw: 3.0, th: 0.95, top: 0.1 },
  [TAILORED.name]: { anchor: "shoulder", sw: 0, th: 2.9, top: 0.08 },
  [SILUA.name]: { anchor: "shoulder", sw: 0, th: 2.7, top: 0.09 },
  [RESTITCH.name]: { anchor: "shoulder", sw: 0, th: 2.8, top: 0.1 },
  [ECO.name]: { anchor: "shoulder", sw: 0, th: 1.75, top: 0.1 },
  [SEOLBAEK.name]: { anchor: "shoulder", sw: 0, th: 3.0, top: 0.13 },
  [LAYOVER.name]: { anchor: "shoulder", sw: 0, th: 2.4, top: 0.06 },
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
  const h = torso * f.th;
  // 사진은 찌그러지면 티가 나서 비율을 지킨다
  const w = g.photo ? h * g.aspect : span * f.sw;
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

/** 이름으로 옷 찾기(컬렉션·피날레에서 룩북 사진을 붙일 때). */
export function garmentByName(name: string): Garment | undefined {
  return ALL.find((g) => g.name === name);
}
