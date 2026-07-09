import { test } from "node:test";
import assert from "node:assert/strict";
import { computeOptimalXI } from "../../scripts/lib/optimalXI.js";

function player(elementId, elementType, points) {
  return { elementId, elementType, points };
}

test("picks the highest-scoring valid formation from a full squad", () => {
  const roster = [
    player(1, 1, 6), player(2, 1, 2), // 2 GKP
    player(3, 2, 10), player(4, 2, 8), player(5, 2, 6), player(6, 2, 4), player(7, 2, 1), // 5 DEF
    player(8, 3, 12), player(9, 3, 9), player(10, 3, 7), player(11, 3, 5), player(12, 3, 2), // 5 MID
    player(13, 4, 11), player(14, 4, 3), player(15, 4, 1), // 3 FWD
  ];

  const result = computeOptimalXI(roster);

  // Best GK (6) + best 5 DEF within a valid combo + best MID/FWD combo.
  // Try every valid (def,mid,fwd) combo by hand to confirm the true max:
  // (3,5,2): 10+8+6 + 12+9+7+5+2 + 11+3 = 24+35+14 = 73 (+GK 6) = 79
  // (4,5,1): 10+8+6+4 + 12+9+7+5+2 + 11 = 28+35+11 = 74 (+6) = 80
  // (5,4,1): 10+8+6+4+1 + 12+9+7+5 + 11 = 29+33+11 = 73 (+6) = 79
  // (4,4,2): 28 + 12+9+7+5 + 11+3 = 28+33+14=75 (+6)=81
  // (5,3,2): 29 + 12+9+7 + 11+3 = 29+28+14=71(+6)=77
  // (3,4,3): 24 + 33 + 11+3+1=15 = 72 (+6) = 78
  // (5,2,3): 29 + 12+9=21 + 15 = 65(+6)=71
  // (4,3,3): 28+28+15=71(+6)=77
  // (3,3,4)-invalid fwd max 3
  // best so far 81 via (4,4,2)
  assert.equal(result.points, 81);
  assert.equal(result.starters.length, 11);
});

test("returns null when there is no goalkeeper available", () => {
  const roster = [
    player(3, 2, 10), player(4, 2, 8), player(5, 2, 6),
    player(8, 3, 12), player(9, 3, 9),
    player(13, 4, 11),
  ];
  assert.equal(computeOptimalXI(roster), null);
});

test("returns null when outfield positions can't fill any valid combo", () => {
  // Only 1 GK, 2 DEF, 1 MID, 0 FWD -- FWD range is 1-3, so no valid combo exists.
  const roster = [player(1, 1, 5), player(2, 2, 4), player(3, 2, 3), player(4, 3, 2)];
  assert.equal(computeOptimalXI(roster), null);
});

test("respects the DEF/MID/FWD boundary combo (5-2-3, formation edge)", () => {
  // Force a squad where only the 5-DEF/2-MID/3-FWD combo is available (fewer
  // than 3 MID players in the pool at all), to confirm boundary combos work.
  const roster = [
    player(1, 1, 1),
    player(2, 2, 9), player(3, 2, 8), player(4, 2, 7), player(5, 2, 6), player(6, 2, 5),
    player(7, 3, 10), player(8, 3, 9),
    player(9, 4, 6), player(10, 4, 5), player(11, 4, 4),
  ];
  const result = computeOptimalXI(roster);
  // Only one valid combo possible here: 5 DEF + 2 MID + 3 FWD (11 players total).
  assert.equal(result.points, 1 + (9 + 8 + 7 + 6 + 5) + (10 + 9) + (6 + 5 + 4));
  assert.equal(result.starters.length, 11);
});
