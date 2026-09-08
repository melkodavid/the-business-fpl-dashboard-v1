import { buildRosterEvents } from "../lib/rosterEvents.js";
import { pointsWhileStarted } from "../lib/startedPoints.js";

const HIT_THRESHOLD_PER_GW = 5;
const MIN_GWS_FOR_EFFICIENCY = 3;

// Spec §11 — Waiver Wire Hit Rate. Every approved "w" (waiver-priority) or "f"
// (free agent) pickup counts as an FA pickup; the spec doesn't distinguish the
// two by kind, only by outcome.
export function computeWaiverHitRate(context) {
  const { tenureEndGw } = buildRosterEvents(context);
  const seasonEnd = context.finishedGws[context.finishedGws.length - 1] ?? 0;

  // A manager can add, drop, and re-add the same player before a single
  // gameweek's deadline (e.g. add X, immediately swap X back out for Y, then
  // re-add X) -- the roster timeline only has GW-level granularity, so
  // tenureEndGw can't tell those apart and would credit the same real points
  // to every one of those "a" transactions independently. Only the last add
  // before the deadline is the one that actually left them rostered that
  // week, so within a given manager+player+gameweek, every earlier add is
  // discarded in favor of the highest transaction id (ids increase with time).
  const latestByManagerPlayerGw = new Map();
  for (const t of context.transactions) {
    if (t.result !== "a" || t.elementIn == null) continue;
    const key = `${t.managerId}:${t.elementIn}:${t.event}`;
    const existing = latestByManagerPlayerGw.get(key);
    if (!existing || t.id > existing.id) latestByManagerPlayerGw.set(key, t);
  }

  const pickups = [];
  for (const t of latestByManagerPlayerGw.values()) {
    if (t.event > seasonEnd) continue; // no finished GWs elapsed yet to judge this pickup

    const tenureEnd = Math.min(tenureEndGw(t.managerId, t.elementIn, t.event, seasonEnd), seasonEnd);
    // Only gameweeks the player actually started count -- a haul from the
    // bench never helped the team, so it shouldn't count toward whether this
    // pickup was a "hit" (or inflate its points-while-rostered total).
    const { gwsStarted: gwsRostered, points: pointsWhileRostered } = pointsWhileStarted(
      context,
      t.managerId,
      t.elementIn,
      t.event,
      tenureEnd
    );
    const pointsPerGw = gwsRostered > 0 ? pointsWhileRostered / gwsRostered : 0;

    pickups.push({
      managerId: t.managerId,
      managerName: context.managers.byId.get(t.managerId)?.name,
      elementId: t.elementIn,
      playerName: context.players.byId.get(t.elementIn)?.webName,
      kind: t.kind,
      acquiredGw: t.event,
      gwsRostered,
      pointsWhileRostered,
      pointsPerGw,
      isHit: pointsPerGw >= HIT_THRESHOLD_PER_GW,
    });
  }

  const hitRateByManager = new Map();
  for (const m of context.managers.list) {
    const own = pickups.filter((p) => p.managerId === m.id);
    const hits = own.filter((p) => p.isHit).length;
    hitRateByManager.set(m.id, {
      managerId: m.id,
      managerName: m.name,
      totalPickups: own.length,
      hits,
      hitRate: own.length > 0 ? hits / own.length : 0,
    });
  }

  const bestPickups = [...pickups].sort((a, b) => b.pointsWhileRostered - a.pointsWhileRostered);
  const mostEfficient = pickups
    .filter((p) => p.gwsRostered >= MIN_GWS_FOR_EFFICIENCY)
    .sort((a, b) => b.pointsPerGw - a.pointsPerGw);
  const bestOneWeekPunts = pickups
    .filter((p) => p.gwsRostered < MIN_GWS_FOR_EFFICIENCY)
    .sort((a, b) => b.pointsPerGw - a.pointsPerGw);

  return {
    pickups,
    hitRateLeaderboard: [...hitRateByManager.values()].sort((a, b) => b.hitRate - a.hitRate),
    bestPickups,
    mostEfficient,
    bestOneWeekPunts,
  };
}
