const FORM_WINDOW = 5;

// Spec §12 — Form Guide: each manager's W/D/L over the last 5 completed
// gameweeks (for a visual form strip), plus their average points that window
// compared to the league-wide average over the same gameweeks. Results come
// from the H2H matches (not entry_history, which the real Draft API leaves
// empty) — same source already proven correct for standings.js.
export function computeFormGuide(context) {
  const recentGws = context.finishedGws.slice(-FORM_WINDOW);
  const finishedMatches = context.matches.filter((m) => m.finished && recentGws.includes(m.event));

  const resultsByManager = new Map(context.managers.list.map((m) => [m.id, []]));
  let leagueTotalPoints = 0;
  let leagueEntries = 0;

  for (const gw of recentGws) {
    for (const m of finishedMatches.filter((match) => match.event === gw)) {
      const sides = [
        [m.homeManagerId, m.homePoints, m.awayPoints],
        [m.awayManagerId, m.awayPoints, m.homePoints],
      ];
      for (const [managerId, mine, theirs] of sides) {
        const result = mine > theirs ? "W" : mine < theirs ? "L" : "D";
        resultsByManager.get(managerId)?.push({ gw, result, points: mine });
        leagueTotalPoints += mine;
        leagueEntries++;
      }
    }
  }

  const leagueAvgPoints = leagueEntries ? leagueTotalPoints / leagueEntries : 0;

  const rows = context.managers.list.map((m) => {
    const results = resultsByManager.get(m.id) ?? [];
    const avgPoints = results.length ? results.reduce((sum, r) => sum + r.points, 0) / results.length : 0;
    return {
      managerId: m.id,
      managerName: m.name,
      gwsIncluded: recentGws,
      results,
      avgPoints: Math.round(avgPoints * 10) / 10,
      diffFromLeagueAvg: Math.round((avgPoints - leagueAvgPoints) * 10) / 10,
    };
  });

  rows.sort((a, b) => b.diffFromLeagueAvg - a.diffFromLeagueAvg);
  return { rows, leagueAvgPoints: Math.round(leagueAvgPoints * 10) / 10 };
}
