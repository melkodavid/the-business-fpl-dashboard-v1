// GENERIC — running season records: high/low individual GW score, biggest
// blowout, closest margin, highest losing score, lowest winning score. Each
// only fires the gameweek a new record is actually set (running max/min
// tracked chronologically), not a final-season summary.
export function detectRecords(context) {
  const storylines = [];
  let highGw = -Infinity;
  let lowGw = Infinity;
  let biggestBlowout = -Infinity;
  let closestMargin = Infinity;
  let highestLosing = -Infinity;
  let lowestWinning = Infinity;

  const personKeyOf = (managerId) => context.managers.byId.get(managerId)?.personKey;

  for (const gw of context.finishedGws) {
    const gwMatches = context.matches.filter((m) => m.event === gw && m.finished);

    for (const m of gwMatches) {
      for (const s of [
        { managerId: m.homeManagerId, score: m.homePoints },
        { managerId: m.awayManagerId, score: m.awayPoints },
      ]) {
        if (s.score > highGw) {
          highGw = s.score;
          storylines.push({
            type: "record-high-gw",
            personKeys: [personKeyOf(s.managerId)],
            facts: { managerId: s.managerId, score: s.score },
            baseWeight: 4,
            gw,
            dedupeKey: `record-high-gw:${gw}:${s.managerId}`,
          });
        }
        if (s.score < lowGw) {
          lowGw = s.score;
          storylines.push({
            type: "record-low-gw",
            personKeys: [personKeyOf(s.managerId)],
            facts: { managerId: s.managerId, score: s.score },
            baseWeight: 3,
            gw,
            dedupeKey: `record-low-gw:${gw}:${s.managerId}`,
          });
        }
      }

      if (m.homePoints === m.awayPoints) continue; // margin/winner records need a decided match

      const margin = Math.abs(m.homePoints - m.awayPoints);
      const winnerId = m.homePoints > m.awayPoints ? m.homeManagerId : m.awayManagerId;
      const loserId = m.homePoints > m.awayPoints ? m.awayManagerId : m.homeManagerId;
      const winnerScore = Math.max(m.homePoints, m.awayPoints);
      const loserScore = Math.min(m.homePoints, m.awayPoints);

      if (margin > biggestBlowout) {
        biggestBlowout = margin;
        storylines.push({
          type: "record-blowout",
          personKeys: [personKeyOf(winnerId), personKeyOf(loserId)],
          facts: { winnerId, loserId, margin },
          baseWeight: 4,
          gw,
          dedupeKey: `record-blowout:${gw}:${winnerId}:${loserId}`,
        });
      }
      if (margin < closestMargin) {
        closestMargin = margin;
        storylines.push({
          type: "record-closest",
          personKeys: [personKeyOf(winnerId), personKeyOf(loserId)],
          facts: { winnerId, loserId, margin },
          baseWeight: 4,
          gw,
          dedupeKey: `record-closest:${gw}:${winnerId}:${loserId}`,
        });
      }
      if (winnerScore < lowestWinning) {
        lowestWinning = winnerScore;
        storylines.push({
          type: "record-low-win",
          personKeys: [personKeyOf(winnerId)],
          facts: { managerId: winnerId, score: winnerScore },
          baseWeight: 3,
          gw,
          dedupeKey: `record-low-win:${gw}:${winnerId}`,
        });
      }
      if (loserScore > highestLosing) {
        highestLosing = loserScore;
        storylines.push({
          type: "record-high-loss",
          personKeys: [personKeyOf(loserId)],
          facts: { managerId: loserId, score: loserScore },
          baseWeight: 3,
          gw,
          dedupeKey: `record-high-loss:${gw}:${loserId}`,
        });
      }
    }
  }

  return storylines;
}
