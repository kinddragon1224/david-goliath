/** 웹캠 관절 좌표 → 던지기·조준·시작 동작.
 *
 * 모든 판정은 "어깨너비"를 1로 둔 몸 좌표에서 한다. 그래서 아이가 멀리 서든
 * 어른이 가까이 서든 같은 동작이 같은 값으로 읽힌다. 몸 전체가 좌우로 움직여도
 * 손이 몸에 대해 움직이지 않으면 던지기로 읽지 않는다.
 *
 * 던지기는 두 박자다.
 * 1) 장전: 손을 어깨보다 높이 들거나(머리 위) 몸 뒤로 젖힌다. 이때 돌이 날아갈 자리가 정해진다.
 * 2) 투척: 장전된 손을 앞·아래로 빠르게 내린다.
 * 천천히 손을 내리는 것, 몸을 흔드는 것, 손을 들고만 있는 것은 던지기가 아니다.
 */

export type Landmark = { x: number; y: number; v: number };

export type Aim = { aimX: number; aimY: number };

export type ThrowEvent = Aim & { power: number };

/** 한 장면의 관절. img는 좌우 반전된 화면 좌표(0..1), worldZ는 미터(카메라 쪽이 음수). */
export type BodyInput = {
  t: number;
  aspect: number;
  img: Landmark[];
  worldZ: number[] | null;
};

export type MotionResult = {
  present: boolean;
  tooFar: boolean;
  offCenter: boolean;
  handsUp: boolean;
  /** 던질 손이 장전된 상태. */
  armed: boolean;
  chestStill: boolean;
  aim: Aim | null;
  throwEvent: ThrowEvent | null;
};

const NOSE = 0;
const SHOULDER = [11, 12];
const ELBOW = [13, 14];
const WRIST = [15, 16];
const PINKY = [17, 18];
const INDEX = [19, 20];

/* 판정 기준. 단위는 어깨너비(s), 시간은 초. */
export const MOTION = {
  /** 이 높이(어깨선 위)부터 장전. */
  cockHeight: -0.25,
  /** 손이 몸 뒤로 이만큼(미터) 젖혀져도 장전. */
  cockBackZ: 0.15,
  /** 장전 후 이 시간 안에 던지지 않으면 풀린다. */
  cockHoldMs: 700,
  /** 투척: 아래로 내리는 속도(s/초)와 꼭대기에서 내려온 거리. */
  releaseDownSpeed: 4,
  releaseDrop: 0.7,
  /** 투척: 카메라 쪽으로 미는 속도(m/초). */
  releaseForwardSpeed: 1.6,
  /** 장전 없이 크게 휘두른 경우(옆던지기·아래던지기). */
  swingSpeed: 7.5,
  swingTravel: 1.3,
  throwCooldownMs: 420,
  /** 시작 동작: 두 손을 어깨선 위 이만큼(머리 위). */
  handsUpHeight: -0.9,
  /** 너무 멀다고 보는 어깨너비(화면 높이 대비). */
  nearScale: 0.09,
  minScale: 0.055,
  centerSlack: 0.28,
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 떨림은 줄이고 빠른 움직임은 늦추지 않는 필터. */
export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  private t = 0;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  constructor(minCutoff = 1.4, beta = 0.7, dCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }
  reset(): void {
    this.x = null;
    this.dx = 0;
  }
  filter(v: number, tMs: number): number {
    if (this.x === null) {
      this.x = v;
      this.t = tMs;
      return v;
    }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000);
    this.t = tMs;
    const a = (cut: number) => 1 / (1 + 1 / (2 * Math.PI * cut * dt));
    const dv = (v - this.x) / dt;
    this.dx += a(this.dCutoff) * (dv - this.dx);
    const cut = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += a(cut) * (v - this.x);
    return this.x;
  }
}

