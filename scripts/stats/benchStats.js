import { benchPointsForGw } from "../lib/benchPoints.js";
import { computeOptimalXI } from "../lib/optimalXI.js";

// Spec §8 — Bench Stats: points left on the bench, and the "Could Have Won"
// simplified win/loss counter (flips only, not a point-delta — that fuller
// version is parked for v2 per spec).
export function computeBenchStats(context) {
  const perGw = {};
  const seasonTotals = new Map(context.managers.list.map((m) => [m.id, 0]));

  for (const gw of context.finishedGws) {
    perGw[gw] = {};
    for (const manager of context.managers.list) {
      const pts = benchPointsForGw(context, gw, manager.id);
      perGw[gw][manager.id] = pts;
      seasonTotals.set(manager.id, seasonTotals.get(manager.id) + pts);
    }
  }

  const couldHaveWonCounts = new Map(context.managers.list.map((m) => [m.id, 0]));
  const eligibleCounts = new Map(context.managers.list.map((m) => [m.id, 0]));
  const instances = [];

  for (const m of context.matches) {
    if (!m.finished) continue;
    const pairs = [
      { managerId: m.homeManagerId, own: m.homePoints, opponentId: m.awayManagerId, opponent: m.awayPoints },
      { managerId: m.awayManagerId, own: m.awayPoints, opponentId: m.homeManagerId, opponent: m.homePoints },
    ];

    for (const { managerId, own, opponentId, opponent } of pairs) {
      if (own > opponent) continue; // only losses or draws are eligible

      const picks = context.gwPicks[m.event]?.[managerId];
      if (!picks) continue;

      const roster = [...picks.starters, ...picks.bench].map((elementId) => ({
        elementId,
        elementType: context.players.byId.get(elementId).elementType,
        points: context.gwPlayerStats[m.event]?.[elementId]?.totalPoints ?? 0,
      }));

      const optimal = computeOptimalXI(roster);
      if (!optimal) continue;

      eligibleCounts.set(managerId, eligibleCounts.get(managerId) + 1);
      const wouldHaveWon = optimal.points > opponent;
      if (wouldHaveWon) {
        couldHaveWonCounts.set(managerId, couldHaveWonCounts.get(managerId) + 1);
        instances.push({ gw: m.event, managerId, opponentId, actualScore: own, optimalScore: optimal.points, opponentScore: opponent });
      }
    }
  }

  const perManager = context.managers.list.map((m) => ({
    managerId: m.id,
    managerName: m.name,
    benchPointsWasted: seasonTotals.get(m.id),
    couldHaveWonCount: couldHaveWonCounts.get(m.id),
    eligibleLossesOrDraws: eligibleCounts.get(m.id),
  }));

  return { perGw, perManager, couldHaveWonInstances: instances };
}
