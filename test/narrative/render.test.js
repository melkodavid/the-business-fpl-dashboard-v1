import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadLore } from "../../scripts/narrative/lore.js";
import { renderStoryline, renderRecap } from "../../scripts/narrative/render.js";

const templates = JSON.parse(readFileSync(new URL("../../scripts/narrative/templates.json", import.meta.url)));

const context = {
  managers: {
    byId: new Map([
      [1, { personKey: "lu", playerName: "Lu Palladino" }],
      [2, { personKey: "muk", playerName: "Muk P" }],
    ]),
    list: [
      { id: 1, personKey: "lu", playerName: "Lu Palladino" },
      { id: 2, personKey: "muk", playerName: "Muk P" },
    ],
  },
};

const lore = loadLore({
  people: [
    { personKey: "lu", nicknames: ["Lu"] },
    { personKey: "muk", nicknames: ["Muk", "Marcus"] },
  ],
});

// One plausible, correctly-shaped storyline per templates.json key, matching
// exactly what each detector actually emits (facts + personKeys order) --
// proves every single template variant fills cleanly, not just the ones the
// other tests happen to exercise.
const canonicalStorylines = {
  streak: { personKeys: ["lu"], facts: { managerId: 1, streakType: "W", length: 4 } },
  "streak-break": { personKeys: ["lu"], facts: { managerId: 1, brokenLength: 5 } },
  "record-high-gw": { personKeys: ["lu"], facts: { managerId: 1, score: 120 } },
  "record-low-gw": { personKeys: ["lu"], facts: { managerId: 1, score: 12 } },
  "record-blowout": { personKeys: ["lu", "muk"], facts: { winnerId: 1, loserId: 2, margin: 60 } },
  "record-closest": { personKeys: ["lu", "muk"], facts: { winnerId: 1, loserId: 2, margin: 1 } },
  "record-low-win": { personKeys: ["lu"], facts: { managerId: 1, score: 30 } },
  "record-high-loss": { personKeys: ["lu"], facts: { managerId: 1, score: 90 } },
  "luck-robbery": { personKeys: ["lu"], facts: { managerId: 1, opponentId: 2 } },
  "luck-snakebit": { personKeys: ["lu"], facts: { managerId: 1, opponentId: 2 } },
  "lineup-bench-outscored": { personKeys: ["lu"], facts: { managerId: 1, benchPts: 80, starterPts: 60 } },
  "lineup-could-have-won": {
    personKeys: ["lu"],
    facts: { gw: 1, managerId: 1, opponentId: 2, actualScore: 50, optimalScore: 70, opponentScore: 60 },
  },
  "lineup-59-club": { personKeys: ["lu"], facts: { gw: 1, managerId: 1, elementId: 9, playerName: "Some Player", fixtureId: 1 } },
  "table-new-leader": { personKeys: ["lu", "muk"], facts: { newLeaderId: 1, previousLeaderId: 2 } },
  "table-enter-top4": { personKeys: ["lu"], facts: { managerId: 1, rank: 4 } },
  "table-exit-top4": { personKeys: ["lu"], facts: { managerId: 1, rank: 5 } },
  "table-eliminated": { personKeys: ["lu"], facts: { managerId: 1, maxPossible: 40, leaderTotal: 70 } },
  "trade-value-flip": { personKeys: ["lu"], facts: { managerId: 1, tradeId: 1, netValue: -5 } },
  "trade-ex-factor": { personKeys: ["lu", "muk"], facts: { oldManagerId: 1, opponentId: 2, elementId: 9, playerName: "Ex Player", points: 14 } },
  "trade-waiver-outscores-r1": { personKeys: ["lu"], facts: { managerId: 1, elementId: 9, playerName: "Waiver Guy", points: 22, bestRound1: 18 } },
  "family-brother-derby": {
    personKeys: ["lu", "muk"],
    facts: { homeManagerId: 1, awayManagerId: 2, homePoints: 50, awayPoints: 40, relation: "brother" },
  },
  "family-cousin-clash": {
    personKeys: ["lu", "muk"],
    facts: { homeManagerId: 1, awayManagerId: 2, homePoints: 50, awayPoints: 40, relation: "cousin" },
  },
  "gauntlet-watch": { personKeys: ["lu"], facts: { managerId: 1, startGw: 5, length: 3, opponentIds: [2] } },
  "gauntlet-progress": { personKeys: ["lu"], facts: { managerId: 1, wins: 1, played: 2, length: 3 } },
  "gauntlet-swept": { personKeys: ["lu"], facts: { managerId: 1, length: 3 } },
  "generation-sweep": { personKeys: ["lu", "muk"], facts: { generation: "01s", count: 2 } },
  "bridesmaid-leading": { personKeys: ["lu"], facts: { managerId: 1, gw: 1 } },
  "bridesmaid-costly-loss": { personKeys: ["lu"], facts: { managerId: 1, gw: 1, importance: 3.2 } },
  "noah-trade-desk-entered": { personKeys: ["lu"], facts: { tradeId: 1, netValue: 5 } },
  "noah-trade-desk-negative": { personKeys: ["lu"], facts: { tradeId: 1, netValue: -5, runningTotal: -3 } },
  "noah-trade-desk-running-total": { personKeys: ["lu"], facts: { runningTotal: -3 } },
  "belt-in-danger": { personKeys: ["lu", "muk"], facts: { beltHolderKey: "lu", currentLeaderKey: "muk", gw: 1 } },
  "belt-retained": { personKeys: ["lu"], facts: { beltHolderKey: "lu", newChampionKey: "lu" } },
  "belt-changed-hands": { personKeys: ["lu", "muk"], facts: { beltHolderKey: "lu", newChampionKey: "muk" } },
  "lu-post-mark-tracker": { personKeys: ["lu"], facts: { managerId: 1, rank: 2, total: 45 } },
  "lu-post-mark-trade-scrutiny": { personKeys: ["lu"], facts: { tradeId: 1, netValue: -5 } },
  "lu-post-mark-resolution-won": { personKeys: ["lu"], facts: { managerId: 1 } },
  "lu-post-mark-resolution-eliminated": { personKeys: ["lu"], facts: { managerId: 1, maxPossible: 40, leaderTotal: 70 } },
};

