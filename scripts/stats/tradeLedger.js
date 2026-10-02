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

// "Position ripple" -- a manager's *next* waiver/FA add(s) in the same
// position as a player they just gave up in this trade. Framed loosely on
// purpose: a trade can create value beyond the players directly swapped
// (e.g. freeing a roster spot that lets a later waiver pickup actually
// start), but that's a lineup decision the manager makes, not something
// this can prove happened *because of* the trade -- so this only ever shows
// "here's what followed", never a claim of causation.
//
// Returns up to `count` *distinct* pickups in this position, in order --
// the caller is responsible for assigning one to each given-up player in
// that position so the same real pickup is never attributed to more than
// one of them (e.g. give up two MIDs in one trade, and only one MID was
// added afterward: the 1st given-up MID gets it, the 2nd gets nothing,
// rather than both claiming the same single pickup).
function nextSamePositionPickups(context, tenureEndGw, managerId, position, afterGw, seasonEnd, count) {
  const candidates = context.transactions
    .filter((t) => t.result === "a" && t.elementIn != null && t.managerId === managerId && t.event >= afterGw)
    .filter((t) => context.players.byId.get(t.elementIn)?.positionName === position)
    .sort((a, b) => a.event - b.event || a.id - b.id);

  return candidates.slice(0, count).map((t) => {
    const tenureEnd = Math.min(tenureEndGw(managerId, t.elementIn, t.event, seasonEnd), seasonEnd);
    const { gwsStarted, points } = pointsWhileStarted(context, managerId, t.elementIn, t.event, tenureEnd);
    return {
      elementId: t.elementIn,
      playerName: context.players.byId.get(t.elementIn)?.webName,
      position,
      acquiredGw: t.event,
      gwsStarted,
      points,
    };
  });
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
      // Group given-up players by position first so, when a trade gives up
      // more than one of the same position, each one gets a *different*
      // later pickup (see nextSamePositionPickups) instead of all of them
      // independently latching onto the same single next add.
      const byPosition = new Map();
      side.playersOut.forEach((elementId, idx) => {
        const position = context.players.byId.get(elementId)?.positionName;
        if (!position) return;
        if (!byPosition.has(position)) byPosition.set(position, []);
        byPosition.get(position).push(idx);
      });
      const rippleByIdx = new Map();
      for (const [position, idxs] of byPosition) {
        const pickups = nextSamePositionPickups(
          context,
          tenureEndGw,
          side.managerId,
          position,
          trade.event,
          seasonEnd,
          idxs.length
        );
        idxs.forEach((idx, i) => rippleByIdx.set(idx, pickups[i] ?? null));
      }

      const given = side.playersOut.map((elementId, idx) => ({
        elementId,
        playerName: context.players.byId.get(elementId)?.webName,
        points: pointsByElement.get(elementId) ?? 0,
        positionRipple: rippleByIdx.get(idx) ?? null,
      }));
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

  return { log, leaderboard, seasonImpact: computeSeasonImpact(context, context.trades) };
}

// Points a trade moved into/out of a manager's lineup in one gameweek: what the
// players they gave up scored (assumed to have started, as in
// resultImpactForSide) minus what the players they received scored while
// actually starting.
function tradeLineupDelta(context, side, gw) {
  const started = context.gwPicks[gw]?.[side.managerId]?.starters ?? [];
  const received = side.playersIn.reduce(
    (sum, id) => sum + (started.includes(id) ? context.gwPlayerStats[gw]?.[id]?.totalPoints ?? 0 : 0),
    0
  );
  const given = side.playersOut.reduce((sum, id) => sum + (context.gwPlayerStats[gw]?.[id]?.totalPoints ?? 0), 0);
  return given - received;
}

const resultOf = (own, opp) => (own > opp ? "W" : own < opp ? "L" : "D");

// Season-long "what if they'd never traded?" -- every trade a manager made is
// undone at once, gameweek by gameweek (a week only feels the trades already
// made by then), and each H2H result is re-decided. Same rough model as the
// per-trade counterfactual (and the same caveat: for-fun, not precise), but
// summed up so one week touched by two trades isn't double-counted.
function computeSeasonImpact(context, trades) {
  return context.managers.list
    .map((manager) => {
      const mine = trades
        .map((t) => ({ tradeId: t.id, event: t.event, side: t.sides.find((s) => s.managerId === manager.id) }))
        .filter((t) => t.side);

      const actual = { w: 0, d: 0, l: 0 };
      const without = { w: 0, d: 0, l: 0 };
      const flips = [];

      for (const gw of context.finishedGws) {
        const match = context.matches.find(
          (m) => m.event === gw && m.finished && (m.homeManagerId === manager.id || m.awayManagerId === manager.id)
        );
        if (!match) continue;
        const isHome = match.homeManagerId === manager.id;
        const own = isHome ? match.homePoints : match.awayPoints;
        const opp = isHome ? match.awayPoints : match.homePoints;

        const applicable = mine.filter((t) => t.event <= gw);
        const delta = applicable.reduce((sum, t) => sum + tradeLineupDelta(context, t.side, gw), 0);
        const counterfactual = own + delta;

        const a = resultOf(own, opp);
        const c = resultOf(counterfactual, opp);
        actual[a.toLowerCase()]++;
        without[c.toLowerCase()]++;
        if (a !== c) {
          flips.push({
            gw,
            opponentId: isHome ? match.awayManagerId : match.homeManagerId,
            actualResult: a,
            actualScore: own,
            counterfactualResult: c,
            counterfactualScore: counterfactual,
            opponentScore: opp,
            tradeIds: applicable.map((t) => t.tradeId),
          });
        }
      }

      const pts = (r) => r.w * 3 + r.d;
      return {
        managerId: manager.id,
        managerName: manager.name,
        tradeCount: mine.length,
        actual,
        withoutTrades: without,
        winsDelta: actual.w - without.w,
        lossesDelta: actual.l - without.l,
        pointsDelta: pts(actual) - pts(without),
        flips,
      };
    })
    .sort((a, b) => b.pointsDelta - a.pointsDelta || b.tradeCount - a.tradeCount);
}
