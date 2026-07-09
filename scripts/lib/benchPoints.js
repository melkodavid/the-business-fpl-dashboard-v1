// Sum of points scored by a manager's non-starting players in a given GW.
// Shared by weeklyAwards.js (Worst Lineup of the Week) and benchStats.js
// (season bench-wasted totals).
export function benchPointsForGw(context, gw, managerId) {
  const picks = context.gwPicks[gw]?.[managerId];
  if (!picks) return 0;
  return picks.bench.reduce((sum, elementId) => sum + (context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0), 0);
}
