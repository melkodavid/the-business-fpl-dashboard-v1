import { test } from "node:test";
import assert from "node:assert/strict";
import { selectForGw, selectSeasonNarrative } from "../../scripts/narrative/select.js";

// Stakes multiplier short-circuits to 1 when replay.at() returns null, so a
// stub context/replay keeps these tests focused purely on rarity/freshness/
// magnitude -- the stakes formula itself is already covered by matchImportance
// (reused, not reimplemented) and the bridesmaids detector's tests.
const stubContext = { matches: [], finishedGws: [1, 2, 3] };
const stubReplay = { at: () => null };

function storyline(overrides) {
  return {
    type: "generic",
    personKeys: ["someone"],
    facts: {},
    baseWeight: 3,
    gw: 1,
    dedupeKey: "generic:1",
    ...overrides,
  };
}

test("the highest-scoring candidate becomes the headline, the rest sort into secondaries", () => {
  const candidates = [
    storyline({ dedupeKey: "a", baseWeight: 2 }),
    storyline({ dedupeKey: "b", baseWeight: 5 }),
    storyline({ dedupeKey: "c", baseWeight: 3 }),
  ];
  const { headline, secondaries } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  assert.equal(headline.dedupeKey, "b");
  assert.deepEqual(secondaries.map((s) => s.dedupeKey), ["c", "a"]);
});

test("secondaries are hard-capped at 5 even with more candidates available", () => {
  const candidates = Array.from({ length: 9 }, (_, i) => storyline({ dedupeKey: `s${i}`, baseWeight: 9 - i }));
  const { secondaries } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  assert.equal(secondaries.length, 5);
});

test("freshness penalty demotes a repeat headline: a fresh lower-weight type beats a stale higher-weight repeat", () => {
  const priorSelections = [{ gw: 1, type: "type-a", dedupeKey: "type-a:1", role: "headline" }];
  const candidates = [
    storyline({ type: "type-a", dedupeKey: "type-a:2", baseWeight: 10, gw: 2 }), // same type headlined last gw -> heavy penalty
    storyline({ type: "type-b", dedupeKey: "type-b:2", baseWeight: 5, gw: 2 }), // fresh, no penalty
  ];
  const { headline } = selectForGw(candidates, 2, stubContext, stubReplay, priorSelections, new Set());
  assert.equal(headline.type, "type-b");
});

test("magnitude scaling falls back to a neutral multiplier instead of corrupting the sort when a fact is missing", () => {
  // "streak" and "record-high-gw" have special-cased magnitude formulas that
  // read specific fact fields; a storyline missing those fields must not
  // produce NaN and break sort() ordering.
  const candidates = [
    storyline({ type: "streak", dedupeKey: "s1", baseWeight: 10, gw: 1, facts: {} }),
    storyline({ type: "generic", dedupeKey: "g1", baseWeight: 1, gw: 1 }),
  ];
  const { headline } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  assert.equal(headline.dedupeKey, "s1"); // still wins on baseWeight alone, not NaN-corrupted
});

test("a season-first storyline outranks an equal-weight repeat", () => {
  const seenDedupeKeys = new Set(["type-a:1"]); // this exact dedupeKey has already been selected once before
  const candidates = [
    storyline({ type: "type-a", dedupeKey: "type-a:1", baseWeight: 4, gw: 3 }), // repeat of an already-seen dedupeKey
    storyline({ type: "type-a", dedupeKey: "type-a:2", baseWeight: 4, gw: 3 }), // brand new dedupeKey, same type/weight
  ];
  const { headline } = selectForGw(candidates, 3, stubContext, stubReplay, [], seenDedupeKeys);
  assert.equal(headline.dedupeKey, "type-a:2");
});

test("selectSeasonNarrative is deterministic across repeated runs on the same input", () => {
  const allStorylines = [
    storyline({ dedupeKey: "a", gw: 1, baseWeight: 3 }),
    storyline({ dedupeKey: "b", gw: 1, baseWeight: 3 }), // tied weight -- exercises the seeded tiebreak
    storyline({ dedupeKey: "c", gw: 2, baseWeight: 4 }),
    storyline({ dedupeKey: "d", gw: 3, baseWeight: 2 }),
  ];
  const first = selectSeasonNarrative(allStorylines, stubContext, stubReplay);
  const second = selectSeasonNarrative(allStorylines, stubContext, stubReplay);
  assert.deepEqual(first, second);
});

test("every finished gw with at least one candidate gets a headline", () => {
  const allStorylines = stubContext.finishedGws.map((gw) => storyline({ dedupeKey: `x:${gw}`, gw }));
  const byGw = selectSeasonNarrative(allStorylines, stubContext, stubReplay);
  for (const gw of stubContext.finishedGws) {
    assert.ok(byGw[gw].headline, `gw ${gw} should have a headline`);
  }
});

test("a gw with no candidates gets a null headline and no secondaries, without throwing", () => {
  const byGw = selectSeasonNarrative([], stubContext, stubReplay);
  for (const gw of stubContext.finishedGws) {
    assert.equal(byGw[gw].headline, null);
    assert.deepEqual(byGw[gw].secondaries, []);
  }
});