type HandSample = {
  t: number;
  /** 어깨 중심 기준 몸 좌표. y는 아래가 +. */
  hx: number;
  hy: number;
  /** 같은 쪽 어깨 기준 가로 위치. */
  hxs: number;
  /** 같은 쪽 어깨보다 뒤(+)로 간 거리, 미터. */
  dz: number;
  conf: number;
  fromWrist: boolean;
};

type HandState = {
  hist: HandSample[];
  /** 손이 한 번 어깨 아래로 내려와야 장전할 수 있다. 시작 동작 직후 오발 방지. */
  ready: boolean;
  readyT: number;
  cocked: boolean;
  lastCockT: number;
  peakHy: number;
  peakAim: Aim;
};

const newHand = (): HandState => ({
  hist: [],
  ready: false,
  readyT: 0,
  cocked: false,
  lastCockT: 0,
  peakHy: 0,
  peakAim: { aimX: 0, aimY: 0 },
});

/** 몸 좌표의 손 위치 → 조준. 손을 든 높이가 세로, 몸이 선 자리와 손의 좌우가 가로. */
export function aimFromHand(hxs: number, hy: number, bodyX: number): Aim {
  return {
    aimX: clamp(hxs * 0.6 + (bodyX - 0.5) * 2.2, -1, 1),
    aimY: clamp((hy + 0.35) / 0.95, -1, 1),
  };
}

export class MotionTracker {
  private hands: [HandState, HandState] = [newHand(), newHand()];
  private scale = 0;
  private presentFrames = 0;
  private absentFrames = 0;
  private present = false;
  private cooldownUntil = 0;
  private activeSide = 1;
  private fx = new OneEuro();
  private fy = new OneEuro();

  reset(): void {
    this.hands = [newHand(), newHand()];
    this.cooldownUntil = 0;
    this.fx.reset();
    this.fy.reset();
  }

