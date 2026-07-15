// Pure card-data derivation from data/history.json -- no DOM, no `managers`
// dependency, so this stays unit-testable against raw history fixtures and
// reusable anywhere a manager's card data is needed (Cards page, and any
// future "my card" teaser elsewhere) without duplicating the tier math.
export function tierForRank(rank, seasonSize) {
  if (rank === 1) return "legendary";
  // Checked before the top-4 rule: in a season with 4 or fewer teams, last
  // place would otherwise also satisfy "rank <= 4" and never get flagged.
  if (rank === seasonSize) return "spoon";
  if (rank <= 4) return "rare";
  return "common";
}

// One card per manager per season, skipping any season with no per-manager
// table on record (the league's first season, 17/18, has only a championKey).
// Tier is always computed against that season's own team count -- it's
// varied across the league's history (10/12/14 teams), never hardcode 12.
export function buildSeasonCards(history) {
  const cards = [];
  for (const season of history.seasons) {
    if (!season.table) continue;
    const seasonSize = season.table.length;
    for (const row of season.table) {
      cards.push({
        managerKey: row.managerKey,
        year: season.year,
        isCurrent: Boolean(season.isCurrent),
        tier: tierForRank(row.rank, seasonSize),
        rank: row.rank,
        team: row.team,
        manager: row.manager,
        w: row.w,
        d: row.d,
        l: row.l,
        plus: row.plus,
        pts: row.pts,
      });
    }
  }
  return cards;
}

// One Career Card per manager, merging the season-aggregate leaderboard with
// the combined-record all-time table (each carries fields the other doesn't).
export function buildCareerCards(history) {
  const allTimeByKey = new Map(history.allTimeTable.map((r) => [r.managerKey, r]));
  return history.leaderboard.map((lb) => {
    const at = allTimeByKey.get(lb.managerKey);
    return {
      managerKey: lb.managerKey,
      displayName: lb.displayName,
      seasons: lb.seasons,
      titles: lb.titles,
      top4: lb.top4,
      bottom3: lb.bottom3,
      lastPlace: lb.lastPlace,
      bestRank: lb.bestRank,
      avgRank: lb.avgRank,
      w: at?.w ?? 0,
      d: at?.d ?? 0,
      l: at?.l ?? 0,
      winPct: at?.winPct ?? 0,
      pointsFor: at?.pointsFor ?? 0,
      points: at?.points ?? 0,
    };
  });
}

// Map<managerKey, seasonCard[]>, ascending by year -- feeds the binder strip.
export function cardsByManager(seasonCards) {
  const map = new Map();
  for (const card of [...seasonCards].sort((a, b) => a.year.localeCompare(b.year))) {
    if (!map.has(card.managerKey)) map.set(card.managerKey, []);
    map.get(card.managerKey).push(card);
  }
  return map;
}
