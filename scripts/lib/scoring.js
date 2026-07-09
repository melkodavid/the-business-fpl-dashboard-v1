// Standard FPL scoring constants, keyed by element_type (1=GKP, 2=DEF, 3=MID, 4=FWD).
// Used to decompose a player's raw per-GW stats into a points breakdown for the
// "Points by Scoring Type" stat (spec §6) — gwPlayerStats stores raw stat values
// (goals, minutes, a defensive-contribution count, etc.), not pre-split points.
const GOAL_POINTS = { 1: 6, 2: 6, 3: 5, 4: 4 };
const ASSIST_POINTS = 3;
const CLEAN_SHEET_POINTS = { 1: 4, 2: 4, 3: 1, 4: 0 };
const DC_THRESHOLD = { 2: 10, 3: 12, 4: 12 }; // GKP has no defensive-contribution bonus
const DC_BONUS_POINTS = 2;

export function pointsBreakdown(elementType, stats) {
  const cleanSheetPoints =
    stats.minutes >= 60 && stats.cleanSheets > 0 ? CLEAN_SHEET_POINTS[elementType] * stats.cleanSheets : 0;

  // Evaluated per fixture, not on the GW-summed count — see the comment on
  // fixtures[].defensiveContribution in context.js for why that matters during
  // double gameweeks.
  const threshold = DC_THRESHOLD[elementType] ?? Infinity;
  const dcPoints =
    elementType === 1
      ? 0
      : (stats.fixtures ?? []).filter((f) => f.defensiveContribution >= threshold).length * DC_BONUS_POINTS;

  return {
    goals: GOAL_POINTS[elementType] * stats.goalsScored,
    assists: ASSIST_POINTS * stats.assists,
    cleanSheets: cleanSheetPoints,
    defensiveContribution: dcPoints,
    bonus: stats.bonus,
    cardsLost: -stats.yellowCards - 3 * stats.redCards,
  };
}
