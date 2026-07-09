// Spec §7 — the 59 Club. Per fixture, not per GW total: a starter who played
// exactly 59 minutes in one of their (possibly two, in a DGW) fixtures counts
// once for that fixture. Display is occurrence-only (no standing leaderboard
// per spec), but a season total is still emitted for completeness.
export function computeFiftyNineClub(context) {
  const instances = [];

  for (const gw of context.finishedGws) {
    for (const manager of context.managers.list) {
      const picks = context.gwPicks[gw]?.[manager.id];
      if (!picks) continue;

      for (const elementId of picks.starters) {
        const stats = context.gwPlayerStats[gw]?.[elementId];
        if (!stats) continue;
        for (const fixture of stats.fixtures) {
          if (fixture.minutes === 59) {
            instances.push({
              gw,
              managerId: manager.id,
              elementId,
              playerName: context.players.byId.get(elementId)?.webName,
              fixtureId: fixture.fixtureId,
            });
          }
        }
      }
    }
  }

  const seasonTotals = new Map(context.managers.list.map((m) => [m.id, 0]));
  for (const inst of instances) seasonTotals.set(inst.managerId, seasonTotals.get(inst.managerId) + 1);

  return {
    instances,
    seasonTotals: [...seasonTotals.entries()].map(([managerId, count]) => ({ managerId, count })),
  };
}
