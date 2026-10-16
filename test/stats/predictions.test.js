import { test } from "node:test";
import assert from "node:assert/strict";
import { computePredictions, resultOf } from "../../scripts/stats/predictions.js";

const m = (event, home, away, hp, ap, finished = true) => ({ event, homeManagerId: home, awayManagerId: away, homePoints: hp, awayPoints: ap, finished });
const people = ["a", "b", "c", "d", "e"].map((personKey, i) => ({ personKey, managerId: i + 1 }));

test("resultOf: home, away, draw, and null until finished", () => {
  assert.equal(resultOf(m(1, 1, 2, 50, 40)), "H");
  assert.equal(resultOf(m(1, 1, 2, 40, 50)), "A");
  assert.equal(resultOf(m(1, 1, 2, 40, 40)), "D");
  assert.equal(resultOf(m(1, 1, 2, 0, 0, false)), null);
});

test("table: scores calls, ignores unfinished fixtures and unknown people", () => {
  const matches = [m(1, 1, 2, 50, 40), m(1, 3, 4, 30, 60), m(2, 1, 3, 0, 0, false)];
  const picks = [
    { gw: 1, person: "a", fixture: "1-2", pick: "H" }, { gw: 1, person: "a", fixture: "3-4", pick: "A" },
    { gw: 1, person: "b", fixture: "1-2", pick: "A" }, { gw: 1, person: "b", fixture: "3-4", pick: "A" },
    { gw: 1, person: "zzz", fixture: "1-2", pick: "H" },
    { gw: 2, person: "a", fixture: "1-3", pick: "H" },
  ];
  const { table, weeks } = computePredictions(matches, picks, people);
  assert.equal(table.length, 2);
  const a = table.find((r) => r.personKey === "a");
  assert.deepEqual([a.correct, a.played, a.pct, a.perfectWeeks, a.weeks], [2, 2, 100, 1, 1]);
  const b = table.find((r) => r.personKey === "b");
  assert.deepEqual([b.correct, b.played, b.pct], [1, 2, 50]);
  assert.equal(table[0].personKey, "a");
  assert.equal(table[0].rank, 1);
  assert.equal(weeks.find((w) => w.gw === 2).complete, false);
});

test("table: streaks, and bold calls against a clear crowd favourite", () => {
  const matches = [m(1, 1, 2, 10, 50), m(2, 1, 2, 50, 10)];
  // gw1: crowd (a,b,c,d) says H, e boldly says A and is right. gw2: everyone says H
  const picks = [];
  for (const p of ["a", "b", "c", "d"]) picks.push({ gw: 1, person: p, fixture: "1-2", pick: "H" });
  picks.push({ gw: 1, person: "e", fixture: "1-2", pick: "A" });
  for (const p of ["a", "b", "c", "d", "e"]) picks.push({ gw: 2, person: p, fixture: "1-2", pick: "H" });
  const { table } = computePredictions(matches, picks, people);
  const e = table.find((r) => r.personKey === "e");
  assert.deepEqual([e.boldCalls, e.boldHits, e.streak, e.bestStreak, e.correct], [1, 1, 2, 2, 2]);
  const a = table.find((r) => r.personKey === "a");
  assert.deepEqual([a.boldCalls, a.streak, a.bestStreak], [0, 1, 1]);
});

test("ties share a rank", () => {
  const matches = [m(1, 1, 2, 50, 40)];
  const picks = [{ gw: 1, person: "a", fixture: "1-2", pick: "H" }, { gw: 1, person: "b", fixture: "1-2", pick: "H" }, { gw: 1, person: "c", fixture: "1-2", pick: "A" }];
  const { table } = computePredictions(matches, picks, people);
  assert.deepEqual(table.map((r) => r.rank), [1, 1, 3]);
});