  update(body: BodyInput | null, t: number): MotionResult {
    const none: MotionResult = {
      present: this.present,
      tooFar: false,
      offCenter: false,
      handsUp: false,
      armed: false,
      chestStill: false,
      aim: null,
      throwEvent: null,
    };
    if (!body) {
      this.markAbsent();
      none.present = this.present;
      return none;
    }
    const { img, aspect } = body;
    const P = (i: number) => img[i] ?? { x: 0, y: 0, v: 0 };
    const ls = P(SHOULDER[0]);
    const rs = P(SHOULDER[1]);
    const rawScale = Math.hypot((rs.x - ls.x) * aspect, rs.y - ls.y);
    const seen = ls.v > 0.4 && rs.v > 0.4 && rawScale > MOTION.minScale && (P(NOSE).v > 0.3 || P(23).v > 0.3);
    if (!seen) {
      this.markAbsent();
      none.present = this.present;
      return none;
    }
    this.absentFrames = 0;
    this.presentFrames += 1;
    if (this.presentFrames >= 3) this.present = true;

    this.scale = this.scale > 0 ? this.scale + (rawScale - this.scale) * 0.25 : rawScale;
    const s = this.scale;
    const cxN = (ls.x + rs.x) / 2;
    const cx = cxN * aspect;
    const cy = (ls.y + rs.y) / 2;
    const z = (i: number) => body.worldZ?.[i] ?? 0;

    const samples: (HandSample | null)[] = [0, 1].map((side) => {
      const sh = P(SHOULDER[side]);
      const pt = handPoint(body, side);
      if (!pt) return null;
      return {
        t,
        hx: (pt.X - cx) / s,
        hy: (pt.Y - cy) / s,
        hxs: (pt.X - sh.x * aspect) / s,
        dz: body.worldZ ? pt.z - z(SHOULDER[side]) : 0,
        conf: pt.conf,
        fromWrist: pt.fromWrist,
      };
    });

    let throwEvent: ThrowEvent | null = null;
    let bestPower = 0;
    for (const side of [0, 1] as const) {
      const sample = samples[side];
      const hand = this.hands[side];
      if (!sample || sample.conf < 0.3) {
        if (hand.cocked && t - hand.lastCockT > MOTION.cockHoldMs) hand.cocked = false;
        continue;
      }
      hand.hist.push(sample);
      while (hand.hist.length > 0 && t - hand.hist[0].t > 600) hand.hist.shift();
      const ev = this.stepHand(hand, sample, cxN, t);
      if (ev && ev.power > bestPower) {
        bestPower = ev.power;
        throwEvent = ev;
        this.activeSide = side;
      }
    }

    const [L, R] = samples;
    const handsUp =
      !!L &&
      !!R &&
      L.fromWrist &&
      R.fromWrist &&
      L.conf > 0.45 &&
      R.conf > 0.45 &&
      L.hy < MOTION.handsUpHeight &&
      R.hy < MOTION.handsUpHeight;

    if (handsUp) {
      // 시작 동작을 던지기로 읽지 않는다
      throwEvent = null;
      for (const h of this.hands) {
        h.cocked = false;
        h.ready = false;
      }
    }
    if (throwEvent) {
      this.cooldownUntil = t + MOTION.throwCooldownMs;
      for (const h of this.hands) h.cocked = false;
    }

    const chestStill =
      !!L &&
      !!R &&
      L.conf > 0.5 &&
      R.conf > 0.5 &&
      Math.abs(L.hx - R.hx) < 0.55 &&
      Math.abs(L.hy - R.hy) < 0.45 &&
      L.hy > 0.1 &&
      L.hy < 1.8 &&
      R.hy > 0.1 &&
      R.hy < 1.8 &&
      speedOf(this.hands[0].hist) < 1.2 &&
      speedOf(this.hands[1].hist) < 1.2;

    const armed = !handsUp && this.hands.some((h) => h.cocked);
    // 화면 조준점: 장전한 손, 없으면 더 높이 든 손
    let side = this.activeSide;
    const cockedSide = this.hands.findIndex((h) => h.cocked);
    if (cockedSide >= 0) side = cockedSide;
    else if (L && R) side = L.hy < R.hy ? 0 : 1;
    else if (L) side = 0;
    else if (R) side = 1;
    this.activeSide = side;
    const h = samples[side];
    let aim: Aim | null = null;
    if (h && h.conf >= 0.3) {
      const raw = aimFromHand(h.hxs, h.hy, cxN);
      aim = { aimX: this.fx.filter(raw.aimX, t), aimY: this.fy.filter(raw.aimY, t) };
    }

    return {
      present: this.present,
      tooFar: s < MOTION.nearScale,
      offCenter: Math.abs(cxN - 0.5) > MOTION.centerSlack,
      handsUp,
      armed,
      chestStill,
      aim,
      throwEvent,
    };
  }

  private markAbsent(): void {
    this.presentFrames = 0;
    this.absentFrames += 1;
    if (this.absentFrames > 10) {
      this.present = false;
      this.hands = [newHand(), newHand()];
      this.scale = 0;
    }
  }

