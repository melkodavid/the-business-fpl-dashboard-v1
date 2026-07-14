// LORE-DRIVEN — "the Belt" is the league's title (see templates.json/render.js
// for the presentational vocabulary), and it is held by ONE person all season:
// whoever won the most recently completed PRIOR season. It does NOT change
// hands week to week just because the in-progress table has a new leader --
// the current table leader is merely "on track", not "carrying the belt".
// The belt only actually changes hands (or is retained) once THIS season
// itself concludes and crowns its own champion. Reads history.json's
// already-computed seasons list rather than duplicating title data (per the
// brief: "Title data: read from history.json, do NOT duplicate titles in lore").
//
// The anth-belt-photos flag doesn't need its own detector output -- it's a
// template-level flourish added when rendering an existing
// table-enter-top4/table-exit-top4 storyline for personKey "anthony".
export function detectBeltWatch(context, replay, history) {
  const storylines = [];

  const seasons = history.seasons;
  const priorSeason = seasons.length >= 2 ? seasons[seasons.length - 2] : null;
  const beltHolderKey = priorSeason?.championKey ?? null;
  if (!beltHolderKey) return storylines; // no completed prior season on record -- nothing to defend yet

  const LATE_SEASON_FROM_GW = 30;

  for (const gw of context.finishedGws) {
    const leader = replay.at(gw).standings.find((r) => r.rank === 1);
    const leaderKey = context.managers.byId.get(leader.managerId)?.personKey;
    if (leaderKey === beltHolderKey) continue; // holder is still on track; nothing dramatic to say

    storylines.push({
      type: "belt-in-danger",
      personKeys: [beltHolderKey, leaderKey],
      facts: { beltHolderKey, currentLeaderKey: leaderKey, gw },
      baseWeight: gw >= LATE_SEASON_FROM_GW ? 6 : 2,
      gw,
      dedupeKey: `belt-in-danger:${gw >= LATE_SEASON_FROM_GW ? "late" : "early"}`,
    });
  }

  const finalGw = context.finishedGws[context.finishedGws.length - 1];
  if (finalGw) {
    const finalChampion = replay.at(finalGw).standings.find((r) => r.rank === 1);
    const finalChampionKey = context.managers.byId.get(finalChampion.managerId)?.personKey;
    const retained = finalChampionKey === beltHolderKey;

    storylines.push({
      type: retained ? "belt-retained" : "belt-changed-hands",
      personKeys: retained ? [beltHolderKey] : [beltHolderKey, finalChampionKey],
      facts: { beltHolderKey, newChampionKey: finalChampionKey },
      baseWeight: 8,
      gw: finalGw,
      dedupeKey: "belt-resolution",
    });
  }

  return storylines;
}
