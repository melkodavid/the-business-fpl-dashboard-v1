import { buildRosterEvents } from "../lib/rosterEvents.js";

const HIT_THRESHOLD_PER_GW = 5;
const MIN_GWS_FOR_EFFICIENCY = 3;

// Spec §11 — Waiver Wire Hit Rate. Every approved "w" (waiver-priority) or "f"
// (free agent) pickup counts as an FA pickup; the spec doesn't distinguish the
// two by kind, only by outcome.
export function computeWaiverHitRate(context) {
  const { tenureEndGw } = buildRosterEvents(context);
  const seasonEnd = context.finishedGws[context.finishedGws.length - 1] ?? 0;

  const pickups = [];
  for (const t of context.transactions) {
    if (t.result !== "a" || t.elementIn == null) continue;
    if (t.event > seasonEnd) continue; // no finished GWs elapsed yet to judge this pickup

    const tenureEnd = Math.min(tenureEndGw(t.managerId, t.elementIn, t.event, seasonEnd), seasonEnd);
    const gwsRostered = context.finishedGws.filter((gw) => gw >= t.event && gw <= tenureEnd).length;
    const pointsWhileRostered = context.finishedGws
      .filter((gw) => gw >= t.event && gw <= tenureEnd)
      .reduce((sum, gw) => sum + (context.gwPlayerStats[gw]?.[t.elementIn]?.totalPoints ?? 0), 0);
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
