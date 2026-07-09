// Spec (commissioner-requested) — Historical Summary. Combines the hand-recorded
// past seasons (data/history-seasons.json) with the current live season (derived
// from context.standings, so it never needs manual re-entry), then computes the
// season-by-season honors list and an all-time leaderboard aggregated across
// every recorded season.
export function computeHistory(context, historySeasonsData, currentSeasonLabel) {
  const currentTable = [...context.standings]
    .sort((a, b) => a.rank - b.rank)
    .map((s) => {
      const m = context.managers.byId.get(s.managerId);
      return {
        rank: s.rank,
        team: m?.name,
        manager: m?.playerName,
        managerKey: m?.personKey,
        w: s.won,
        d: s.drawn,
        l: s.lost,
        plus: s.pointsFor,
        pts: s.total,
      };
    });
  const currentChampion = currentTable.find((r) => r.rank === 1);
  const currentSeason = {
    year: currentSeasonLabel,
    championKey: currentChampion?.managerKey,
    table: currentTable,
    isCurrent: true,
  };

  const seasons = [...historySeasonsData.seasons, currentSeason];

  const titleCounts = new Map();
  for (const season of seasons) {
    if (!season.championKey) continue;
    titleCounts.set(season.championKey, (titleCounts.get(season.championKey) ?? 0) + 1);
  }

  const agg = new Map();
  for (const season of seasons) {
    if (!season.table) continue;
    for (const row of season.table) {
      if (!row.managerKey) continue;
      if (!agg.has(row.managerKey)) {
        agg.set(row.managerKey, { managerKey: row.managerKey, seasons: 0, titles: 0, top3: 0, rankSum: 0, bestRank: Infinity });
      }
      const a = agg.get(row.managerKey);
      a.seasons++;
      a.rankSum += row.rank;
      if (row.rank <= 3) a.top3++;
      if (row.rank < a.bestRank) a.bestRank = row.rank;
    }
  }
  for (const [key, count] of titleCounts) {
    if (agg.has(key)) agg.get(key).titles = count;
  }

  const leaderboard = [...agg.values()]
    .map((a) => ({ ...a, avgRank: Math.round((a.rankSum / a.seasons) * 10) / 10 }))
    .sort((a, b) => b.titles - a.titles || a.avgRank - b.avgRank);

  return { seasons, titleCounts: Object.fromEntries(titleCounts), leaderboard };
}
