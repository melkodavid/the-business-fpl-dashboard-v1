import { buildRosterEvents } from "../lib/rosterEvents.js";

function pointsWhileWithNewTeam(context, elementId, fromGw, throughGw) {
  let sum = 0;
  for (const gw of context.finishedGws) {
    if (gw < fromGw || gw > throughGw) continue;
    sum += context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0;
  }
  return sum;
}

// Spec §10 — Trade Ledger. Every traded player is tracked exactly once: points
// scored while on their *new* team, from the trade's effective GW until they
// leave that roster again (or season end). That single number is simultaneously
// the receiving manager's "points gained" and the sending manager's "points
// given up" for the same player — matching the spec's worked example, where
// Manager B's net value is computed from the same per-player points already
// shown as Manager A's gain.
export function computeTradeLedger(context) {
  const { tenureEndGw } = buildRosterEvents(context);
  const seasonEnd = context.finishedGws[context.finishedGws.length - 1] ?? 0;

  const log = [];
  const netValueByManager = new Map(context.managers.list.map((m) => [m.id, 0]));

  for (const trade of context.trades) {
    const pointsByElement = new Map();
    for (const side of trade.sides) {
      for (const elementId of side.playersIn) {
        const tenureEnd = tenureEndGw(side.managerId, elementId, trade.event, seasonEnd);
        pointsByElement.set(elementId, pointsWhileWithNewTeam(context, elementId, trade.event, tenureEnd));
      }
    }

    const sideResults = trade.sides.map((side) => {
      const received = side.playersIn.map((elementId) => ({
        elementId,
        playerName: context.players.byId.get(elementId)?.webName,
        points: pointsByElement.get(elementId) ?? 0,
      }));
      const given = side.playersOut.map((elementId) => ({
        elementId,
        playerName: context.players.byId.get(elementId)?.webName,
        points: pointsByElement.get(elementId) ?? 0,
      }));
      const gained = received.reduce((sum, p) => sum + p.points, 0);
      const givenUp = given.reduce((sum, p) => sum + p.points, 0);
      const netValue = gained - givenUp;
      netValueByManager.set(side.managerId, (netValueByManager.get(side.managerId) ?? 0) + netValue);
      return { managerId: side.managerId, received, given, gained, givenUp, netValue };
    });

    log.push({ tradeId: trade.id, gw: trade.event, sides: sideResults });
  }

  const leaderboard = context.managers.list
    .map((m) => ({ managerId: m.id, managerName: m.name, netTradeValue: netValueByManager.get(m.id) }))
    .sort((a, b) => b.netTradeValue - a.netTradeValue);

  return { log, leaderboard };
}
