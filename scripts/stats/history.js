// Spec (commissioner-requested) — Historical Summary. Combines the hand-recorded
// past seasons (data/history-seasons.json) with the current live season (derived
// from context.standings, so it never needs manual re-entry), then computes the
// season-by-season honors list (with each championship's running star count) and
// an all-time leaderboard aggregated across every recorded season.
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

  // Running title tally, attached per-season as championTitleNumber so the
  // honors list can show the star count as it stood *that year* (1 star for
  // a first title, 2 for a second, etc.) rather than everyone's current total.
  const titleCounts = new Map();
  for (const season of seasons) {
    if (!season.championKey) continue;
    const count = (titleCounts.get(season.championKey) ?? 0) + 1;
    titleCounts.set(season.championKey, count);
    season.championTitleNumber = count;
  }

  const agg = new Map();
  for (const season of seasons) {
    if (!season.table) continue;
    const seasonSize = season.table.length;
    for (const row of season.table) {
      if (!row.managerKey) continue;
      if (!agg.has(row.managerKey)) {
        agg.set(row.managerKey, {
          managerKey: row.managerKey,
          displayName: null,
          seasons: 0,
          titles: 0,
          top4: 0,
          bottom3: 0,
          lastPlace: 0,
          rankSum: 0,
          bestRank: Infinity,
          pointsForSum: 0,
          pointsSum: 0,
          wSum: 0,
          dSum: 0,
          lSum: 0,
        });
      }
      const a = agg.get(row.managerKey);
      // Properly-cased name as recorded in the table (e.g. "SB", "Lu"), kept
      // so managers no longer in the current roster still display correctly
      // capitalized instead of falling back to their raw lowercase personKey.
      if (!a.displayName && row.manager) a.displayName = row.manager;
      a.seasons++;
      a.rankSum += row.rank;
      a.pointsForSum += row.plus ?? 0;
      a.pointsSum += row.pts ?? 0;
      a.wSum += row.w ?? 0;
      a.dSum += row.d ?? 0;
      a.lSum += row.l ?? 0;
      if (row.rank <= 4) a.top4++;
      if (row.rank > seasonSize - 3) a.bottom3++;
      if (row.rank === seasonSize) a.lastPlace++;
      if (row.rank < a.bestRank) a.bestRank = row.rank;
    }
  }
  for (const [key, count] of titleCounts) {
    if (agg.has(key)) agg.get(key).titles = count;
  }

  const leaderboard = [...agg.values()]
    .map((a) => ({ ...a, avgRank: Math.round((a.rankSum / a.seasons) * 10) / 10 }))
    .sort((a, b) => b.titles - a.titles || a.avgRank - b.avgRank);

  const mostLastPlace = [...agg.values()]
    .filter((a) => a.lastPlace > 0)
    .sort((a, b) => b.lastPlace - a.lastPlace);

  // Combined career table -- one row per person, summing their W/D/L, points
  // for, and total league points across every season they've played, however
  // many that is (a single-season player still gets a row, just with seasons: 1).
  const allTimeTable = [...agg.values()]
    .map((a) => ({
      managerKey: a.managerKey,
      displayName: a.displayName,
      seasons: a.seasons,
      titles: a.titles,
      w: a.wSum,
      d: a.dSum,
      l: a.lSum,
      pointsFor: a.pointsForSum,
      points: a.pointsSum,
    }))
    .sort((a, b) => b.points - a.points);

  return {
    seasons,
    titleCounts: Object.fromEntries(titleCounts),
    leaderboard,
    mostLastPlace,
    allTimeTable,
  };
}
