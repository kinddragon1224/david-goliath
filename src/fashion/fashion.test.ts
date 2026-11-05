import assert from "node:assert/strict";
import { test } from "node:test";
import { reachHands } from "../game/reach.ts";
import {
  SHIRT,
  SKIRT,
  SEOLBAEK,
  fullName,
  inside,
  place,
  resample,
  toWorld,
} from "./garments.ts";
import { chart, smoothClock, StrikeDetector } from "./drum.ts";

test("화면 시계: 오디오 시계의 10ms 계단을 펴고, 크게 어긋나면 바로 맞춘다", () => {
  const dt = 1 / 60;
  let view = 5;
  let prev = view;
  for (let i = 1; i <= 600; i++) {
    const audio = 5 + Math.floor((i * dt) / 0.01) * 0.01;
    view = smoothClock(view, audio, dt);
    assert.ok(Math.abs(view - prev - dt) < 0.001, `frame ${i} step ${view - prev}`);
    assert.ok(Math.abs(view - audio) < 0.02);
    prev = view;
  }
  assert.equal(smoothClock(0, 9, dt), 9);
});

test("몽글 드럼 채보: 박 순서대로, 두 손 다 쓰고, 반 박 연타가 낀다", () => {
  const c = chart(54);
  assert.ok(c.some((n) => n.beat % 1 === 0.5));
  assert.deepEqual(new Set(c.map((n) => n.lane)), new Set([0, 1]));
  c.forEach((n, i) => assert.ok(i === 0 || c[i - 1].beat <= n.beat));
  assert.equal(c[0].beat, 4);
  assert.deepEqual(
    c.filter((n) => n.both).map((n) => [n.beat, n.lane]),
    [[15, 0], [15, 1], [31, 0], [31, 1], [47, 0], [47, 1]],
  );
});

test("내려치기: 올렸다 빠르게 줄을 지나야 한 번, 들지 않거나 느리면 안 친다", () => {
  const p = (y: number, x = 0.3) => ({ x, y });
  const d = new StrikeDetector();
  assert.equal(d.update(0, p(0.5), 0, 0.65, 0.48), null);
  const hit = d.update(0, p(0.75), 100, 0.65, 0.48);
  assert.equal(hit?.lane, 0);
  assert.ok(hit && hit.timeMs > 0 && hit.timeMs < 100);
  assert.equal(d.update(0, p(0.79), 180, 0.65, 0.48), null);
  d.update(0, p(0.4), 300, 0.65, 0.48);
  assert.equal(d.update(0, p(0.75, 0.8), 400, 0.65, 0.48)?.lane, 1);

  const slow = new StrikeDetector();
  slow.update(0, p(0.55), 0, 0.65, 0.48);
  slow.update(0, p(0.62), 300, 0.65, 0.48);
  assert.equal(slow.update(0, p(0.66), 500, 0.65, 0.48), null);

  // 인식이 끊긴 뒤 줄 아래서 나타나면 없는 타격을 만들지 않는다
  const gap = new StrikeDetector();
  gap.update(0, p(0.4), 0, 0.65, 0.48);
  assert.equal(gap.update(0, p(0.75), 500, 0.65, 0.48), null);
  gap.update(0, null, 600, 0.65, 0.48);
  assert.equal(gap.update(0, p(0.75), 700, 0.65, 0.48), null);
});

test("시그니처 옷 이름은 '브랜드 옷'", () => {
  assert.equal(fullName(SEOLBAEK), "설백 청록 두루마기 한복");
  assert.equal(fullName(SHIRT), "티셔츠");
});

const body = (lw: [number, number], rw: [number, number]) => {
  const img = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, v: 0 }));
  // 화면(거울) 기준: 사람 왼쪽 어깨가 화면 왼쪽
  img[11] = { x: 0.45, y: 0.4, v: 1 };
  img[12] = { x: 0.55, y: 0.4, v: 1 };
  for (const i of [15, 17, 19]) img[i] = { x: lw[0], y: lw[1], v: 1 };
  for (const i of [16, 18, 20]) img[i] = { x: rw[0], y: rw[1], v: 1 };
  return img;
};

test("어깨 높이에서 팔을 옆으로 쭉 뻗으면 화면 양끝 가까이 닿는다", () => {
  // 어깨 폭 0.1(가로 1:1) → 2.3배 = 0.23 떨어진 곳이 화면 끝
  const [l, r] = reachHands(body([0.27, 0.4], [0.73, 0.4]), 1);
  assert.ok(l && r);
  assert.ok(l.x < 0.12 && r.x > 0.88, `${l.x} ${r.x}`);
  assert.ok(Math.abs(l.y - 0.63) < 0.02);
});

test("머리 위로 든 손은 화면 위쪽, 손 순서는 화면 왼쪽부터", () => {
  const [l, r] = reachHands(body([0.6, 0.2], [0.4, 0.2]), 1);
  assert.ok(l && r);
  assert.ok(l.x < r.x);
  assert.ok(l.y < 0.15);
});

test("어깨가 안 보이면 손도 없다", () => {
  const img = body([0.3, 0.4], [0.7, 0.4]);
  img[11] = { ...img[11], v: 0 };
  assert.deepEqual(reachHands(img, 1), [null, null]);
});

test("옷본을 일정 간격으로 다시 찍으면 둘레를 따라 끊김 없이 이어진다", () => {
  const pts = toWorld(SKIRT, place(SKIRT, 960, 540, 1000, 700));
  const path = resample(pts, 14);
  assert.ok(path.length > 100);
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    assert.ok(d <= 14.01, `gap ${d} at ${i}`);
  }
  assert.ok(inside(pts, 960, 540));
  assert.ok(!inside(pts, 100, 100));
});
