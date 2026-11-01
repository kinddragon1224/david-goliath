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

test("현실적인 아이 플레이(몸통 위주 + 머리 몇 번 + 피버)로 쓰러뜨릴 수 있다", () => {
  // 20초 동안 약 12번 맞힘: 몸통 8, 머리 3, 그중 마지막 5초에 3번
  const normal = 6 * partDamage("몸통", false) + 2 * partDamage("투구", false);
  const fever = 2 * partDamage("몸통", true) + 1 * partDamage("투구", true);
  assert.ok(normal + fever >= GOLIATH_HP, `총 ${normal + fever}`);
  // 대충 던져 몸통만 6번 맞히면 못 쓰러뜨린다(너무 쉽지 않게)
  assert.ok(6 * partDamage("몸통", false) < GOLIATH_HP);
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
