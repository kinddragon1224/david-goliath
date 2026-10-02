import assert from "node:assert/strict";
import { test } from "node:test";
import { MotionTracker, type BodyInput, type Landmark } from "./motion.ts";

/** 화면 가운데 선 사람. scale은 어깨너비(화면 높이 대비). hand(t)는 몸 좌표(어깨너비 단위). */
function body(
  t: number,
  opts: { scale?: number; cx?: number; right?: { x: number; y: number; z?: number }; left?: { x: number; y: number }; vis?: number },
): BodyInput {
  const aspect = 4 / 3;
  const s = opts.scale ?? 0.2;
  const cxN = opts.cx ?? 0.5;
  const cy = 0.4;
  const img: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }));
  const put = (i: number, bx: number, by: number, v = 0.95) => {
    img[i] = { x: cxN + (bx * s) / aspect, y: cy + by * s, v };
  };
  put(0, 0, -0.7);
  put(11, -0.5, 0);
  put(12, 0.5, 0);
  put(23, -0.35, 1.6);
  put(24, 0.35, 1.6);
  const l = opts.left ?? { x: -0.6, y: 1.5 };
  const r = opts.right ?? { x: 0.6, y: 1.5 };
  put(13, (l.x - 0.5) / 2, l.y / 2);
  put(14, (r.x + 0.5) / 2, r.y / 2);
  put(15, l.x, l.y, opts.vis ?? 0.9);
  put(16, r.x, r.y, opts.vis ?? 0.9);
  const worldZ = Array.from({ length: 33 }, () => 0);
  worldZ[16] = opts.right?.z ?? 0;
  return { t, aspect, img, worldZ };
}

function run(frames: (t: number) => Parameters<typeof body>[1], ms: number, fps = 30) {
  const tr = new MotionTracker();
  const events: { t: number; ev: NonNullable<ReturnType<MotionTracker["update"]>["throwEvent"]> }[] = [];
  let last: ReturnType<MotionTracker["update"]> | null = null;
  for (let t = 0; t <= ms; t += 1000 / fps) {
    last = tr.update(body(t, frames(t)), t);
    if (last.throwEvent) events.push({ t, ev: last.throwEvent });
  }
  return { events, last };
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.max(0, Math.min(1, k));

/** 손 내림 → 머리 위로 장전(멈칫) → 앞·아래로 빠르게 내림. */
function overhand(peakY: number, scale = 0.2, cx = 0.5, throwMs = 150) {
  return (t: number) => {
    let y = 1.5;
    if (t < 400) y = 1.5;
    else if (t < 900) y = lerp(1.5, peakY, (t - 400) / 500);
    else if (t < 1100) y = peakY;
    else y = lerp(peakY, 1.2, (t - 1100) / throwMs);
    return { scale, cx, right: { x: 0.55, y } };
  };
}

test("머리 위로 들었다 내리찍는 던지기를 한 번 잡는다", () => {
  const { events } = run(overhand(-1.1), 1800);
  assert.equal(events.length, 1);
  assert.ok(events[0].t > 1100 && events[0].t < 1300, `release at ${events[0].t}`);
  assert.ok(events[0].ev.aimY < -0.6, `aimY ${events[0].ev.aimY}`);
});

test("멀리 선 아이(작은 몸)도 같은 동작이면 잡힌다", () => {
  const { events } = run(overhand(-1.1, 0.07), 1800);
  assert.equal(events.length, 1);
});

test("장전 높이가 조준 높이를 정한다", () => {
  const head = run(overhand(-1.1), 1800).events[0].ev.aimY;
  const chest = run(overhand(-0.35), 1800).events[0].ev.aimY;
  assert.ok(head < chest, `${head} < ${chest}`);
});

test("손을 천천히 내리면 던지기가 아니다", () => {
  const { events } = run(overhand(-1.1, 0.2, 0.5, 900), 2400);
  assert.equal(events.length, 0);
});

test("손을 들고만 있으면 던지기가 아니고 장전 상태다", () => {
  const { events, last } = run(
    (t) => ({ right: { x: 0.55, y: t < 400 ? 1.5 : lerp(1.5, -1.1, (t - 400) / 400) } }),
    1000,
  );
  assert.equal(events.length, 0);
  assert.equal(last?.armed, true);
});

test("몸 전체가 옆으로 빨리 움직여도 던지기가 아니다", () => {
  const { events } = run((t) => ({ cx: lerp(0.3, 0.7, (t - 300) / 200) }), 1000);
  assert.equal(events.length, 0);
});

test("양손 번쩍은 시작 동작이고, 내리는 것은 던지기가 아니다", () => {
  const frames = (t: number) => {
    const y = t < 300 ? 1.5 : t < 700 ? lerp(1.5, -1.4, (t - 300) / 400) : t < 1700 ? -1.4 : lerp(-1.4, 1.5, (t - 1700) / 150);
    return { left: { x: -0.55, y }, right: { x: 0.55, y } };
  };
  const tr = new MotionTracker();
  let sawHandsUp = false;
  let throws = 0;
  for (let t = 0; t <= 2400; t += 33) {
    const r = tr.update(body(t, frames(t)), t);
    if (r.handsUp) sawHandsUp = true;
    if (r.throwEvent) throws += 1;
  }
  assert.ok(sawHandsUp);
  assert.equal(throws, 0);
});

test("한 손만 들면 시작 동작이 아니다", () => {
  const { last } = run(() => ({ right: { x: 0.55, y: -1.4 } }), 600);
  assert.equal(last?.handsUp, false);
});

test("손이 번져 손목을 놓쳐도 팔꿈치로 던지기를 잡는다", () => {
  const frames = (t: number) => ({ ...overhand(-1.1)(t), vis: t > 1080 ? 0.1 : 0.9 });
  const { events } = run(frames, 1800);
  assert.equal(events.length, 1);
});

test("두 번 연속 던지기", () => {
  const one = overhand(-1.0);
  const { events } = run((t) => one(t < 1500 ? t : t - 1300), 3200);
  assert.equal(events.length, 2);
});

test("너무 멀면 알려 준다", () => {
  assert.equal(run(() => ({ scale: 0.07 }), 300).last?.tooFar, true);
  assert.equal(run(() => ({ scale: 0.2 }), 300).last?.tooFar, false);
});

test("장전 없이 옆으로 크게 휘둘러도 던지기로 잡는다", () => {
  const { events } = run((t) => ({ right: { x: t < 800 ? 1.4 : lerp(1.4, -0.6, (t - 800) / 160), y: 0.6 } }), 1400);
  assert.equal(events.length, 1);
});

test("가만히 서 있을 때 카메라 떨림으로는 던지지 않는다", () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.16;
  const { events } = run(() => ({ right: { x: 0.6 + rnd(), y: 1.5 + rnd() }, left: { x: -0.6 + rnd(), y: 1.5 + rnd() } }), 5000);
  assert.equal(events.length, 0);
});
