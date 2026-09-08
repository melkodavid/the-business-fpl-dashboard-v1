import { buildRosterEvents } from "../lib/rosterEvents.js";
import { pointsWhileStarted } from "../lib/startedPoints.js";

function pointsWhileWithNewTeam(context, elementId, fromGw, throughGw) {
  let sum = 0;
  for (const gw of context.finishedGws) {
    if (gw < fromGw || gw > throughGw) continue;
    sum += context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0;
  }
  return sum;
}

// "Position ripple" -- a manager's *next* waiver/FA add in the same position
// as a player they just gave up in this trade. Framed loosely on purpose: a
// trade can create value beyond the players directly swapped (e.g. freeing a
// roster spot that lets a later waiver pickup actually start), but that's a
// lineup decision the manager makes, not something this can prove happened
// *because of* the trade -- so this only ever shows "here's what followed",
// never a claim of causation.
function nextSamePositionPickup(context, tenureEndGw, managerId, position, afterGw, seasonEnd) {
  const candidates = context.transactions
    .filter((t) => t.result === "a" && t.elementIn != null && t.managerId === managerId && t.event >= afterGw)
    .filter((t) => context.players.byId.get(t.elementIn)?.positionName === position)
    .sort((a, b) => a.event - b.event || a.id - b.id);
  const next = candidates[0];
  if (!next) return null;

  const tenureEnd = Math.min(tenureEndGw(managerId, next.elementIn, next.event, seasonEnd), seasonEnd);
  const { gwsStarted, points } = pointsWhileStarted(context, managerId, next.elementIn, next.event, tenureEnd);
  return {
    elementId: next.elementIn,
    playerName: context.players.byId.get(next.elementIn)?.webName,
    position,
    acquiredGw: next.event,
    gwsStarted,
    points,
  };
}

// Counterfactual win/loss impact -- "if this manager had kept the player(s)
// they gave up instead of the one(s) they received, would that gameweek's
// H2H result have flipped?" Deliberately the simplest possible model: assume
// every given-up player would have started every week (we have no way to
// know what they'd really have done with a player they no longer own), and
// only subtract a received player's actual points for weeks they genuinely
// started (a benched pickup already contributed 0 to the real score, so
// there's nothing to undo). This is a rough estimate for banter, not a
// precise account of what really would have happened.
function resultImpactForSide(context, managerId, given, received, fromGw, seasonEnd) {
  const impacts = [];
  for (const gw of context.finishedGws) {
    if (gw < fromGw || gw > seasonEnd) continue;
    const match = context.matches.find(
      (m) => m.event === gw && m.finished && (m.homeManagerId === managerId || m.awayManagerId === managerId)
    );
    if (!match) continue;

    const isHome = match.homeManagerId === managerId;
    const actualScore = isHome ? match.homePoints : match.awayPoints;
    const opponentId = isHome ? match.awayManagerId : match.homeManagerId;
    const opponentScore = isHome ? match.awayPoints : match.homePoints;

    const receivedContribution = received.reduce((sum, elementId) => {
      const started = context.gwPicks[gw]?.[managerId]?.starters?.includes(elementId) ?? false;
      return sum + (started ? context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0 : 0);
    }, 0);
    const givenContribution = given.reduce(
      (sum, elementId) => sum + (context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0),
      0
    );
    const counterfactualScore = actualScore - receivedContribution + givenContribution;

    const resultOf = (score) => (score > opponentScore ? "W" : score < opponentScore ? "L" : "D");
    const actualResult = resultOf(actualScore);
    const counterfactualResult = resultOf(counterfactualScore);
    if (actualResult === counterfactualResult) continue;

    impacts.push({
      gw,
      opponentId,
      actualScore,
      actualResult,
      counterfactualScore,
      counterfactualResult,
      opponentScore,
    });
  }
  return impacts;
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
      const given = side.playersOut.map((elementId) => {
        const position = context.players.byId.get(elementId)?.positionName;
        return {
          elementId,
          playerName: context.players.byId.get(elementId)?.webName,
          points: pointsByElement.get(elementId) ?? 0,
          positionRipple: position
            ? nextSamePositionPickup(context, tenureEndGw, side.managerId, position, trade.event, seasonEnd)
            : null,
        };
      });
      const gained = received.reduce((sum, p) => sum + p.points, 0);
      const givenUp = given.reduce((sum, p) => sum + p.points, 0);
      const netValue = gained - givenUp;
      netValueByManager.set(side.managerId, (netValueByManager.get(side.managerId) ?? 0) + netValue);
      const resultImpact = resultImpactForSide(
        context,
        side.managerId,
        side.playersOut,
        side.playersIn,
        trade.event,
        seasonEnd
      );
      return { managerId: side.managerId, received, given, gained, givenUp, netValue, resultImpact };
    });

    log.push({ tradeId: trade.id, gw: trade.event, sides: sideResults });
  }

  const leaderboard = context.managers.list
    .map((m) => ({ managerId: m.id, managerName: m.name, netTradeValue: netValueByManager.get(m.id) }))
    .sort((a, b) => b.netTradeValue - a.netTradeValue);

  return { log, leaderboard };
}
