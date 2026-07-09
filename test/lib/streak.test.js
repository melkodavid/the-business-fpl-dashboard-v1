import { test } from "node:test";
import assert from "node:assert/strict";
import { currentStreak } from "../../scripts/lib/streak.js";

test("returns the trailing run of identical results", () => {
  assert.deepEqual(currentStreak(["W", "W", "L", "W", "W", "W"]), { type: "W", count: 3 });
  assert.deepEqual(currentStreak(["L", "L", "L"]), { type: "L", count: 3 });
  assert.deepEqual(currentStreak(["W", "D"]), { type: "D", count: 1 });
});

test("returns null for an empty history", () => {
  assert.equal(currentStreak([]), null);
});
