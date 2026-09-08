// Spec §9 — Draft Grades / Pure Draft Team Tracker. The locked original draft
// list (context.draftChoices) is never mutated by later trades/waivers, so this
// module can just read it directly — no roster-timeline logic needed, unlike
// tradeLedger.js and waiverHitRate.js.
export function computeDraftGrades(context) {
  // Before this season's own GW1 is actually confirmed finished, the FPL
  // API's total_points field can still be carrying a player's *last*
  // season's final tally rather than a reset 0 (a known transitional quirk
  // right after a season rolls over) -- so every draft team should read 0
  // until real points have genuinely been earned this season, regardless of
  // what that raw field says.
  const seasonStarted = context.finishedGws.length > 0;

  const draftTeamPoints = new Map(context.managers.list.map((m) => [m.id, 0]));
  const scatter = [];

  for (const pick of context.draftChoices) {
    const player = context.players.byId.get(pick.elementId);
    const seasonPoints = seasonStarted ? (player?.seasonTotalPoints ?? 0) : 0;
    draftTeamPoints.set(pick.managerId, draftTeamPoints.get(pick.managerId) + seasonPoints);
    scatter.push({
      pickNumber: pick.index,
      seasonPoints,
      managerId: pick.managerId,
      playerName: player?.webName,
    });
  }

  const leaderboard = context.managers.list
    .map((m) => ({ managerId: m.id, managerName: m.name, draftTeamPoints: draftTeamPoints.get(m.id) }))
    .sort((a, b) => b.draftTeamPoints - a.draftTeamPoints);

  return { leaderboard, scatter };
}
