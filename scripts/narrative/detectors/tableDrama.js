// GENERIC — 1st place changing hands, a manager entering/exiting the top 4,
// and a simplified late-season mathematical elimination from the Belt race
// (even winning every remaining fixture at 3 league-pts each couldn't catch
// the current leader's total). Like benchStats' "Could Have Won", this is a
// deliberately simplified flourish, not a certified maths-department result.
const SEASON_LENGTH_GWS = 38;
const ELIMINATION_WATCH_FROM_GW = 25;

export function detectTableDrama(context, replay) {
  const storylines = [];
  const personKeyOf = (managerId) => context.managers.byId.get(managerId)?.personKey;
  const eliminatedAlready = new Set();

  for (const gw of context.finishedGws) {
    const prev = replay.before(gw);
    const current = replay.at(gw);
    const currentLeader = current.standings.find((r) => r.rank === 1);
    const prevLeader = prev?.standings.find((r) => r.rank === 1);

    if (prevLeader && currentLeader.managerId !== prevLeader.managerId) {
      storylines.push({
        type: "table-new-leader",
        personKeys: [personKeyOf(currentLeader.managerId), personKeyOf(prevLeader.managerId)],
        facts: { newLeaderId: currentLeader.managerId, previousLeaderId: prevLeader.managerId },
        baseWeight: 5,
        gw,
        dedupeKey: `table-new-leader:${gw}`,
      });
    }

    if (prev) {
      const prevByManager = new Map(prev.standings.map((r) => [r.managerId, r]));
      for (const row of current.standings) {
        const before = prevByManager.get(row.managerId);
        if (!before) continue;
        if (row.rank <= 4 && before.rank > 4) {
          storylines.push({
            type: "table-enter-top4",
            personKeys: [personKeyOf(row.managerId)],
            facts: { managerId: row.managerId, rank: row.rank },
            baseWeight: 3,
            gw,
            dedupeKey: `table-enter-top4:${gw}:${row.managerId}`,
          });
        }
        if (row.rank > 4 && before.rank <= 4) {
          storylines.push({
            type: "table-exit-top4",
            personKeys: [personKeyOf(row.managerId)],
            facts: { managerId: row.managerId, rank: row.rank },
            baseWeight: 3,
            gw,
            dedupeKey: `table-exit-top4:${gw}:${row.managerId}`,
          });
        }
      }
    }

    if (gw >= ELIMINATION_WATCH_FROM_GW) {
      const gamesRemaining = SEASON_LENGTH_GWS - gw;
      for (const row of current.standings) {
        if (row.rank === 1 || eliminatedAlready.has(row.managerId)) continue;
        const maxPossible = row.total + gamesRemaining * 3;
        if (maxPossible < currentLeader.total) {
          eliminatedAlready.add(row.managerId);
          storylines.push({
            type: "table-eliminated",
            personKeys: [personKeyOf(row.managerId)],
            facts: { managerId: row.managerId, maxPossible, leaderTotal: currentLeader.total },
            baseWeight: 2,
            gw,
            dedupeKey: `table-eliminated:${row.managerId}`,
          });
        }
      }
    }
  }

  return storylines;
}
