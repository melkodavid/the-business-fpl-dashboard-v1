const FORM_WINDOW = 5;

// Spec §12 — Form Guide: rolling total over the last 5 completed gameweeks.
export function computeFormGuide(context) {
  const recentGws = context.finishedGws.slice(-FORM_WINDOW);

  const rows = context.managers.list.map((m) => {
    const total = recentGws.reduce((sum, gw) => sum + (context.gwPicks[gw]?.[m.id]?.totalPoints ?? 0), 0);
    return { managerId: m.id, managerName: m.name, gwsIncluded: recentGws, formPoints: total };
  });

  rows.sort((a, b) => b.formPoints - a.formPoints);
  return { rows };
}
