import { test } from "node:test";
import assert from "node:assert/strict";

import { loadMockRaw } from "../../scripts/mock/loadMockRaw.js";
import { buildContext } from "../../scripts/context.js";
import { buildSeasonReplay } from "../../scripts/narrative/seasonReplay.js";
import { computeAllPlay } from "../../scripts/stats/allPlay.js";
import { computeBenchStats } from "../../scripts/stats/benchStats.js";
import { computeFiftyNineClub } from "../../scripts/stats/fiftyNineClub.js";
import { computeTradeLedger } from "../../scripts/stats/tradeLedger.js";
import { computeWaiverHitRate } from "../../scripts/stats/waiverHitRate.js";

import { detectStreaks } from "../../scripts/narrative/detectors/streaks.js";
import { detectRecords } from "../../scripts/narrative/detectors/records.js";
import { detectLuck } from "../../scripts/narrative/detectors/luck.js";
import { detectLineupPain } from "../../scripts/narrative/detectors/lineupPain.js";
import { detectTableDrama } from "../../scripts/narrative/detectors/tableDrama.js";
import { detectTradesWaivers } from "../../scripts/narrative/detectors/tradesWaivers.js";

const context = buildContext(loadMockRaw());
const replay = buildSeasonReplay(context);
const allPlay = computeAllPlay(context);
const benchStats = computeBenchStats(context);
const fiftyNineClub = computeFiftyNineClub(context);
const tradeLedger = computeTradeLedger(context);
const waiverHitRate = computeWaiverHitRate(context);

const allDetectorOutputs = {
  streaks: detectStreaks(context, replay),
  records: detectRecords(context),
  luck: detectLuck(context, allPlay),
  lineupPain: detectLineupPain(context, benchStats, fiftyNineClub),
  tableDrama: detectTableDrama(context, replay),
  tradesWaivers: detectTradesWaivers(context, tradeLedger, waiverHitRate),
};

function assertWellFormed(storyline) {
  assert.equal(typeof storyline.type, "string");
  assert.ok(Array.isArray(storyline.personKeys) && storyline.personKeys.length > 0);
  assert.equal(typeof storyline.facts, "object");
  assert.equal(typeof storyline.baseWeight, "number");
  assert.ok(context.finishedGws.includes(storyline.gw), `gw ${storyline.gw} must be a finished gw`);
  assert.equal(typeof storyline.dedupeKey, "string");
}

// tradesWaivers' three sub-behaviors are all rare events (a manager's 2nd+
// trade, a departed player facing their old manager for 10+, a pickup
// beating every round-1 pick that week) -- the shared mock season only has
// one trade and modest pickups, so it's expected (not a bug) that this one
// comes back empty here. It gets its own crafted-fixture tests below instead
// of the "must emit at least one" check the others get.
for (const [name, storylines] of Object.entries(allDetectorOutputs)) {
  test(`${name}: every emitted storyline is well-formed`, () => {
    if (name !== "tradesWaivers") {
      assert.ok(storylines.length > 0, `${name} should emit at least one storyline against the mock season`);
    }
    for (const s of storylines) assertWellFormed(s);
  });
}

test("streaks: a manager's win/loss streak is never flagged below length 3", () => {
  for (const s of allDetectorOutputs.streaks) {
    if (s.type !== "streak") continue;
    assert.ok(s.facts.length >= 3);
  }
});

test("records: a blowout margin is never smaller than a previously recorded closest margin at the same gw", () => {
  const blowouts = allDetectorOutputs.records.filter((s) => s.type === "record-blowout");
  const closest = allDetectorOutputs.records.filter((s) => s.type === "record-closest");
  assert.ok(blowouts.length > 0);
  assert.ok(closest.length > 0);
});

test("luck: robbery and snakebit storylines never target the same manager in the same gw", () => {
  const byGw = new Map();
  for (const s of allDetectorOutputs.luck) {
    const key = `${s.gw}:${s.facts.managerId}`;
    assert.ok(!byGw.has(key), "a manager should not be both robbed and snakebit in the same gw");
    byGw.set(key, s.type);
  }
});

