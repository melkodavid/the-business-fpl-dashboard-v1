import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScheduleSwap } from "../../scripts/stats/scheduleSwap.js";

const m = (event, home, away, hp, ap) => ({ event, homeManagerId: home, awayManagerId: away, homePoints: hp, awayPoints: ap, finished: true });
// 4 managers over 2 weeks. Scores: 1 is strong, 4 is weak.
// GW1: 1v2 (50-40), 3v4 (30-20)   GW2: 1v3 (60-35), 2v4 (45-25)
const context = {
  managers: { list: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }] },
  matches: [m(1, 1, 2, 50, 40), m(1, 3, 4, 30, 20), m(2, 1, 3, 60, 35), m(2, 2, 4, 45, 25), { event: 3, homeManagerId: 1, awayManagerId: 2, homePoints: 0, awayPoints: 0, finished: false }],
};
const out = computeScheduleSwap(context);

test("own schedule reproduces the real record; unfinished weeks are ignored", () => {
  assert.deepEqual(out.gws, [1, 2]);
  for (const id of [1, 2, 3, 4]) {
    const own = out.matrix[id][id];
    assert.deepEqual([own.w, own.d, own.l, own.pts, own.rank], [out.actual[id].w, out.actual[id].d, out.actual[id].l, out.actual[id].pts, out.actual[id].rank]);
  }
  assert.deepEqual([out.actual[1].w, out.actual[1].pts, out.actual[4].l], [2, 6, 2]);
});

test("swap: manager 4 (scores 20, 25) on manager 2's schedule (faced 1 then 4)", () => {
  // GW1: 2 faced 1 (50) -> 4 loses; GW2: 2 faced 4 = A themselves -> 4 faces 2 (45) -> loses
  const swap = out.matrix[4][2];
  assert.deepEqual(swap.weeks.map((w) => [w.opp, w.result]), [[1, "L"], [2, "L"]]);
  // the same weak scores against manager 3's schedule (faced 4 then 1): GW1 faces 4 themselves -> faces 3 (30)
  assert.deepEqual(out.matrix[4][3].weeks.map((w) => w.opp), [3, 1]);
});

test("a strong manager on any schedule never does worse than a weak one, and ranks are 1-based", () => {
  for (const b of [1, 2, 3, 4]) assert.ok(out.matrix[1][b].pts >= out.matrix[4][b].pts);
  assert.ok(Object.values(out.actual).every((a) => a.rank >= 1 && a.rank <= 4));
});

test("schedule ranking: easiest faces the weakest opponents, hardest the strongest", () => {
  const easiest = out.schedules.find((s) => s.managerId === out.easiestId);
  const hardest = out.schedules.find((s) => s.managerId === out.hardestId);
  assert.ok(easiest.oppAvgScore <= hardest.oppAvgScore);
  assert.ok(out.leagueAvgScore >= easiest.oppAvgScore && out.leagueAvgScore <= hardest.oppAvgScore);
  assert.equal(easiest.easeRank, 1);
  assert.equal(hardest.easeRank, 4);
  // schedule luck sums to roughly zero across the league isn't guaranteed, but is finite
  assert.ok(out.schedules.every((s) => Number.isFinite(s.scheduleLuck)));
});
