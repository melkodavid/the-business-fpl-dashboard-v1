import { currentStreak } from "../lib/streak.js";

// Spec §1 — core standings straight from the API, plus current streak.
// (Luck Score is computed by allPlay.js and joined onto this table client-side.)
export function computeStandings(context) {
  const finishedMatches = context.matches.filter((m) => m.finished).sort((a, b) => a.event - b.event);

  const rows = context.standings.map((s) => {
    const manager = context.managers.byId.get(s.managerId);

    const results = [];
    for (const m of finishedMatches) {
      let mine, theirs;
      if (m.homeManagerId === s.managerId) [mine, theirs] = [m.homePoints, m.awayPoints];
      else if (m.awayManagerId === s.managerId) [mine, theirs] = [m.awayPoints, m.homePoints];
      else continue;
      results.push(mine > theirs ? "W" : mine < theirs ? "L" : "D");
    }

    return {
      managerId: s.managerId,
      managerName: manager?.name,
      shortName: manager?.shortName,
      rank: s.rank,
      played: s.played,
      won: s.won,
      drawn: s.drawn,
      lost: s.lost,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      total: s.total,
      streak: currentStreak(results),
    };
  });

  rows.sort((a, b) => a.rank - b.rank);
  return { rows };
}