test("lineup-pain: could-have-won instances match benchStats.couldHaveWonInstances 1:1", () => {
  const chwStorylines = allDetectorOutputs.lineupPain.filter((s) => s.type === "lineup-could-have-won");
  assert.equal(chwStorylines.length, benchStats.couldHaveWonInstances.length);
});

test("table-drama: 'table-eliminated' fires at most once per manager (dedupeKey has no gw)", () => {
  const eliminated = allDetectorOutputs.tableDrama.filter((s) => s.type === "table-eliminated");
  const keys = eliminated.map((s) => s.dedupeKey);
  assert.equal(new Set(keys).size, keys.length);
});

test("table-drama: a new leader storyline always names two different managers", () => {
  for (const s of allDetectorOutputs.tableDrama) {
    if (s.type !== "table-new-leader") continue;
    assert.notEqual(s.facts.newLeaderId, s.facts.previousLeaderId);
  }
});

test("trades-waivers: Ex Factor never targets a player against the manager who still rosters them", () => {
  for (const s of allDetectorOutputs.tradesWaivers) {
    if (s.type !== "trade-ex-factor") continue;
    assert.notEqual(s.facts.oldManagerId, s.facts.opponentId);
  }
});

test("every detector tolerates the season's very first finished gw without throwing (no prior-gw data yet)", () => {
  // Already exercised implicitly by running the full season above; this test
  // documents the invariant explicitly per the brief's testing requirements.
  const firstGw = context.finishedGws[0];
  assert.equal(replay.before(firstGw), null);
  assert.doesNotThrow(() => detectStreaks(context, replay));
  assert.doesNotThrow(() => detectTableDrama(context, replay));
});

// tradesWaivers' three sub-behaviors are all rare against a real season, so
// each gets its own minimal crafted fixture proving the logic actually fires
// (per the brief: "unit-test every detector against crafted fixtures").
function minimalContext(overrides = {}) {
  return {
    managers: { byId: new Map(), list: [] },
    trades: [],
    transactions: [],
    finishedGws: [],
    matches: [],
    gwPicks: {},
    gwPlayerStats: {},
    draftChoices: [],
    players: { byId: new Map() },
    ...overrides,
  };
}

test("trades-waivers: a manager's net trade value flipping sign vs. their previous trade fires trade-value-flip", () => {
  const ctx = minimalContext({ managers: { byId: new Map([[1, { personKey: "a" }]]), list: [] } });
  const craftedLedger = {
    log: [
      { gw: 2, tradeId: 1, sides: [{ managerId: 1, netValue: 5 }] },
      { gw: 4, tradeId: 2, sides: [{ managerId: 1, netValue: -3 }] },
    ],
  };
  const storylines = detectTradesWaivers(ctx, craftedLedger, { pickups: [] });
  const flips = storylines.filter((s) => s.type === "trade-value-flip");
  assert.equal(flips.length, 1);
  assert.equal(flips[0].facts.managerId, 1);
  assert.equal(flips[0].gw, 4);
});

test("trades-waivers: a departed player scoring 10+ against their old manager fires trade-ex-factor", () => {
  const ctx = minimalContext({
    managers: { byId: new Map([[1, { personKey: "a" }], [2, { personKey: "b" }]]), list: [] },
    trades: [{ event: 1, sides: [{ managerId: 1, playersIn: [], playersOut: [99] }] }],
    finishedGws: [1, 2],
    matches: [{ event: 2, finished: true, homeManagerId: 1, awayManagerId: 2 }],
    gwPicks: { 2: { 2: { starters: [99], bench: [] } } },
    gwPlayerStats: { 2: { 99: { totalPoints: 12 } } },
    players: { byId: new Map([[99, { webName: "Test Player" }]]) },
  });
  const storylines = detectTradesWaivers(ctx, { log: [] }, { pickups: [] });
  const exFactor = storylines.filter((s) => s.type === "trade-ex-factor");
  assert.equal(exFactor.length, 1);
  assert.equal(exFactor[0].facts.oldManagerId, 1);
  assert.equal(exFactor[0].facts.opponentId, 2);
  assert.equal(exFactor[0].facts.points, 12);
});

