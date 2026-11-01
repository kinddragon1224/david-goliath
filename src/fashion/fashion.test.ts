import assert from "node:assert/strict";
import { test } from "node:test";
import { reachHands } from "../game/reach.ts";
import { SKIRT, inside, place, resample, toWorld } from "./garments.ts";

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
