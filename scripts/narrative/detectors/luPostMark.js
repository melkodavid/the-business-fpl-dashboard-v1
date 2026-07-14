// LORE-DRIVEN — SEASON ARC, only active once the lore flag "lu-post-mark-era"
// is set on lu (deliberately unset for now; see the README rollover
// checklist). Frames lu as the defending champion (4 titles per history.json)
// attempting to retain without his usual trade partner: tracks his rank/form
// every week, flags scrutiny on every trade he makes, and resolves with a
// headline-weight storyline if he wins the Belt or is mathematically
// eliminated.
const SEASON_LENGTH_GWS = 38;
const ELIMINATION_WATCH_FROM_GW = 25;

export function detectLuPostMark(context, replay, tradeLedger, lore) {
  if (!lore.hasFlag("lu", "lu-post-mark-era")) return [];

  const lu = context.managers.list.find((m) => m.personKey === "lu");
  if (!lu) return [];

  const storylines = [];

  for (const gw of context.finishedGws) {
    const row = replay.at(gw).standings.find((r) => r.managerId === lu.id);
    if (!row) continue;
    storylines.push({
      type: "lu-post-mark-tracker",
      personKeys: ["lu"],
      facts: { managerId: lu.id, rank: row.rank, total: row.total },
      baseWeight: 2,
      gw,
      dedupeKey: `lu-post-mark-tracker:${gw}`,
    });
  }

  for (const trade of tradeLedger.log) {
    const side = trade.sides.find((s) => s.managerId === lu.id);
    if (!side) continue;
    storylines.push({
      type: "lu-post-mark-trade-scrutiny",
      personKeys: ["lu"],
      facts: { tradeId: trade.tradeId, netValue: side.netValue },
      baseWeight: 3,
      gw: trade.gw,
      dedupeKey: `lu-post-mark-trade-scrutiny:${trade.tradeId}`,
    });
  }

  // Resolution: won the Belt at season end, or mathematically eliminated
  // from 1st partway through (same simplified elimination math as
  // table-drama's, kept local here so this detector stays self-contained).
  for (const gw of context.finishedGws) {
    if (gw < ELIMINATION_WATCH_FROM_GW) continue;
    const snapshot = replay.at(gw);
    const luRow = snapshot.standings.find((r) => r.managerId === lu.id);
    const leader = snapshot.standings.find((r) => r.rank === 1);
    if (!luRow || luRow.rank === 1) continue;
    const gamesRemaining = SEASON_LENGTH_GWS - gw;
    const maxPossible = luRow.total + gamesRemaining * 3;
    if (maxPossible < leader.total) {
      storylines.push({
        type: "lu-post-mark-resolution-eliminated",
        personKeys: ["lu"],
        facts: { managerId: lu.id, maxPossible, leaderTotal: leader.total },
        baseWeight: 6,
        gw,
        dedupeKey: "lu-post-mark-resolution",
      });
      break; // resolved -- no need to keep checking later gws
    }
  }

  const finalGw = context.finishedGws[context.finishedGws.length - 1];
  if (finalGw) {
    const finalRow = replay.at(finalGw).standings.find((r) => r.managerId === lu.id);
    if (finalRow?.rank === 1) {
      storylines.push({
        type: "lu-post-mark-resolution-won",
        personKeys: ["lu"],
        facts: { managerId: lu.id },
        baseWeight: 6,
        gw: finalGw,
        dedupeKey: "lu-post-mark-resolution",
      });
    }
  }

  return storylines;
}
