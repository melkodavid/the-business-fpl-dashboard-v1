// Best-possible starting XI from a full roster (starters + bench) for a single
// gameweek, respecting standard Draft/FPL formation rules: 1 GK, DEF 3-5,
// MID 2-5, FWD 1-3, 10 outfield total.
//
// For a *fixed* count of DEF/MID/FWD, the optimal selection at each position is
// just its top-N scorers — independent of the other positions — so the only
// search needed is over the (small) set of valid (DEF, MID, FWD) count combos.

const DEF_RANGE = [3, 4, 5];
const MID_RANGE = [2, 3, 4, 5];
const FWD_RANGE = [1, 2, 3];

function validCombos() {
  const combos = [];
  for (const def of DEF_RANGE) {
    for (const mid of MID_RANGE) {
      for (const fwd of FWD_RANGE) {
        if (def + mid + fwd === 10) combos.push({ def, mid, fwd });
      }
    }
  }
  return combos;
}
const VALID_COMBOS = validCombos();

function topNSum(sortedDesc, n) {
  return sortedDesc.slice(0, n).reduce((sum, p) => sum + p.points, 0);
}

/**
 * @param {Array<{elementId:number, elementType:1|2|3|4, points:number}>} roster
 * @returns {{points:number, starters:number[]} | null} null if the roster can't
 *   fill a legal formation (e.g. fewer than 1 GK, or fewer than 3+2+1 outfield
 *   players of the right positions available).
 */
export function computeOptimalXI(roster) {
  const byType = { 1: [], 2: [], 3: [], 4: [] };
  for (const p of roster) byType[p.elementType].push(p);
  for (const t of [1, 2, 3, 4]) byType[t].sort((a, b) => b.points - a.points);

  if (byType[1].length < 1) return null;
  const gk = byType[1][0];
  const gkPoints = gk.points;

  let best = null;
  for (const combo of VALID_COMBOS) {
    if (byType[2].length < combo.def || byType[3].length < combo.mid || byType[4].length < combo.fwd) continue;
    const points =
      gkPoints + topNSum(byType[2], combo.def) + topNSum(byType[3], combo.mid) + topNSum(byType[4], combo.fwd);
    if (!best || points > best.points) {
      best = {
        points,
        starters: [
          gk.elementId,
          ...byType[2].slice(0, combo.def).map((p) => p.elementId),
          ...byType[3].slice(0, combo.mid).map((p) => p.elementId),
          ...byType[4].slice(0, combo.fwd).map((p) => p.elementId),
        ],
      };
    }
  }
  return best;
}
