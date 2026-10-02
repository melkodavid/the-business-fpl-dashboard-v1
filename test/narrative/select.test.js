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
    storyline({ type: "t-a", personKeys: ["p1"], dedupeKey: "a", baseWeight: 2 }),
    storyline({ type: "t-b", personKeys: ["p2"], dedupeKey: "b", baseWeight: 5 }),
    storyline({ type: "t-c", personKeys: ["p3"], dedupeKey: "c", baseWeight: 3 }),
  ];
  const { headline, secondaries } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  assert.equal(headline.dedupeKey, "b");
  assert.deepEqual(secondaries.map((s) => s.dedupeKey), ["c", "a"]);
});

test("secondaries are hard-capped at 5 even with more candidates available", () => {
  const candidates = Array.from({ length: 9 }, (_, i) =>
    storyline({ type: `t-${i}`, personKeys: [`p${i}`], dedupeKey: `s${i}`, baseWeight: 9 - i })
  );
  const { secondaries } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  assert.equal(secondaries.length, 5);
});

test("a single recap never carries more than 2 lines of one type (headline included)", () => {
  const candidates = Array.from({ length: 5 }, (_, i) =>
    storyline({ type: "streak", personKeys: [`p${i}`], dedupeKey: `s${i}`, baseWeight: 9 - i, facts: { length: 3 } })
  );
  const { headline, secondaries } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  assert.equal([headline, ...secondaries].filter((s) => s.type === "streak").length, 2);
});

test("gauntlet-watch and season-high records are limited to one per recap", () => {
  const candidates = [
    storyline({ type: "record-high-gw", personKeys: ["a"], dedupeKey: "h1", baseWeight: 9 }),
    storyline({ type: "record-high-gw", personKeys: ["b"], dedupeKey: "h2", baseWeight: 8 }),
    storyline({ type: "gauntlet-watch", personKeys: ["c"], dedupeKey: "w1", baseWeight: 7 }),
    storyline({ type: "gauntlet-watch", personKeys: ["d"], dedupeKey: "w2", baseWeight: 6 }),
  ];
  const { headline, secondaries } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  const all = [headline, ...secondaries];
  assert.equal(all.filter((s) => s.type === "record-high-gw").length, 1);
  assert.equal(all.filter((s) => s.type === "gauntlet-watch").length, 1);
});

test("one person can't dominate a recap: at most 2 lines about the same person", () => {
  const candidates = ["t1", "t2", "t3", "t4"].map((type, i) =>
    storyline({ type, personKeys: ["noah"], dedupeKey: `n${i}`, baseWeight: 9 - i })
  );
  candidates.push(storyline({ type: "t5", personKeys: ["other"], dedupeKey: "o", baseWeight: 1 }));
  const { headline, secondaries } = selectForGw(candidates, 1, stubContext, stubReplay, [], new Set());
  const all = [headline, ...secondaries];
  assert.equal(all.filter((s) => s.personKeys.includes("noah")).length, 2);
  assert.ok(all.some((s) => s.type === "t5"));
});

test("the same type about the same people is skipped as a secondary for a couple of recaps", () => {
  const prior = [{ gw: 2, type: "streak", dedupeKey: "old", role: "secondary", subject: "streak|david" }];
  const candidates = [
    storyline({ type: "t-head", personKeys: ["x"], dedupeKey: "head", baseWeight: 9, gw: 3 }),
    storyline({ type: "streak", personKeys: ["david"], dedupeKey: "s-david", baseWeight: 5, gw: 3 }),
    storyline({ type: "streak", personKeys: ["noah"], dedupeKey: "s-noah", baseWeight: 4, gw: 3 }),
  ];
  const { secondaries } = selectForGw(candidates, 3, stubContext, stubReplay, prior, new Set());
  assert.deepEqual(secondaries.map((s) => s.dedupeKey), ["s-noah"]);
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
