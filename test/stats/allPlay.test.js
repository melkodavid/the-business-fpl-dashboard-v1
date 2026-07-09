import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAllPlay } from "../../scripts/stats/allPlay.js";

// Small hand-built context: 4 managers, 2 gameweeks, exact scores chosen so the
// all-play win %, expected wins, and luck score can be checked by hand.
function makeContext() {
  const managers = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  return {
    managers: { list: managers, byId: new Map(managers.map((m) => [m.id, m])) },
    finishedGws: [1, 2],
    gwPicks: {
      1: {
        1: { totalPoints: 60 },
        2: { totalPoints: 50 },
        3: { totalPoints: 50 },
        4: { totalPoints: 40 },
      },
      2: {
        1: { totalPoints: 30 },
        2: { totalPoints: 70 },
        3: { totalPoints: 20 },
        4: { totalPoints: 45 },
      },
    },
    // H2H matches: GW1 1v2 (60-50, manager1 wins), 3v4 (50-40, manager3 wins)
    //              GW2 1v3 (30-20, manager1 wins), 2v4 (70-45, manager2 wins)
    matches: [
      { event: 1, homeManagerId: 1, homePoints: 60, awayManagerId: 2, awayPoints: 50, finished: true },
      { event: 1, homeManagerId: 3, homePoints: 50, awayManagerId: 4, awayPoints: 40, finished: true },
      { event: 2, homeManagerId: 1, homePoints: 30, awayManagerId: 3, awayPoints: 20, finished: true },
      { event: 2, homeManagerId: 2, homePoints: 70, awayManagerId: 4, awayPoints: 45, finished: true },
    ],
  };
}

test("all-play win % per GW, ties counted as 0.5", () => {
  const { perGw } = computeAllPlay(makeContext());
  // GW1: manager3 and manager2 both scored 50 -- a tie between them.
  const gw1Manager2 = perGw[1].find((r) => r.managerId === 2);
  const gw1Manager3 = perGw[1].find((r) => r.managerId === 3);
  // manager2 (50) beats manager4 (40), ties manager3 (50), loses to manager1 (60): (1+0.5)/3
  assert.equal(gw1Manager2.allPlayWinPct, 1.5 / 3);
  // manager3 (50) beats manager4 (40), ties manager2 (50), loses to manager1 (60): (1+0.5)/3
  assert.equal(gw1Manager3.allPlayWinPct, 1.5 / 3);
});

test("expected wins sums all-play win % across gameweeks, luck score = actual - expected", () => {
  const { standings } = computeAllPlay(makeContext());
  const manager1 = standings.find((s) => s.managerId === 1);

  // GW1: manager1 (60) beats everyone else (50,50,40) -> 3/3 = 1
  // GW2: manager1 (30) beats manager4(45)? no 30<45 loses; beats manager3(20) wins;
  //      vs manager2(70) loses. So beats 1 of 3 -> 1/3
  const expectedWins = 1 + 1 / 3;
  assert.ok(Math.abs(manager1.expectedWins - expectedWins) < 1e-9);

  // Actual wins from matches: manager1 won both their H2H matches (GW1 vs 2, GW2 vs 3) = 2
  assert.equal(manager1.actualWins, 2);
  assert.ok(Math.abs(manager1.luckScore - (2 - expectedWins)) < 1e-9);
});
