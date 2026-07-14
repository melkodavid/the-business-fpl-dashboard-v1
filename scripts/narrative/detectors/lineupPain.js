// GENERIC — lineup-decision pain: bench outscored the actual starting XI
// that gw, plus two reuses of already-computed solvers (no re-deriving the
// optimal-XI math here): benchStats' "Could Have Won" instances (spec §8)
// and the 59th-minute sub tracker (spec §7).
export function detectLineupPain(context, benchStats, fiftyNineClub) {
  const storylines = [];
  const personKeyOf = (managerId) => context.managers.byId.get(managerId)?.personKey;

  for (const gw of context.finishedGws) {
    for (const manager of context.managers.list) {
      const benchPts = benchStats.perGw[gw]?.[manager.id];
      const starterPts = context.gwPicks[gw]?.[manager.id]?.totalPoints;
      if (benchPts == null || starterPts == null) continue;
      if (benchPts > starterPts) {
        storylines.push({
          type: "lineup-bench-outscored",
          personKeys: [manager.personKey],
          facts: { managerId: manager.id, benchPts, starterPts },
          baseWeight: 3,
          gw,
          dedupeKey: `lineup-bench-outscored:${gw}:${manager.id}`,
        });
      }
    }
  }

  for (const inst of benchStats.couldHaveWonInstances) {
    storylines.push({
      type: "lineup-could-have-won",
      personKeys: [personKeyOf(inst.managerId)],
      facts: inst,
      baseWeight: 4,
      gw: inst.gw,
      dedupeKey: `lineup-could-have-won:${inst.gw}:${inst.managerId}`,
    });
  }

  for (const inst of fiftyNineClub.instances) {
    storylines.push({
      type: "lineup-59-club",
      personKeys: [personKeyOf(inst.managerId)],
      facts: inst,
      baseWeight: 2,
      gw: inst.gw,
      dedupeKey: `lineup-59-club:${inst.gw}:${inst.managerId}:${inst.elementId}:${inst.fixtureId}`,
    });
  }

  return storylines;
}
