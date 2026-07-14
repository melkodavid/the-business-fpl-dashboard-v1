import { test } from "node:test";
import assert from "node:assert/strict";

import { loadLore } from "../../scripts/narrative/lore.js";
import { buildSeasonReplay } from "../../scripts/narrative/seasonReplay.js";
import { detectFamilyDerby } from "../../scripts/narrative/detectors/familyDerby.js";
import { detectPalladinoGauntlet } from "../../scripts/narrative/detectors/palladinoGauntlet.js";
import { detectGenerationWar, summarize01sVsRest } from "../../scripts/narrative/detectors/generationWar.js";
import { detectBridesmaids } from "../../scripts/narrative/detectors/bridesmaids.js";
import { detectNoahTradeDesk } from "../../scripts/narrative/detectors/noahTradeDesk.js";
import { detectBeltWatch } from "../../scripts/narrative/detectors/beltWatch.js";
import { detectLuPostMark } from "../../scripts/narrative/detectors/luPostMark.js";

function managers(list) {
  return { list, byId: new Map(list.map((m) => [m.id, m])) };
}

test("familyDerby: same sibling pair is Brother Derby, same group different pair is Cousin Clash", () => {
  const lore = loadLore({
    people: [
      { personKey: "lu", family: { group: "palladino", pair: "lu-muk", relation: "brother" } },
      { personKey: "muk", family: { group: "palladino", pair: "lu-muk", relation: "brother" } },
      { personKey: "anthony", family: { group: "palladino", pair: "anthony-noah", relation: "brother" } },
    ],
  });
  const context = {
    managers: managers([
      { id: 1, personKey: "lu" },
      { id: 2, personKey: "muk" },
      { id: 3, personKey: "anthony" },
    ]),
    matches: [
      { event: 1, finished: true, homeManagerId: 1, awayManagerId: 2, homePoints: 50, awayPoints: 40 },
      { event: 2, finished: true, homeManagerId: 1, awayManagerId: 3, homePoints: 45, awayPoints: 55 },
    ],
  };
  const storylines = detectFamilyDerby(context, lore);
  assert.equal(storylines.length, 2);
  assert.equal(storylines[0].type, "family-brother-derby");
  assert.equal(storylines[1].type, "family-cousin-clash");
});

test("palladinoGauntlet: watches in advance, tracks progress, flags a clean sweep", () => {
  const lore = loadLore({
    people: [
      { personKey: "lu", family: { group: "palladino", pair: "lu-muk", relation: "brother" } },
      { personKey: "muk", family: { group: "palladino", pair: "lu-muk", relation: "brother" } },
      { personKey: "anthony", family: { group: "palladino", pair: "anthony-noah", relation: "brother" } },
      { personKey: "pat" },
      { personKey: "ibrahim" },
    ],
  });
  const context = {
    managers: managers([
      { id: 5, personKey: "pat" },
      { id: 1, personKey: "lu" },
      { id: 2, personKey: "muk" },
      { id: 3, personKey: "anthony" },
      { id: 6, personKey: "ibrahim" },
    ]),
    matches: [
      { event: 1, finished: true, homeManagerId: 5, awayManagerId: 6, homePoints: 50, awayPoints: 40 },
      { event: 2, finished: true, homeManagerId: 5, awayManagerId: 6, homePoints: 55, awayPoints: 45 },
      { event: 3, finished: true, homeManagerId: 5, awayManagerId: 1, homePoints: 30, awayPoints: 60 },
      { event: 4, finished: true, homeManagerId: 5, awayManagerId: 2, homePoints: 20, awayPoints: 70 },
      { event: 5, finished: true, homeManagerId: 5, awayManagerId: 3, homePoints: 25, awayPoints: 65 },
    ],
    finishedGws: [1, 2, 3, 4, 5],
  };
  const storylines = detectPalladinoGauntlet(context, lore);

  const watches = storylines.filter((s) => s.type === "gauntlet-watch");
  assert.equal(watches.length, 2); // gw1 and gw2, both before the run starts at gw3
  assert.deepEqual(watches.map((s) => s.gw).sort(), [1, 2]);
  assert.equal(watches[0].facts.length, 3);

  const progress = storylines.filter((s) => s.type === "gauntlet-progress");
  assert.equal(progress.length, 3);
  assert.deepEqual(progress.map((s) => ({ gw: s.gw, played: s.facts.played, wins: s.facts.wins })), [
    { gw: 3, played: 1, wins: 0 },
    { gw: 4, played: 2, wins: 0 },
    { gw: 5, played: 3, wins: 0 },
  ]);

  const swept = storylines.filter((s) => s.type === "gauntlet-swept");
  assert.equal(swept.length, 1);
  assert.equal(swept[0].gw, 5);
  assert.equal(swept[0].personKeys[0], "pat");
});

