import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tierForRank, buildSeasonCards, buildCareerCards, cardsByManager } from "../../js/lib/cardTiers.js";

test("tierForRank: champion is legendary, top 4 is rare, last place is spoon, everything else is common", () => {
  assert.equal(tierForRank(1, 12), "legendary");
  assert.equal(tierForRank(2, 12), "rare");
  assert.equal(tierForRank(4, 12), "rare");
  assert.equal(tierForRank(5, 12), "common");
  assert.equal(tierForRank(11, 12), "common");
  assert.equal(tierForRank(12, 12), "spoon");
});

test("tierForRank: last place is relative to that season's own team count, never hardcoded", () => {
  assert.equal(tierForRank(10, 10), "spoon");
  assert.equal(tierForRank(10, 12), "common"); // 10th of 12 isn't last place
  assert.equal(tierForRank(14, 14), "spoon");
});

const fixtureHistory = {
  seasons: [
    { year: "17/18", championKey: "sam", table: null }, // no per-manager table on record
    {
      year: "18/19",
      championKey: "a",
      table: [
        { rank: 1, team: "Team A", manager: "A", managerKey: "a", w: 10, d: 0, l: 0, plus: 500, pts: 30 },
        { rank: 2, team: "Team B", manager: "B", managerKey: "b", w: 5, d: 0, l: 5, plus: 400, pts: 15 },
        { rank: 3, team: "Team C", manager: "C", managerKey: "c", w: 0, d: 0, l: 10, plus: 300, pts: 0 },
      ],
    },
  ],
  leaderboard: [
    { managerKey: "a", displayName: "A", seasons: 1, titles: 1, top4: 1, bottom3: 0, lastPlace: 0, bestRank: 1, avgRank: 1 },
  ],
  allTimeTable: [
    { managerKey: "a", displayName: "A", seasons: 1, titles: 1, w: 10, d: 0, l: 0, wlDiff: 10, winPct: 100, pointsFor: 500, points: 30 },
  ],
};

test("buildSeasonCards: skips the season with no table, tags the rest with the right tier", () => {
  const cards = buildSeasonCards(fixtureHistory);
  assert.equal(cards.length, 3); // 17/18 excluded, 18/19's 3 rows included
  assert.ok(cards.every((c) => c.year !== "17/18"));

  const a = cards.find((c) => c.managerKey === "a");
  assert.equal(a.tier, "legendary");
  const b = cards.find((c) => c.managerKey === "b");
  assert.equal(b.tier, "rare"); // rank 2 of 3 still satisfies "top 4"
  const c = cards.find((c) => c.managerKey === "c");
  assert.equal(c.tier, "spoon"); // last of 3
});

test("buildCareerCards: merges leaderboard + allTimeTable by managerKey", () => {
  const cards = buildCareerCards(fixtureHistory);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].managerKey, "a");
  assert.equal(cards[0].titles, 1);
  assert.equal(cards[0].winPct, 100);
  assert.equal(cards[0].pointsFor, 500);
});

test("buildCareerCards: tolerates a leaderboard entry missing from allTimeTable", () => {
  const partial = {
    leaderboard: [{ managerKey: "ghost", displayName: "Ghost", seasons: 1, titles: 0, top4: 0, bottom3: 0, lastPlace: 0, bestRank: 5, avgRank: 5 }],
    allTimeTable: [],
  };
  const cards = buildCareerCards(partial);
  assert.equal(cards[0].w, 0);
  assert.equal(cards[0].winPct, 0);
});

test("cardsByManager: groups by managerKey, sorted ascending by year", () => {
  const seasonCards = [
    { managerKey: "a", year: "20/21" },
    { managerKey: "a", year: "18/19" },
    { managerKey: "b", year: "19/20" },
  ];
  const grouped = cardsByManager(seasonCards);
  assert.deepEqual(grouped.get("a").map((c) => c.year), ["18/19", "20/21"]);
  assert.deepEqual(grouped.get("b").map((c) => c.year), ["19/20"]);
});

test("against the real committed data/history.json: every season card has a valid tier, and card counts add up", () => {
  const history = JSON.parse(readFileSync(new URL("../../data/history.json", import.meta.url)));
  const seasonCards = buildSeasonCards(history);
  const careerCards = buildCareerCards(history);

  const seasonsWithTables = history.seasons.filter((s) => s.table).length;
  const expectedSeasonCardCount = history.seasons.filter((s) => s.table).reduce((sum, s) => sum + s.table.length, 0);
  assert.equal(seasonCards.length, expectedSeasonCardCount);
  assert.ok(seasonsWithTables > 0);

  const validTiers = new Set(["legendary", "rare", "common", "spoon"]);
  for (const card of seasonCards) assert.ok(validTiers.has(card.tier), `invalid tier "${card.tier}" for ${card.managerKey} ${card.year}`);

  assert.equal(careerCards.length, history.leaderboard.length);

  const grouped = cardsByManager(seasonCards);
  for (const [managerKey, cards] of grouped) {
    const years = cards.map((c) => c.year);
    assert.deepEqual(years, [...years].sort(), `binder for ${managerKey} not chronological`);
  }
});
