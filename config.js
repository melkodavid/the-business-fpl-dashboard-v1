// League configuration. Edit these two values once the season's league exists —
// everything else works unmodified. See README.md for the full setup walkthrough.
export default {
  // The Draft league ID from the league's URL on draft.premierleague.com.
  LEAGUE_ID: 4888,

  // The gameweek(s) assigned to each FA Cup round. Round 1 and Round 4 are a
  // single gameweek; Round 2 and Round 3 are two-gameweek aggregates. Pick these
  // once the season's fixture list is published, after checking none of them land
  // on a known blank/double gameweek for a team that could still be alive in the
  // cup at that stage (see spec's FA Cup Ruleset section — this check can't be
  // automated reliably and must be done by hand).
  CUP_ROUND_GWS: {
    round1: [9],
    round2: [18, 19],
    round3: [27, 28],
    round4: [36],
  },
};