test("generationWar: a generation sweeping every cross-generation matchup that gw fires generation-sweep, and the matrix tallies correctly", () => {
  const lore = loadLore({
    people: [
      { personKey: "g1", generation: "01s" },
      { personKey: "g2", generation: "01s" },
      { personKey: "g3", generation: "2000s" },
      { personKey: "g4", generation: "2000s" },
    ],
  });
  const context = {
    managers: managers([
      { id: 1, personKey: "g1" },
      { id: 2, personKey: "g2" },
      { id: 3, personKey: "g3" },
      { id: 4, personKey: "g4" },
    ]),
    matches: [
      { event: 1, finished: true, homeManagerId: 1, awayManagerId: 3, homePoints: 60, awayPoints: 40 },
      { event: 1, finished: true, homeManagerId: 4, awayManagerId: 2, homePoints: 30, awayPoints: 70 },
    ],
    finishedGws: [1],
  };
  const { storylines, matrix } = detectGenerationWar(context, lore);
  const sweeps = storylines.filter((s) => s.type === "generation-sweep");
  assert.equal(sweeps.length, 1);
  assert.equal(sweeps[0].facts.generation, "01s");
  assert.equal(sweeps[0].facts.count, 2);

  assert.deepEqual(matrix["01s|2000s"], { wins: 2, draws: 0, losses: 0 });
  assert.deepEqual(matrix["2000s|01s"], { wins: 0, draws: 0, losses: 2 });
  assert.deepEqual(summarize01sVsRest(matrix), { wins: 2, draws: 0, losses: 0 });
});

test("bridesmaids: a bridesmaid leading fires bridesmaid-leading; a bridesmaid's later loss fires bridesmaid-costly-loss", () => {
  const lore = loadLore({
    people: [{ personKey: "marshall", bridesmaid: true }, { personKey: "ibrahim", bridesmaid: false }],
  });
  const context = {
    managers: managers([
      { id: 1, personKey: "marshall" },
      { id: 2, personKey: "ibrahim" },
    ]),
    matches: [
      { event: 1, finished: true, homeManagerId: 1, awayManagerId: 2, homePoints: 50, awayPoints: 40 },
      { event: 2, finished: true, homeManagerId: 2, awayManagerId: 1, homePoints: 60, awayPoints: 30 },
    ],
    finishedGws: [1, 2],
  };
  const replay = buildSeasonReplay(context);
  const storylines = detectBridesmaids(context, replay, lore);

  const leading = storylines.filter((s) => s.type === "bridesmaid-leading");
  assert.equal(leading.length, 1);
  assert.equal(leading[0].gw, 1);
  assert.equal(leading[0].personKeys[0], "marshall");
  assert.equal(leading[0].dedupeKey, "bridesmaid-leading:early:marshall");

  const costlyLoss = storylines.filter((s) => s.type === "bridesmaid-costly-loss");
  assert.equal(costlyLoss.length, 1);
  assert.equal(costlyLoss[0].gw, 2);
  assert.equal(costlyLoss[0].personKeys[0], "marshall");
  assert.ok(costlyLoss[0].facts.importance >= 2.5);
});

test("bridesmaids: escalates weight sharply from GW30+", () => {
  const lore = loadLore({ people: [{ personKey: "marshall", bridesmaid: true }] });
  const finishedGws = Array.from({ length: 31 }, (_, i) => i + 1);
  const matches = finishedGws.map((gw) => ({
    event: gw,
    finished: true,
    homeManagerId: 1,
    awayManagerId: 2,
    homePoints: 50,
    awayPoints: 40,
  }));
  const context = {
    managers: managers([
      { id: 1, personKey: "marshall" },
      { id: 2, personKey: "ibrahim" },
    ]),
    matches,
    finishedGws,
  };
  const replay = buildSeasonReplay(context);
  const storylines = detectBridesmaids(context, replay, lore);
  const leading = storylines.filter((s) => s.type === "bridesmaid-leading");
  const early = leading.find((s) => s.gw === 1);
  const late = leading.find((s) => s.gw === 30);
  assert.ok(late.baseWeight > early.baseWeight);
});

