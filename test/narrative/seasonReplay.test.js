import { test } from "node:test";
import assert from "node:assert/strict";
import { loadMockRaw } from "../../scripts/mock/loadMockRaw.js";
import { buildContext } from "../../scripts/context.js";
import { buildSeasonReplay } from "../../scripts/narrative/seasonReplay.js";

const context = buildContext(loadMockRaw());
const replay = buildSeasonReplay(context);

test("every finished gw has a full, rank-1..12 standings snapshot", () => {
  for (const gw of context.finishedGws) {
    const snapshot = replay.at(gw);
    assert.equal(snapshot.standings.length, 12);
    const ranks = snapshot.standings.map((r) => r.rank).sort((a, b) => a - b);
    assert.deepEqual(ranks, Array.from({ length: 12 }, (_, i) => i + 1));
    for (const row of snapshot.standings) {
      assert.equal(row.won + row.drawn + row.lost, row.played);
      assert.equal(row.played, gw); // one match per manager per gw in this fixture
    }
  }
});

test("the final gw's replay standings agree with the real season-end standings on rank order", () => {
  const lastGw = context.finishedGws[context.finishedGws.length - 1];
  const finalReplay = replay.at(lastGw).standings;
  const realOrder = [...context.standings].sort((a, b) => a.rank - b.rank).map((s) => s.managerId);
  const replayOrder = finalReplay.map((s) => s.managerId);
  assert.deepEqual(replayOrder, realOrder);
});

test("streak length only grows or resets -- never exceeds games played", () => {
  for (const gw of context.finishedGws) {
    const snapshot = replay.at(gw);
    for (const [, streak] of snapshot.streaksByManagerId) {
      if (streak) assert.ok(streak.count <= gw);
    }
  }
});

test("before() returns null for the season's first gw, and the prior gw's snapshot otherwise", () => {
  const firstGw = context.finishedGws[0];
  const secondGw = context.finishedGws[1];
  assert.equal(replay.before(firstGw), null);
  assert.equal(replay.before(secondGw), replay.at(firstGw));
});
