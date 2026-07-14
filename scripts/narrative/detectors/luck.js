// GENERIC — "daylight robbery" (won that GW with a bottom-3 all-play score)
// and its mirror (lost with a top-3 score). Reuses allPlay.perGw, which
// already has every manager's raw score per gw -- ranking those 12 scores
// gives the bottom-3/top-3 cutoff for that week directly.
export function detectLuck(context, allPlay) {
  const storylines = [];
  const personKeyOf = (managerId) => context.managers.byId.get(managerId)?.personKey;

  for (const gw of context.finishedGws) {
    const rows = allPlay.perGw[gw];
    if (!rows || rows.length < 4) continue; // need a meaningful bottom-3/top-3 split

    const sorted = [...rows].sort((a, b) => b.score - a.score);
    const top3Ids = new Set(sorted.slice(0, 3).map((r) => r.managerId));
    const bottom3Ids = new Set(sorted.slice(-3).map((r) => r.managerId));

    const gwMatches = context.matches.filter((m) => m.event === gw && m.finished && m.homePoints !== m.awayPoints);
    for (const m of gwMatches) {
      for (const p of [
        { managerId: m.homeManagerId, won: m.homePoints > m.awayPoints, opponentId: m.awayManagerId },
        { managerId: m.awayManagerId, won: m.awayPoints > m.homePoints, opponentId: m.homeManagerId },
      ]) {
        if (p.won && bottom3Ids.has(p.managerId)) {
          storylines.push({
            type: "luck-robbery",
            personKeys: [personKeyOf(p.managerId)],
            facts: { managerId: p.managerId, opponentId: p.opponentId },
            baseWeight: 3,
            gw,
            dedupeKey: `luck-robbery:${gw}:${p.managerId}`,
          });
        }
        if (!p.won && top3Ids.has(p.managerId)) {
          storylines.push({
            type: "luck-snakebit",
            personKeys: [personKeyOf(p.managerId)],
            facts: { managerId: p.managerId, opponentId: p.opponentId },
            baseWeight: 3,
            gw,
            dedupeKey: `luck-snakebit:${gw}:${p.managerId}`,
          });
        }
      }
    }
  }

  return storylines;
}
