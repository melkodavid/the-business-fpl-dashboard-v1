import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSeasonArcs } from "../../scripts/narrative/seasonArcs.js";

test("a gauntlet run that finished without a sweep (played === length, wins > 0) is not reported as active", () => {
  const storylines = [
    { type: "gauntlet-watch", personKeys: ["pat"], facts: { managerId: 1, startGw: 30, length: 4 }, gw: 29, dedupeKey: "gauntlet-watch:1:30" },
    { type: "gauntlet-progress", personKeys: ["pat"], facts: { managerId: 1, wins: 0, played: 1, length: 4 }, gw: 30, dedupeKey: "gauntlet-progress:1:30:1" },
    { type: "gauntlet-progress", personKeys: ["pat"], facts: { managerId: 1, wins: 1, played: 4, length: 4 }, gw: 33, dedupeKey: "gauntlet-progress:1:30:4" },
  ];
  const arcs = computeSeasonArcs(storylines, {}, () => ({ wins: 0, draws: 0, losses: 0 }));
  assert.equal(arcs.gauntletWatch, null);
});

test("an in-progress gauntlet run (played < length) is reported as active with the latest facts", () => {
  const storylines = [
    { type: "gauntlet-watch", personKeys: ["pat"], facts: { managerId: 1, startGw: 30, length: 4 }, gw: 29, dedupeKey: "gauntlet-watch:1:30" },
    { type: "gauntlet-progress", personKeys: ["pat"], facts: { managerId: 1, wins: 1, played: 2, length: 4 }, gw: 31, dedupeKey: "gauntlet-progress:1:30:2" },
  ];
  const arcs = computeSeasonArcs(storylines, {}, () => ({ wins: 0, draws: 0, losses: 0 }));
  assert.equal(arcs.gauntletWatch.type, "gauntlet-progress");
  assert.equal(arcs.gauntletWatch.facts.played, 2);
});

test("a swept run is not reported as active", () => {
  const storylines = [
    { type: "gauntlet-progress", personKeys: ["pat"], facts: { managerId: 1, wins: 0, played: 3, length: 3 }, gw: 32, dedupeKey: "gauntlet-progress:1:30:3" },
    { type: "gauntlet-swept", personKeys: ["pat"], facts: { managerId: 1, length: 3 }, gw: 32, dedupeKey: "gauntlet-swept:1:30" },
  ];
  const arcs = computeSeasonArcs(storylines, {}, () => ({ wins: 0, draws: 0, losses: 0 }));
  assert.equal(arcs.gauntletWatch, null);
});

test("generationWar is null when the matrix is empty, otherwise includes the matrix and 01s summary", () => {
  const empty = computeSeasonArcs([], {}, () => ({ wins: 0, draws: 0, losses: 0 }));
  assert.equal(empty.generationWar, null);

  const matrix = { "01s|97s": { wins: 5, draws: 0, losses: 2 } };
  const withData = computeSeasonArcs([], matrix, (m) => ({ wins: 5, draws: 0, losses: 2 }));
  assert.deepEqual(withData.generationWar, { matrix, oneOhOnesVsRest: { wins: 5, draws: 0, losses: 2 } });
});

test("lifeAfterMark is null when no lu-post-mark storylines exist", () => {
  const arcs = computeSeasonArcs([], {}, () => ({ wins: 0, draws: 0, losses: 0 }));
  assert.equal(arcs.lifeAfterMark, null);
});

test("lifeAfterMark surfaces the most recent lu-post-mark storyline", () => {
  const storylines = [
    { type: "lu-post-mark-tracker", personKeys: ["lu"], facts: { managerId: 1, rank: 3 }, gw: 10, dedupeKey: "x" },
    { type: "lu-post-mark-tracker", personKeys: ["lu"], facts: { managerId: 1, rank: 1 }, gw: 20, dedupeKey: "x" },
  ];
  const arcs = computeSeasonArcs(storylines, {}, () => ({ wins: 0, draws: 0, losses: 0 }));
  assert.equal(arcs.lifeAfterMark.gw, 20);
  assert.equal(arcs.lifeAfterMark.facts.rank, 1);
});
