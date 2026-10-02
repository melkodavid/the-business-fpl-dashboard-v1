import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHistory } from "../../scripts/stats/history.js";

function buildContext(allFinished) {
  const managers = [
    { id: 1, personKey: "aa", name: "A FC", playerName: "Aa" },
    { id: 2, personKey: "bb", name: "B FC", playerName: "Bb" },
    { id: 3, personKey: "cc", name: "C FC", playerName: "Cc" },
    { id: 4, personKey: "dd", name: "D FC", playerName: "Dd" },
  ];
  return {
    managers: { byId: new Map(managers.map((m) => [m.id, m])) },
    standings: managers.map((m, i) => ({
      managerId: m.id, rank: i + 1, won: 4 - i, drawn: 0, lost: i, pointsFor: 100 - i, total: (4 - i) * 3,
    })),
    matches: [
      { event: 1, finished: true },
      { event: 2, finished: allFinished },
    ],
  };
}

const noHistory = { seasons: [] };

test("history: the in-progress season never counts toward top-4 / bottom-3 / last-place tallies, but still counts as a season played", () => {
  const history = computeHistory(buildContext(false), noHistory, "26/27");
  const dd = history.leaderboard.find((r) => r.managerKey === "dd");
  assert.equal(dd.lastPlace, 0);
  assert.equal(dd.bottom3, 0);
  assert.equal(history.leaderboard.find((r) => r.managerKey === "aa").top4, 0);
  assert.equal(dd.seasons, 1);
  assert.equal(history.mostLastPlace.length, 0);
});

test("history: once every fixture is finished the final table does count", () => {
  const history = computeHistory(buildContext(true), noHistory, "26/27");
  assert.equal(history.leaderboard.find((r) => r.managerKey === "dd").lastPlace, 1);
  assert.equal(history.mostLastPlace[0].managerKey, "dd");
  assert.equal(history.leaderboard.find((r) => r.managerKey === "aa").top4, 1);
});
