// Shared by waiverHitRate.js and tradeLedger.js's position-ripple tracking:
// how many of a manager's finished gameweeks in [fromGw, throughGw] actually
// had `elementId` in their STARTING lineup, and how many points that player
// scored across just those weeks. A player hauling from the bench never
// helped the team, so bench weeks are excluded entirely (not just zeroed).
export function pointsWhileStarted(context, managerId, elementId, fromGw, throughGw) {
  const startedGws = context.finishedGws.filter((gw) => {
    if (gw < fromGw || gw > throughGw) return false;
    return context.gwPicks[gw]?.[managerId]?.starters?.includes(elementId) ?? false;
  });
  const points = startedGws.reduce((sum, gw) => sum + (context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0), 0);
  return { gwsStarted: startedGws.length, points };
}
