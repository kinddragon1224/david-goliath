import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DODGE_DIST,
  GOLIATH_HP,
  dodged,
  isFever,
  koBonus,
  partDamage,
  shiftFromBody,
  woundStage,
} from "./boss.ts";

test("피버 타임에는 피해가 2배, 방패는 언제나 0", () => {
  assert.equal(partDamage("몸통", false) * 2, partDamage("몸통", true));
  assert.equal(partDamage("방패", true), 0);
});

test("마지막 5초만 피버", () => {
  assert.equal(isFever(10, true), false);
  assert.equal(isFever(5, true), true);
  assert.equal(isFever(0.5, true), true);
  assert.equal(isFever(3, false), false);
});

test("빨리 쓰러뜨릴수록 보너스가 크다", () => {
  assert.ok(koBonus(12.2) > koBonus(3.1));
  assert.equal(koBonus(0), 0);
});

test("대충 맞히면 못 쓰러뜨리고, 머리·이마를 노려야 쓰러뜨린다", () => {
  // 대충: 몸통 위주 12번(머리 3, 피버에 몸통 3)
  const casual = 6 * partDamage("몸통", false) + 3 * partDamage("투구", false) + 3 * partDamage("몸통", true);
  assert.ok(casual < GOLIATH_HP, `대충 ${casual}`);
  // 잘하는 사람: 이마 3·투구 5·몸통 4 + 피버에 이마 1·투구 1
  const normal = 3 * partDamage("이마", false) + 5 * partDamage("투구", false) + 4 * partDamage("몸통", false);
  const fever = partDamage("이마", true) + partDamage("투구", true);
  assert.ok(normal + fever >= GOLIATH_HP, `잘함 ${normal + fever}`);
  // 피버 없이는 잘해도 끝까지 버틴다(마지막 5초가 승부)
  assert.ok(normal < GOLIATH_HP);
});

test("다윗이 일정 거리 이상 옆으로 가면 창을 피한 것", () => {
  assert.equal(dodged(0, DODGE_DIST - 1), false);
  assert.equal(dodged(0, -DODGE_DIST), true);
});

test("몸 위치를 다윗 위치로, 화면 밖으로는 안 나감", () => {
  assert.equal(shiftFromBody(0.5), 0);
  assert.ok(shiftFromBody(0.7) > 0);
  assert.equal(shiftFromBody(2), shiftFromBody(5));
});

test("체력이 줄수록 상처 단계가 오른다", () => {
  assert.deepEqual([1, 0.6, 0.3, 0.1].map(woundStage), [0, 1, 2, 3]);
});