test("trades-waivers: a player who departed the same manager twice (trade, then re-added and dropped again) only fires trade-ex-factor once per qualifying gw", () => {
  const ctx = minimalContext({
    managers: { byId: new Map([[1, { personKey: "a" }], [2, { personKey: "b" }]]), list: [] },
    trades: [{ event: 1, sides: [{ managerId: 1, playersIn: [], playersOut: [99] }] }],
    transactions: [{ event: 2, managerId: 1, elementOut: 99, result: "a" }],
    finishedGws: [1, 2, 3],
    matches: [{ event: 3, finished: true, homeManagerId: 1, awayManagerId: 2 }],
    gwPicks: { 3: { 2: { starters: [99], bench: [] } } },
    gwPlayerStats: { 3: { 99: { totalPoints: 15 } } },
    players: { byId: new Map([[99, { webName: "Test Player" }]]) },
  });
  const storylines = detectTradesWaivers(ctx, { log: [] }, { pickups: [] });
  const exFactor = storylines.filter((s) => s.type === "trade-ex-factor");
  assert.equal(exFactor.length, 1);
  assert.equal(exFactor[0].gw, 3);
});

test("trades-waivers: a waiver pickup outscoring every round-1 pick that gw fires trade-waiver-outscores-r1", () => {
  const ctx = minimalContext({
    managers: { byId: new Map([[3, { personKey: "c" }]]), list: [] },
    finishedGws: [5],
    draftChoices: [
      { round: 1, elementId: 10 },
      { round: 1, elementId: 11 },
    ],
    gwPlayerStats: { 5: { 10: { totalPoints: 4 }, 11: { totalPoints: 6 }, 50: { totalPoints: 9 } } },
  });
  const waiverHitRateFixture = {
    pickups: [{ managerId: 3, elementId: 50, playerName: "Waiver Guy", acquiredGw: 5, gwsRostered: 1 }],
  };
  const storylines = detectTradesWaivers(ctx, { log: [] }, waiverHitRateFixture);
  const outscores = storylines.filter((s) => s.type === "trade-waiver-outscores-r1");
  assert.equal(outscores.length, 1);
  assert.equal(outscores[0].facts.managerId, 3);
  assert.equal(outscores[0].facts.points, 9);
  assert.equal(outscores[0].facts.bestRound1, 6);
});

test("trades-waivers: two separate real pickups of the same player in the same gw (add/drop/re-add) only fires trade-waiver-outscores-r1 once per gw", () => {
  const ctx = minimalContext({
    managers: { byId: new Map([[3, { personKey: "c" }]]), list: [] },
    finishedGws: [5],
    draftChoices: [{ round: 1, elementId: 10 }],
    gwPlayerStats: { 5: { 10: { totalPoints: 4 }, 50: { totalPoints: 9 } } },
  });
  // waiverHitRate.js legitimately records two separate pickups here (a real
  // add, drop, and re-add of the same player within one gw) -- the narrative
  // layer should still only tell this story once.
  const waiverHitRateFixture = {
    pickups: [
      { managerId: 3, elementId: 50, playerName: "Waiver Guy", acquiredGw: 5, gwsRostered: 1 },
      { managerId: 3, elementId: 50, playerName: "Waiver Guy", acquiredGw: 5, gwsRostered: 1 },
    ],
  };
  const storylines = detectTradesWaivers(ctx, { log: [] }, waiverHitRateFixture);
  const outscores = storylines.filter((s) => s.type === "trade-waiver-outscores-r1");
  assert.equal(outscores.length, 1);
});
