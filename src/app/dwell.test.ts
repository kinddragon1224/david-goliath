import assert from "node:assert/strict";
import { test } from "node:test";
import { stepDwell, type Dwell } from "./dwell.ts";

const start: Dwell<string> = { target: null, k: 0, spent: null };
const run = (d: Dwell<string>, over: string | null, steps: number) => {
  let fired: string | null = null;
  for (let i = 0; i < steps; i++) {
    const r = stepDwell(d, over, 0.1, 1);
    d = r.next;
    fired ??= r.fired;
  }
  return { d, fired };
};

test("손을 1초 머물면 한 번만 누르고, 떠났다 와야 다시 누른다", () => {
  const a = run(start, "b", 9);
  assert.equal(a.fired, null);
  const b = run(a.d, "b", 2);
  assert.equal(b.fired, "b");
  assert.equal(run(b.d, "b", 30).fired, null);
  const left = run(b.d, null, 1);
  assert.equal(run(left.d, "b", 11).fired, "b");
});

test("잠깐 벗어나도 게이지가 남고, 다른 버튼으로 옮기면 처음부터", () => {
  const a = run(start, "b", 6);
  const shaky = run(a.d, null, 1);
  assert.ok(shaky.d.k > 0.3 && shaky.d.target === "b");
  assert.ok(run(shaky.d, "c", 1).d.k < 0.2);
});