  private stepHand(hand: HandState, cur: HandSample, bodyX: number, t: number): ThrowEvent | null {
    if (!hand.ready) {
      if (cur.hy > 0) {
        hand.ready = true;
        hand.readyT = t;
      }
      return null;
    }
    const isCock = cur.hy < MOTION.cockHeight || cur.dz > MOTION.cockBackZ;
    const aimNow = aimFromHand(cur.hxs, cur.hy, bodyX);
    if (isCock) {
      if (!hand.cocked) {
        hand.cocked = true;
        hand.peakHy = cur.hy;
        hand.peakAim = aimNow;
      }
      hand.lastCockT = t;
      // 손이 가장 높았던 순간(=멈칫한 장전 자리)의 조준을 쥔다
      if (cur.hy <= hand.peakHy) {
        hand.peakHy = cur.hy;
        hand.peakAim = aimNow;
      }
    } else if (hand.cocked && t - hand.lastCockT > MOTION.cockHoldMs) {
      hand.cocked = false;
    }
    if (t < this.cooldownUntil) return null;

    const v = velocity(hand.hist, 0.05);
    if (!v) return null;
    if (hand.cocked) {
      const drop = cur.hy - hand.peakHy;
      const down = v.vy > MOTION.releaseDownSpeed && drop > MOTION.releaseDrop;
      const forward = v.vdz < -MOTION.releaseForwardSpeed && drop > 0.3;
      if (down || forward) {
        const strength = Math.max(v.vy / 10, -v.vdz / 4, Math.hypot(v.vx, v.vy) / 11);
        hand.cocked = false;
        return { ...hand.peakAim, power: clamp(0.45 + strength * 0.55, 0.45, 1) };
      }
      return null;
    }
    // 장전 없이 크게 휘두른 경우: 지금 손 위치로 던진다
    const speed = Math.hypot(v.vx, v.vy);
    const settled = t - hand.readyT > 400;
    if (settled && speed > MOTION.swingSpeed && travelOf(hand.hist, 0.25) > MOTION.swingTravel) {
      return { ...aimNow, power: clamp(0.45 + (speed / 12) * 0.55, 0.45, 1) };
    }
    return null;
  }
}

/** 손 위치: 손목·새끼·검지 평균. 너무 빨라 손이 번지면 팔꿈치 방향으로 짐작한다. */
function handPoint(body: BodyInput, side: number): { X: number; Y: number; z: number; conf: number; fromWrist: boolean } | null {
  const { img, aspect } = body;
  const z = (i: number) => body.worldZ?.[i] ?? 0;
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let best = 0;
  for (const i of [WRIST[side], PINKY[side], INDEX[side]]) {
    const p = img[i];
    if (!p || p.v < 0.3) continue;
    const w = i === WRIST[side] ? p.v * 1.5 : p.v;
    sw += w;
    sx += p.x * aspect * w;
    sy += p.y * w;
    sz += z(i) * w;
    best = Math.max(best, p.v);
  }
  if (sw >= 0.45) return { X: sx / sw, Y: sy / sw, z: sz / sw, conf: best, fromWrist: true };
  const e = img[ELBOW[side]];
  const sh = img[SHOULDER[side]];
  if (!e || !sh || e.v < 0.4 || sh.v < 0.4) return null;
  const k = 0.85;
  return {
    X: (e.x + (e.x - sh.x) * k) * aspect,
    Y: e.y + (e.y - sh.y) * k,
    z: z(ELBOW[side]) + (z(ELBOW[side]) - z(SHOULDER[side])) * k,
    conf: e.v * 0.6,
    fromWrist: false,
  };
}

/** 최근 window초 사이 속도(s/초, m/초). */
function velocity(hist: HandSample[], window: number): { vx: number; vy: number; vdz: number } | null {
  if (hist.length < 2) return null;
  const cur = hist[hist.length - 1];
  let ref: HandSample | null = null;
  for (let i = hist.length - 2; i >= 0; i--) {
    if (cur.t - hist[i].t >= window * 1000) {
      ref = hist[i];
      break;
    }
  }
  if (!ref) return null;
  const dt = (cur.t - ref.t) / 1000;
  if (dt > 0.25) return null;
  return { vx: (cur.hx - ref.hx) / dt, vy: (cur.hy - ref.hy) / dt, vdz: (cur.dz - ref.dz) / dt };
}

function speedOf(hist: HandSample[]): number {
  const v = velocity(hist, 0.1);
  return v ? Math.hypot(v.vx, v.vy) : 0;
}

function travelOf(hist: HandSample[], window: number): number {
  if (hist.length < 2) return 0;
  const cur = hist[hist.length - 1];
  let d = 0;
  for (let i = hist.length - 1; i > 0; i--) {
    if (cur.t - hist[i - 1].t > window * 1000) break;
    d += Math.hypot(hist[i].hx - hist[i - 1].hx, hist[i].hy - hist[i - 1].hy);
  }
  return d;
}
