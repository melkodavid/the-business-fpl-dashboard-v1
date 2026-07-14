// Reconstructs the league's state as of the END of each finished gameweek --
// standings (rank, W/D/L, PF/PA, league points) and each manager's current
// streak at that point -- so detectors can tell not just "what's true now"
// but "what changed, and exactly when" (a rank change, a streak crossing 3).
// This is the one piece of history that doesn't already exist anywhere else
// in the build: every other stats/*.js module only ever computes a final,
// whole-season snapshot. Nothing here is displayed directly -- it's the
// shared timeline the generic detectors walk gameweek by gameweek.
//
// League points use the standard 3-1-0 H2H scoring (win-draw-loss); this is
// a best-effort reconstruction for narrative purposes, not a replacement for
// the API's own standings.total (which is what the real Standings page uses).
import { currentStreak } from "../lib/streak.js";

function standingsThroughGw(context, throughGw) {
  const totals = new Map(
    context.managers.list.map((m) => [
      m.id,
      { managerId: m.id, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0, total: 0 },
    ])
  );

  for (const m of context.matches) {
    if (!m.finished || m.event > throughGw) continue;
    const home = totals.get(m.homeManagerId);
    const away = totals.get(m.awayManagerId);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.pointsFor += m.homePoints;
    home.pointsAgainst += m.awayPoints;
    away.pointsFor += m.awayPoints;
    away.pointsAgainst += m.homePoints;
    if (m.homePoints > m.awayPoints) {
      home.won++;
      home.total += 3;
      away.lost++;
    } else if (m.homePoints < m.awayPoints) {
      away.won++;
      away.total += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.total += 1;
      away.total += 1;
    }
  }

  const rows = [...totals.values()].sort((a, b) => b.total - a.total || b.pointsFor - a.pointsFor);
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  return rows;
}

function streakThroughGw(context, throughGw, managerId) {
  const results = context.matches
    .filter((m) => m.finished && m.event <= throughGw && (m.homeManagerId === managerId || m.awayManagerId === managerId))
    .sort((a, b) => a.event - b.event)
    .map((m) => {
      const mine = m.homeManagerId === managerId ? m.homePoints : m.awayPoints;
      const theirs = m.homeManagerId === managerId ? m.awayPoints : m.homePoints;
      return mine > theirs ? "W" : mine < theirs ? "L" : "D";
    });
  return currentStreak(results);
}

// Returns { [gw]: { standings: [...], streaksByManagerId: Map } } for every
// gw in context.finishedGws, plus a `before(gw)` helper for "what was true
// immediately before this GW" (i.e. through gw-1, or an empty/neutral state
// for the season's first gameweek).
export function buildSeasonReplay(context) {
  const byGw = {};

  for (const gw of context.finishedGws) {
    const standings = standingsThroughGw(context, gw);
    const streaksByManagerId = new Map(
      context.managers.list.map((m) => [m.id, streakThroughGw(context, gw, m.id)])
    );
    byGw[gw] = { gw, standings, streaksByManagerId };
  }

  function at(gw) {
    return byGw[gw] ?? null;
  }

  function before(gw) {
    const idx = context.finishedGws.indexOf(gw);
    if (idx <= 0) return null;
    return byGw[context.finishedGws[idx - 1]] ?? null;
  }

  return { byGw, at, before, finishedGws: context.finishedGws };
}