test("templates.json keys exactly match the canonical storyline types covered by this test", () => {
  const templateTypes = Object.keys(templates).filter((k) => k !== "_comment");
  assert.deepEqual(templateTypes.sort(), Object.keys(canonicalStorylines).sort());
});

for (const [type, partial] of Object.entries(canonicalStorylines)) {
  test(`${type}: every variant renders with no unfilled placeholder`, () => {
    const variants = templates[type];
    for (let variantAttempt = 0; variantAttempt < variants.length * 6; variantAttempt++) {
      // dedupeKey varies per attempt so the seeded variant picker cycles
      // through all of this type's variants rather than always landing on one.
      const storyline = { type, gw: 1 + variantAttempt, dedupeKey: `${type}:${variantAttempt}`, ...partial };
      const rendered = renderStoryline(storyline, context, lore, templates);
      assert.equal(typeof rendered, "string");
      assert.ok(!rendered.includes("{"), `unfilled placeholder in: "${rendered}"`);
      assert.ok(!rendered.includes("}"), `unfilled placeholder in: "${rendered}"`);
    }
  });
}

test("rendering the same storyline twice is deterministic (same variant, same nickname roll)", () => {
  const storyline = { type: "streak", gw: 7, dedupeKey: "streak:7", ...canonicalStorylines.streak };
  const first = renderStoryline(storyline, context, lore, templates);
  const second = renderStoryline(storyline, context, lore, templates);
  assert.equal(first, second);
});

test("renderRecap stores rendered text alongside the original structured facts", () => {
  const headline = { type: "streak", gw: 3, dedupeKey: "streak:3", score: 0, ...canonicalStorylines.streak };
  const selection = { gw: 3, headline, secondaries: [] };
  const recap = renderRecap(selection, context, lore, templates);
  assert.equal(recap.gw, 3);
  assert.equal(typeof recap.headline.text, "string");
  assert.deepEqual(recap.headline.facts, canonicalStorylines.streak.facts);
});

test("a manager with no nickname always renders their real name (0% roll, never throws)", () => {
  const context2 = {
    managers: {
      byId: new Map([[9, { personKey: "ibrahim", playerName: "Ibrahim Abdulnour" }]]),
      list: [{ id: 9, personKey: "ibrahim", playerName: "Ibrahim Abdulnour" }],
    },
  };
  const lore2 = loadLore({ people: [{ personKey: "ibrahim", nicknames: [] }] });
  const storyline = { type: "record-high-gw", gw: 1, dedupeKey: "x", personKeys: ["ibrahim"], facts: { managerId: 9, score: 100 } };
  const rendered = renderStoryline(storyline, context2, lore2, templates);
  assert.ok(rendered.includes("Ibrahim Abdulnour"));
});
