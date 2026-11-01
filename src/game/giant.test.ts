import assert from "node:assert/strict";
import { test } from "node:test";
import { contribute, freshGiant, normalizeGiant, resetGiant } from "./giant.ts";

test("점수만큼 거대 골리앗 체력이 깎이고 참가 수가 오른다", () => {
  const g = freshGiant("2026-11-01", 10_000);
  const { state, defeatedNow } = contribute(g, 3_200, 1);
  assert.equal(state.hp, 6_800);
  assert.equal(state.plays, 1);
  assert.equal(defeatedNow, false);
});

test("체력이 0이 되는 판에서 쓰러뜨리고 새 거대 골리앗이 나온다", () => {
  let g = freshGiant("2026-11-01", 10_000);
  g = contribute(g, 7_000, 1).state;
  const r = contribute(g, 5_000, 2);
  assert.equal(r.defeatedNow, true);
  assert.equal(r.state.defeated, 1);
  assert.equal(r.state.hp, 10_000);
  assert.equal(r.state.lastKoAt, 2);
});

test("날짜가 바뀌면 새로 시작하되 최대 체력 설정은 유지", () => {
  const saved = { day: "2026-10-31", max: 500_000, hp: 12, plays: 99, defeated: 3, lastKoAt: 5 };
  const g = normalizeGiant(saved, "2026-11-01");
  assert.deepEqual(g, freshGiant("2026-11-01", 500_000));
});

test("망가진 저장값은 기본값으로", () => {
  const g = normalizeGiant("garbage", "2026-11-01");
  assert.equal(g.hp, g.max);
  assert.equal(g.plays, 0);
});

test("운영자 초기화는 새 최대 체력으로", () => {
  const g = resetGiant(contribute(freshGiant("d", 100), 50, 1).state, 1_000);
  assert.equal(g.max, 1_000);
  assert.equal(g.hp, 1_000);
  assert.equal(g.plays, 0);
});
