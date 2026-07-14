// LORE-DRIVEN — bridesmaid storylines: leading the table ("don't get
// comfortable"), or losing a match whose importance (reusing the same
// formula This Week's Schedule uses, applied retroactively via the season
// replay) crosses 2.5. Weight escalates sharply from GW30+ if a bridesmaid
// leads -- the closer to the finish line, the bigger the story.
import { matchImportance } from "../../lib/matchImportance.js";

const IMPORTANCE_THRESHOLD = 2.5;
const LATE_SEASON_FROM_GW = 30;

export function detectBridesmaids(context, replay, lore) {
  const storylines = [];

  for (const gw of context.finishedGws) {
    const snapshot = replay.at(gw);
    const teamCount = snapshot.standings.length;
    const rankByManagerId = new Map(snapshot.standings.map((r) => [r.managerId, r.rank]));
    const totalByManagerId = new Map(snapshot.standings.map((r) => [r.managerId, r.total]));

    const leader = snapshot.standings.find((r) => r.rank === 1);
    const leaderKey = context.managers.byId.get(leader.managerId)?.personKey;
    if (lore.isBridesmaid(leaderKey)) {
      storylines.push({
        type: "bridesmaid-leading",
        personKeys: [leaderKey],
        facts: { managerId: leader.managerId, gw },
        baseWeight: gw >= LATE_SEASON_FROM_GW ? 8 : 3,
        gw,
        dedupeKey: `bridesmaid-leading:${gw >= LATE_SEASON_FROM_GW ? "late" : "early"}:${leaderKey}`,
      });
    }

    const gwMatches = context.matches.filter((m) => m.event === gw && m.finished && m.homePoints !== m.awayPoints);
    for (const m of gwMatches) {
      const loserId = m.homePoints > m.awayPoints ? m.awayManagerId : m.homeManagerId;
      const loserKey = context.managers.byId.get(loserId)?.personKey;
      if (!lore.isBridesmaid(loserKey)) continue;

      const { importance } = matchImportance({
        homeRank: rankByManagerId.get(m.homeManagerId) ?? teamCount,
        awayRank: rankByManagerId.get(m.awayManagerId) ?? teamCount,
        homeTotal: totalByManagerId.get(m.homeManagerId) ?? 0,
        awayTotal: totalByManagerId.get(m.awayManagerId) ?? 0,
        teamCount,
      });

      if (importance >= IMPORTANCE_THRESHOLD) {
        storylines.push({
          type: "bridesmaid-costly-loss",
          personKeys: [loserKey],
          facts: { managerId: loserId, gw, importance },
          baseWeight: 3,
          gw,
          dedupeKey: `bridesmaid-costly-loss:${gw}:${loserId}`,
        });
      }
    }
  }

  return storylines;
}
