// Turns a player's per-stat points (see aggregateBreakdown in context.js) into
// the short, human-readable pieces shown next to a score, e.g.
//   [{ text: "2 goals", points: 10 }, { text: "clean sheet", points: 4 }]
// Appearance points are left out on purpose -- they're a constant 1-2 and
// would just add noise to "how did he get 13?".
const plural = (n, one, many) => (n === 1 ? one : `${n} ${many}`);

const DESCRIBE = {
  goals_scored: (n) => plural(n, "goal", "goals"),
  assists: (n) => plural(n, "assist", "assists"),
  clean_sheets: () => "clean sheet",
  bonus: (n) => `${n} bonus`,
  defensive_contribution: () => "defensive contribution",
  saves: (n) => plural(n, "save", "saves"),
  penalties_saved: (n) => plural(n, "penalty save", "penalty saves"),
  penalties_missed: (n) => plural(n, "missed penalty", "missed penalties"),
  own_goals: (n) => plural(n, "own goal", "own goals"),
  yellow_cards: (n) => plural(n, "yellow card", "yellow cards"),
  red_cards: (n) => plural(n, "red card", "red cards"),
  goals_conceded: (n) => plural(n, "goal conceded", "goals conceded"),
};

export function describeScoring(breakdown = []) {
  return breakdown
    .filter((b) => b.stat !== "minutes" && b.points !== 0 && DESCRIBE[b.stat])
    .map((b) => ({ text: DESCRIBE[b.stat](b.value), points: b.points }))
    .sort((a, b) => b.points - a.points);
}