test("noahTradeDesk: entering the market, a negative trade, and a negative running total all fire; tolerates no noah this season", () => {
  const context = {
    managers: managers([{ id: 10, personKey: "noah" }]),
  };
  const tradeLedger = {
    log: [
      { gw: 2, tradeId: 1, sides: [{ managerId: 10, netValue: 5 }] },
      { gw: 4, tradeId: 2, sides: [{ managerId: 10, netValue: -8 }] },
    ],
  };
  const storylines = detectNoahTradeDesk(context, tradeLedger);
  assert.equal(storylines.filter((s) => s.type === "noah-trade-desk-entered").length, 2);
  assert.equal(storylines.filter((s) => s.type === "noah-trade-desk-negative").length, 1);
  const runningTotalStorylines = storylines.filter((s) => s.type === "noah-trade-desk-running-total");
  assert.equal(runningTotalStorylines.length, 1);
  assert.equal(runningTotalStorylines[0].facts.runningTotal, -3);

  const noahlessContext = { managers: managers([{ id: 1, personKey: "someone-else" }]) };
  assert.deepEqual(detectNoahTradeDesk(noahlessContext, tradeLedger), []);
});

test("beltWatch: returns nothing when there's no completed prior season to defend", () => {
  const context = { managers: managers([{ id: 1, personKey: "lu" }]), matches: [], finishedGws: [] };
  const replay = buildSeasonReplay(context);
  const history = { seasons: [{ isCurrent: true, championKey: "lu" }] }; // only the in-progress season on record
  assert.deepEqual(detectBeltWatch(context, replay, history), []);
});

test("beltWatch: the belt stays with the prior champion all season -- it does not flip week to week with the table leader", () => {
  const context = {
    managers: managers([
      { id: 1, personKey: "lu" },
      { id: 2, personKey: "david" },
    ]),
    // gw1: lu (not the belt holder) leads. gw2: david (the actual belt holder) leads.
    matches: [
      { event: 1, finished: true, homeManagerId: 1, awayManagerId: 2, homePoints: 50, awayPoints: 40 },
      { event: 2, finished: true, homeManagerId: 2, awayManagerId: 1, homePoints: 60, awayPoints: 30 },
    ],
    finishedGws: [1, 2],
  };
  const replay = buildSeasonReplay(context);
  const history = { seasons: [{ championKey: "david" }, { isCurrent: true, championKey: "lu" }] };
  const storylines = detectBeltWatch(context, replay, history);

  const inDanger = storylines.filter((s) => s.type === "belt-in-danger");
  // gw1: lu leads, not david (the holder) -> in danger. gw2: david leads, matches the holder -> no storyline.
  assert.equal(inDanger.length, 1);
  assert.equal(inDanger[0].gw, 1);
  assert.equal(inDanger[0].facts.beltHolderKey, "david");
  assert.equal(inDanger[0].facts.currentLeaderKey, "lu");
});

test("beltWatch: escalates weight sharply from GW30+", () => {
  const finishedGws = Array.from({ length: 31 }, (_, i) => i + 1);
  const matches = finishedGws.map((gw) => ({
    event: gw,
    finished: true,
    homeManagerId: 1,
    awayManagerId: 2,
    homePoints: 50,
    awayPoints: 40,
  }));
  const context = {
    managers: managers([
      { id: 1, personKey: "lu" },
      { id: 2, personKey: "david" },
    ]),
    matches,
    finishedGws,
  };
  const replay = buildSeasonReplay(context);
  const history = { seasons: [{ championKey: "david" }, { isCurrent: true }] };
  const storylines = detectBeltWatch(context, replay, history).filter((s) => s.type === "belt-in-danger");
  const early = storylines.find((s) => s.gw === 1);
  const late = storylines.find((s) => s.gw === 30);
  assert.ok(late.baseWeight > early.baseWeight);
});

