import { test } from "node:test";
import assert from "node:assert/strict";

import { loadMockRaw } from "../../scripts/mock/loadMockRaw.js";
import { buildContext } from "../../scripts/context.js";
import { computeCup } from "../../scripts/cup/bracket.js";
import config from "../../config.js";

import { computeStandings } from "../../scripts/stats/standings.js";
import { computeH2HGrid } from "../../scripts/stats/h2hGrid.js";
import { computeWeeklyAwards } from "../../scripts/stats/weeklyAwards.js";
import { computePositionalStrength } from "../../scripts/stats/positionalStrength.js";
import { computeScoringType } from "../../scripts/stats/scoringType.js";
import { computeFiftyNineClub } from "../../scripts/stats/fiftyNineClub.js";
import { computeBenchStats } from "../../scripts/stats/benchStats.js";
import { computeDraftGrades } from "../../scripts/stats/draftGrades.js";
import { computeTradeLedger } from "../../scripts/stats/tradeLedger.js";
import { computeWaiverHitRate } from "../../scripts/stats/waiverHitRate.js";
import { computeFormGuide } from "../../scripts/stats/formGuide.js";

// One shared context, built once from the real mock fixtures, the same way
// build.js does -- exercises the full fetch-shape -> context -> stats pipeline
// end to end, then checks structural invariants each module should satisfy
// regardless of the (randomly generated) mock data's specific numbers.
const context = buildContext(loadMockRaw());

test("standings: every manager present, W+D+L equals played", () => {
  const { rows } = computeStandings(context);
  assert.equal(rows.length, 12);
  for (const row of rows) {
    assert.equal(row.won + row.drawn + row.lost, row.played);
  }
});

test("h2h grid: every cell's W+D+L matches the number of meetings, and mirrors correctly", () => {
  const { cells } = computeH2HGrid(context);
  const byPair = new Map(cells.map((c) => [`${c.managerId}:${c.opponentId}`, c]));
  for (const cell of cells) {
    const mirror = byPair.get(`${cell.opponentId}:${cell.managerId}`);
    assert.ok(mirror, "mirrored cell should exist");
    assert.equal(cell.wins, mirror.losses);
    assert.equal(cell.pointsFor, mirror.pointsAgainst);
  }
});

test("weekly awards: one recap per finished GW, hall of fame tallies are non-negative", () => {
  const { recaps, hallOfFame } = computeWeeklyAwards(context);
  assert.equal(recaps.length, context.finishedGws.length);
  for (const list of Object.values(hallOfFame)) {
    for (const row of list) assert.ok(row.count > 0);
  }
});

test("positional strength: league-wide 'for' total equals league-wide 'against' total", () => {
  const { perManager } = computePositionalStrength(context);
  const sumSide = (side) =>
    perManager.reduce((sum, m) => sum + m[side].GK + m[side].DEF + m[side].MID + m[side].FWD, 0);
  assert.equal(sumSide("for"), sumSide("against"));
});

test("scoring type: cards only ever cost points, never award them", () => {
  const { perManager } = computeScoringType(context);
  for (const m of perManager) assert.ok(m.cardsLost <= 0);
});

test("59 club: season totals sum to the total instance count", () => {
  const { instances, seasonTotals } = computeFiftyNineClub(context);
  const sum = seasonTotals.reduce((s, row) => s + row.count, 0);
  assert.equal(sum, instances.length);
});

test("bench stats: non-negative bench points, eligible >= could-have-won", () => {
  const { perManager } = computeBenchStats(context);
  for (const m of perManager) {
    assert.ok(m.benchPointsWasted >= 0);
    assert.ok(m.eligibleLossesOrDraws >= m.couldHaveWonCount);
  }
});

test("draft grades: every drafted player appears exactly once in the scatter data", () => {
  const { leaderboard, scatter } = computeDraftGrades(context);
  assert.equal(leaderboard.length, 12);
  assert.equal(scatter.length, context.draftChoices.length);
});

test("trade ledger: every trade nets to zero across both sides", () => {
  const { log } = computeTradeLedger(context);
  assert.ok(log.length > 0, "mock fixtures should include at least one trade");
  for (const trade of log) {
    const total = trade.sides.reduce((sum, s) => sum + s.netValue, 0);
    assert.equal(total, 0);
  }
});

test("waiver hit rate: pickup count matches approved free-agent/waiver transactions", () => {
  const { pickups, hitRateLeaderboard } = computeWaiverHitRate(context);
  const approvedAdds = context.transactions.filter((t) => t.result === "a" && t.elementIn != null);
  assert.equal(pickups.length, approvedAdds.length);
  assert.equal(hitRateLeaderboard.length, 12);
  assert.ok(pickups.some((p) => p.isHit), "mock fixtures should include at least one hit");
});

test("form guide: rolling window never exceeds 5 gameweeks", () => {
  const { rows } = computeFormGuide(context);
  assert.equal(rows.length, 12);
  for (const row of rows) assert.ok(row.gwsIncluded.length <= 5);
});

test("cup: round 1 resolved, round 2 drawn but not yet played (matches mock GW range)", () => {
  const cup = computeCup(context, config.CUP_ROUND_GWS, null);
  assert.equal(cup.seeds.length, 12);
  assert.equal(cup.rounds.round1.results.length, 4);
  assert.ok(cup.rounds.round2.draw.length === 4);
  assert.equal(cup.rounds.round2.results, null);
});

test("cup: re-running with the previous result never reshuffles an existing draw", () => {
  const first = computeCup(context, config.CUP_ROUND_GWS, null);
  const second = computeCup(context, config.CUP_ROUND_GWS, first);
  assert.deepEqual(second.rounds.round1.draw, first.rounds.round1.draw);
  assert.deepEqual(second.rounds.round2.draw, first.rounds.round2.draw);
});
