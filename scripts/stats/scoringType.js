import { pointsBreakdown } from "../lib/scoring.js";

// Spec §6 — Points by Scoring Type. Starting XI only, summed across the season.
export function computeScoringType(context) {
  const totals = new Map(
    context.managers.list.map((m) => [
      m.id,
      { goals: 0, assists: 0, cleanSheets: 0, defensiveContribution: 0, bonus: 0, cardsLost: 0 },
    ])
  );

  for (const gw of context.finishedGws) {
    for (const manager of context.managers.list) {
      const picks = context.gwPicks[gw]?.[manager.id];
      if (!picks) continue;
      const bucket = totals.get(manager.id);

      for (const elementId of picks.starters) {
        const stats = context.gwPlayerStats[gw]?.[elementId];
        if (!stats) continue;
        const player = context.players.byId.get(elementId);
        const breakdown = pointsBreakdown(player.elementType, stats);
        bucket.goals += breakdown.goals;
        bucket.assists += breakdown.assists;
        bucket.cleanSheets += breakdown.cleanSheets;
        bucket.defensiveContribution += breakdown.defensiveContribution;
        bucket.bonus += breakdown.bonus;
        bucket.cardsLost += breakdown.cardsLost;
      }
    }
  }

  const perManager = context.managers.list.map((m) => ({
    managerId: m.id,
    managerName: m.name,
    ...totals.get(m.id),
  }));

  return { perManager };
}
