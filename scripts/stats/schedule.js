import { matchImportance } from "../lib/matchImportance.js";

// "This Week's Schedule" — the next unplayed (or in-progress) gameweek's H2H
// fixtures, ranked by matchup importance rather than kick-off order, the way a
// broadcaster's "big match of the week" segment would. Importance is a proxy
// built from the *current* standings snapshot (closeness in the table, closeness
// in points, and whether either side sits in the title race or bottom of the
// table) since the league has no historical per-GW standings to draw on.
export function computeSchedule(context) {
  const { matches, standings } = context;
  const teamCount = standings.length;
  const rankByManagerId = new Map(standings.map((s) => [s.managerId, s.rank]));
  const totalByManagerId = new Map(standings.map((s) => [s.managerId, s.total]));

  const events = [...new Set(matches.map((m) => m.event))].sort((a, b) => a - b);
  const upcomingGw = events.find((gw) => matches.some((m) => m.event === gw && !m.finished));
  const seasonComplete = upcomingGw === undefined;
  const gw = seasonComplete ? events[events.length - 1] : upcomingGw;

  const fixtures = matches
    .filter((m) => m.event === gw)
    .map((m) => {
      const homeRank = rankByManagerId.get(m.homeManagerId) ?? teamCount;
      const awayRank = rankByManagerId.get(m.awayManagerId) ?? teamCount;
      const homeTotal = totalByManagerId.get(m.homeManagerId) ?? 0;
      const awayTotal = totalByManagerId.get(m.awayManagerId) ?? 0;

      const { importance, tag } = matchImportance({ homeRank, awayRank, homeTotal, awayTotal, teamCount });

      return {
        event: m.event,
        homeManagerId: m.homeManagerId,
        awayManagerId: m.awayManagerId,
        homeRank,
        awayRank,
        homePoints: m.homePoints,
        awayPoints: m.awayPoints,
        started: m.started,
        finished: m.finished,
        importance,
        tag,
      };
    })
    .sort((a, b) => b.importance - a.importance);

  return { gw, seasonComplete, fixtures };
}
