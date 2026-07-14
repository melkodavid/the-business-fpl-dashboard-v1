// GENERIC — trade/waiver storylines: a manager's net trade value flipping
// sign from their previous trade; "the Ex Factor" (a player who left a
// manager, via trade or waiver drop, scoring 10+ against that old manager
// while rostered by the actual opponent that gw); a waiver pickup outscoring
// every player drafted in round 1 that gw. Reuses tradeLedger.js and
// waiverHitRate.js output rather than re-deriving trade/pickup math.
export function detectTradesWaivers(context, tradeLedger, waiverHitRate) {
  const storylines = [];
  const personKeyOf = (managerId) => context.managers.byId.get(managerId)?.personKey;

  detectValueFlips(context, tradeLedger, storylines, personKeyOf);
  detectExFactor(context, storylines, personKeyOf);
  detectWaiverOutscoresRound1(context, waiverHitRate, storylines, personKeyOf);

  return storylines;
}

function detectValueFlips(context, tradeLedger, storylines, personKeyOf) {
  const lastSignByManager = new Map();
  const sortedLog = [...tradeLedger.log].sort((a, b) => a.gw - b.gw);
  for (const trade of sortedLog) {
    for (const side of trade.sides) {
      const sign = Math.sign(side.netValue);
      if (sign === 0) continue;
      const lastSign = lastSignByManager.get(side.managerId);
      if (lastSign != null && lastSign !== sign) {
        storylines.push({
          type: "trade-value-flip",
          personKeys: [personKeyOf(side.managerId)],
          facts: { managerId: side.managerId, tradeId: trade.tradeId, netValue: side.netValue },
          baseWeight: 2,
          gw: trade.gw,
          dedupeKey: `trade-value-flip:${trade.tradeId}:${side.managerId}`,
        });
      }
      lastSignByManager.set(side.managerId, sign);
    }
  }
}

function detectExFactor(context, storylines, personKeyOf) {
  // A manager can drop/trade away the same player more than once in a season
  // (re-acquire, then let them go again); each departure independently scans
  // forward and would otherwise re-flag the exact same real-world event
  // (same gw/oldManagerId/elementId) once per departure. This set collapses
  // those back down to one storyline per genuinely distinct event.
  const emittedDedupeKeys = new Set();

  function checkDeparture(elementId, oldManagerId, leftGw) {
    for (const gw of context.finishedGws) {
      if (gw <= leftGw) continue;
      const match = context.matches.find(
        (m) => m.event === gw && m.finished && (m.homeManagerId === oldManagerId || m.awayManagerId === oldManagerId)
      );
      if (!match) continue;
      const opponentId = match.homeManagerId === oldManagerId ? match.awayManagerId : match.homeManagerId;
      const opponentPicks = context.gwPicks[gw]?.[opponentId];
      if (!opponentPicks) continue;
      const onOpponentRoster = opponentPicks.starters.includes(elementId) || opponentPicks.bench.includes(elementId);
      if (!onOpponentRoster) continue;
      const points = context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0;
      if (points >= 10) {
        const dedupeKey = `trade-ex-factor:${gw}:${oldManagerId}:${elementId}`;
        if (emittedDedupeKeys.has(dedupeKey)) continue;
        emittedDedupeKeys.add(dedupeKey);
        storylines.push({
          type: "trade-ex-factor",
          personKeys: [personKeyOf(oldManagerId), personKeyOf(opponentId)],
          facts: {
            oldManagerId,
            opponentId,
            elementId,
            playerName: context.players.byId.get(elementId)?.webName,
            points,
          },
          baseWeight: 4,
          gw,
          dedupeKey,
        });
      }
    }
  }

  for (const trade of context.trades) {
    for (const side of trade.sides) {
      for (const elementId of side.playersOut) checkDeparture(elementId, side.managerId, trade.event);
    }
  }
  for (const t of context.transactions) {
    if (t.result !== "a" || t.elementOut == null) continue;
    checkDeparture(t.elementOut, t.managerId, t.event);
  }
}

function detectWaiverOutscoresRound1(context, waiverHitRate, storylines, personKeyOf) {
  const round1ElementIds = [...new Set(context.draftChoices.filter((c) => c.round === 1).map((c) => c.elementId))];
  if (round1ElementIds.length === 0) return;

  // A manager can legitimately add/drop/re-add the same player within a
  // single gameweek (two real, separate transactions) -- waiverHitRate.js
  // correctly tracks both as distinct pickups for hit-rate purposes, but
  // from a storytelling angle "this player outscored round 1 this week" is
  // the same highlight either way, so it should only ever be told once.
  const emittedDedupeKeys = new Set();

  for (const gw of context.finishedGws) {
    const round1Scores = round1ElementIds.map((id) => context.gwPlayerStats[gw]?.[id]?.totalPoints ?? 0);
    const bestRound1 = Math.max(...round1Scores);

    for (const pickup of waiverHitRate.pickups) {
      if (gw < pickup.acquiredGw || gw >= pickup.acquiredGw + pickup.gwsRostered) continue;
      const points = context.gwPlayerStats[gw]?.[pickup.elementId]?.totalPoints ?? 0;
      if (points > bestRound1) {
        const dedupeKey = `trade-waiver-outscores-r1:${gw}:${pickup.managerId}:${pickup.elementId}`;
        if (emittedDedupeKeys.has(dedupeKey)) continue;
        emittedDedupeKeys.add(dedupeKey);
        storylines.push({
          type: "trade-waiver-outscores-r1",
          personKeys: [personKeyOf(pickup.managerId)],
          facts: { managerId: pickup.managerId, elementId: pickup.elementId, playerName: pickup.playerName, points, bestRound1 },
          baseWeight: 3,
          gw,
          dedupeKey,
        });
      }
    }
  }
}