test("beltWatch: resolves belt-retained when the prior holder wins again, belt-changed-hands otherwise", () => {
  const retainedContext = {
    managers: managers([
      { id: 1, personKey: "david" },
      { id: 2, personKey: "lu" },
    ]),
    matches: [{ event: 1, finished: true, homeManagerId: 1, awayManagerId: 2, homePoints: 60, awayPoints: 40 }],
    finishedGws: [1],
  };
  const retainedReplay = buildSeasonReplay(retainedContext);
  const history = { seasons: [{ championKey: "david" }, { isCurrent: true }] };
  const retainedStorylines = detectBeltWatch(retainedContext, retainedReplay, history);
  assert.ok(retainedStorylines.some((s) => s.type === "belt-retained"));
  assert.ok(!retainedStorylines.some((s) => s.type === "belt-changed-hands"));

  const changedContext = {
    managers: managers([
      { id: 1, personKey: "david" },
      { id: 2, personKey: "lu" },
    ]),
    matches: [{ event: 1, finished: true, homeManagerId: 1, awayManagerId: 2, homePoints: 40, awayPoints: 60 }],
    finishedGws: [1],
  };
  const changedReplay = buildSeasonReplay(changedContext);
  const changedStorylines = detectBeltWatch(changedContext, changedReplay, history);
  const changeStoryline = changedStorylines.find((s) => s.type === "belt-changed-hands");
  assert.ok(changeStoryline);
  assert.equal(changeStoryline.facts.beltHolderKey, "david");
  assert.equal(changeStoryline.facts.newChampionKey, "lu");
});

test("luPostMark: inert when the lore flag is unset", () => {
  const lore = loadLore({ people: [{ personKey: "lu" }] });
  const context = { managers: managers([{ id: 1, personKey: "lu" }]), matches: [], finishedGws: [] };
  const replay = buildSeasonReplay(context);
  assert.deepEqual(detectLuPostMark(context, replay, { log: [] }, lore), []);
});

test("luPostMark: tracks rank/trades and resolves won-the-belt when the flag is set and lu finishes 1st", () => {
  const lore = loadLore({ people: [{ personKey: "lu", flags: ["lu-post-mark-era"] }] });
  const context = {
    managers: managers([
      { id: 1, personKey: "lu" },
      { id: 2, personKey: "muk" },
    ]),
    matches: [{ event: 1, finished: true, homeManagerId: 1, awayManagerId: 2, homePoints: 50, awayPoints: 40 }],
    finishedGws: [1],
  };
  const replay = buildSeasonReplay(context);
  const tradeLedger = { log: [{ gw: 1, tradeId: 1, sides: [{ managerId: 1, netValue: -4 }] }] };
  const storylines = detectLuPostMark(context, replay, tradeLedger, lore);

  assert.ok(storylines.some((s) => s.type === "lu-post-mark-tracker" && s.facts.rank === 1));
  assert.ok(storylines.some((s) => s.type === "lu-post-mark-trade-scrutiny" && s.facts.netValue === -4));
  assert.ok(storylines.some((s) => s.type === "lu-post-mark-resolution-won"));
});

test("luPostMark: resolves eliminated once mathematically out of the race from GW25+", () => {
  const lore = loadLore({ people: [{ personKey: "lu", flags: ["lu-post-mark-era"] }] });
  const finishedGws = Array.from({ length: 25 }, (_, i) => i + 1);
  const matches = finishedGws.map((gw) => ({
    event: gw,
    finished: true,
    homeManagerId: 2,
    awayManagerId: 1,
    homePoints: 100,
    awayPoints: 0,
  }));
  const context = {
    managers: managers([
      { id: 1, personKey: "lu" },
      { id: 2, personKey: "muk" },
    ]),
    matches,
    finishedGws,
  };
  const replay = buildSeasonReplay(context);
  const storylines = detectLuPostMark(context, replay, { log: [] }, lore);
  const eliminated = storylines.filter((s) => s.type === "lu-post-mark-resolution-eliminated");
  assert.equal(eliminated.length, 1);
  assert.equal(eliminated[0].gw, 25);
});
