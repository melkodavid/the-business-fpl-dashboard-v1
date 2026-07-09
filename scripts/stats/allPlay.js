// Spec §2 — All-Play Luck-Adjusted Standings.
export function computeAllPlay(context) {
  const managerIds = context.managers.list.map((m) => m.id);
  const perGw = {};
  const expectedWinsByManager = new Map(managerIds.map((id) => [id, 0]));

  for (const gw of context.finishedGws) {
    const scores = managerIds
      .map((managerId) => ({ managerId, score: context.gwPicks[gw]?.[managerId]?.totalPoints }))
      .filter((s) => s.score !== undefined);

    const gwRows = scores.map(({ managerId, score }) => {
      const others = scores.filter((s) => s.managerId !== managerId);
      const beaten = others.reduce((sum, o) => sum + (score > o.score ? 1 : score === o.score ? 0.5 : 0), 0);
      const winPct = others.length > 0 ? beaten / others.length : 0;
      expectedWinsByManager.set(managerId, expectedWinsByManager.get(managerId) + winPct);
      return { managerId, score, allPlayWinPct: winPct };
    });

    perGw[gw] = gwRows;
  }

  // Actual wins, tallied from finished H2H matches (independent of the
  // standings endpoint, so this stat is self-contained).
  const actualWinsByManager = new Map(managerIds.map((id) => [id, 0]));
  for (const m of context.matches) {
    if (!m.finished) continue;
    if (m.homePoints > m.awayPoints) actualWinsByManager.set(m.homeManagerId, (actualWinsByManager.get(m.homeManagerId) ?? 0) + 1);
    else if (m.awayPoints > m.homePoints) actualWinsByManager.set(m.awayManagerId, (actualWinsByManager.get(m.awayManagerId) ?? 0) + 1);
  }

  const standings = managerIds
    .map((managerId) => {
      const expectedWins = expectedWinsByManager.get(managerId);
      const actualWins = actualWinsByManager.get(managerId) ?? 0;
      return {
        managerId,
        managerName: context.managers.byId.get(managerId)?.name,
        expectedWins,
        actualWins,
        luckScore: actualWins - expectedWins,
      };
    })
    .sort((a, b) => b.expectedWins - a.expectedWins);

  return { perGw, standings };
}
