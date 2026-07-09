// Spec §9 — Draft Grades / Pure Draft Team Tracker. The locked original draft
// list (context.draftChoices) is never mutated by later trades/waivers, so this
// module can just read it directly — no roster-timeline logic needed, unlike
// tradeLedger.js and waiverHitRate.js.
export function computeDraftGrades(context) {
  const draftTeamPoints = new Map(context.managers.list.map((m) => [m.id, 0]));
  const scatter = [];

  for (const pick of context.draftChoices) {
    const player = context.players.byId.get(pick.elementId);
    draftTeamPoints.set(pick.managerId, draftTeamPoints.get(pick.managerId) + (player?.seasonTotalPoints ?? 0));
    scatter.push({
      pickNumber: pick.index,
      seasonPoints: player?.seasonTotalPoints ?? 0,
      managerId: pick.managerId,
      playerName: player?.webName,
    });
  }

  const leaderboard = context.managers.list
    .map((m) => ({ managerId: m.id, managerName: m.name, draftTeamPoints: draftTeamPoints.get(m.id) }))
    .sort((a, b) => b.draftTeamPoints - a.draftTeamPoints);

  return { leaderboard, scatter };
}
