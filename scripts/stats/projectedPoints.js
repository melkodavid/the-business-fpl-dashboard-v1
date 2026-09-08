// Preseason "Projected Points" leaderboard -- how each manager's drafted
// squad is expected to do, per data/player-projections.json (a hand-
// researched, third-party snapshot; see that file's own _comment for the
// source and caveats). Purely for fun preseason banter until real points
// start coming in via computeDraftGrades, which this has nothing to do with.
export function computeProjectedPoints(context, projectionsData) {
  const projections = projectionsData.projections ?? {};
  const fallback = projectionsData.fallbackPoints ?? 0;

  const teamPoints = new Map(context.managers.list.map((m) => [m.id, 0]));

  for (const pick of context.draftChoices) {
    const player = context.players.byId.get(pick.elementId);
    const pts = player?.code != null ? (projections[player.code] ?? fallback) : fallback;
    teamPoints.set(pick.managerId, teamPoints.get(pick.managerId) + pts);
  }

  const leaderboard = context.managers.list
    .map((m) => ({
      managerId: m.id,
      managerName: m.name,
      projectedPoints: Math.round(teamPoints.get(m.id) * 10) / 10,
    }))
    .sort((a, b) => b.projectedPoints - a.projectedPoints);

  return {
    leaderboard,
    source: projectionsData.source ?? null,
    pulledAt: projectionsData.pulledAt ?? null,
  };
}
