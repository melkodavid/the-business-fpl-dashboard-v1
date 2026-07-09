const POSITIONS = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };
const emptyTotals = () => ({ GK: 0, DEF: 0, MID: 0, FWD: 0 });
const topPosition = (totals) => Object.entries(totals).sort((a, b) => b[1] - a[1])[0][0];

// Spec §5 — Positional Strength. Starting XI only, both sides.
export function computePositionalStrength(context) {
  const forTotals = new Map(context.managers.list.map((m) => [m.id, emptyTotals()]));
  const againstTotals = new Map(context.managers.list.map((m) => [m.id, emptyTotals()]));

  const addStarterPoints = (totals, managerId, gw, starters) => {
    const bucket = totals.get(managerId);
    for (const elementId of starters) {
      const player = context.players.byId.get(elementId);
      const points = context.gwPlayerStats[gw]?.[elementId]?.totalPoints ?? 0;
      bucket[POSITIONS[player.elementType]] += points;
    }
  };

  for (const gw of context.finishedGws) {
    for (const manager of context.managers.list) {
      const picks = context.gwPicks[gw]?.[manager.id];
      if (picks) addStarterPoints(forTotals, manager.id, gw, picks.starters);
    }

    for (const m of context.matches.filter((mt) => mt.event === gw && mt.finished)) {
      const homePicks = context.gwPicks[gw]?.[m.homeManagerId];
      const awayPicks = context.gwPicks[gw]?.[m.awayManagerId];
      if (homePicks) addStarterPoints(againstTotals, m.awayManagerId, gw, homePicks.starters);
      if (awayPicks) addStarterPoints(againstTotals, m.homeManagerId, gw, awayPicks.starters);
    }
  }

  const perManager = context.managers.list.map((m) => {
    const forT = forTotals.get(m.id);
    const againstT = againstTotals.get(m.id);
    return {
      managerId: m.id,
      managerName: m.name,
      for: forT,
      against: againstT,
      topForPosition: topPosition(forT),
      topAgainstPosition: topPosition(againstT),
    };
  });

  return { perManager };
}
