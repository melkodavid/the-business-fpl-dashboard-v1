// Weekly predictions: each person calls Home / Draw / Away for every fixture of a
// gameweek before its deadline; one point per correct call. This turns the
// revealed picks (the shared sheet only releases a week's picks once its
// deadline has passed -- see scripts/predictions/Code.gs) into the running table.
//
// A pick is { gw, person, fixture, pick } where `fixture` is "{homeId}-{awayId}"
// and `pick` is "H" | "D" | "A".

export const fixtureKey = (m) => `${m.homeManagerId}-${m.awayManagerId}`;

export function resultOf(match) {
  if (!match.finished) return null;
  if (match.homePoints > match.awayPoints) return "H";
  if (match.homePoints < match.awayPoints) return "A";
  return "D";
}

// The single most popular call on a fixture, or null if the top spot is tied
// (a "bold call" only counts against a clear crowd favourite).
function crowdPick(calls) {
  const counts = { H: 0, D: 0, A: 0 };
  for (const pick of calls) counts[pick]++;
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > ranked[1][1] ? ranked[0][0] : null;
}

const MIN_CROWD = 4; // need at least this many callers for a crowd to disagree with

/**
 * @param matches  context.matches
 * @param picks    revealed picks (see above)
 * @param people   [{ personKey, managerId }] -- everyone who can play
 */
export function computePredictions(matches, picks, people) {
  const leaguePicks = picks.filter((p) => !isPlKey(p.fixture));
  const gws = [...new Set(leaguePicks.map((p) => p.gw))].sort((a, b) => a - b);
  const weeks = gws.map((gw) => weekOf(gw, matches
    .filter((m) => m.event === gw)
    .map((m) => ({ key: fixtureKey(m), home: m.homeManagerId, away: m.awayManagerId, result: resultOf(m) })), leaguePicks, people));
  return { weeks, table: scoreWeeks(weeks, people) };
}

// ---------------------------------------------------------------------------
// Premier League results: the same game played on the real fixtures. Picks
// share the sheet with the league game, told apart by their "pl{fixtureId}" key.
// ---------------------------------------------------------------------------
export const plFixtureKey = (f) => `pl${f.id}`;
export const isPlKey = (key) => /^pl\d+$/.test(key);

export function plResultOf(f) {
  if (!(f.finished || f.finished_provisional) || f.team_h_score == null || f.team_a_score == null) return null;
  return f.team_h_score > f.team_a_score ? "H" : f.team_h_score < f.team_a_score ? "A" : "D";
}

/**
 * @param fixtures  Premier League fixtures in the FPL API shape
 *                  ({ id, event, team_h, team_a, team_h_score, team_a_score, kickoff_time, finished })
 * @param picks     revealed picks -- only the "pl…" ones are used
 * @param people    [{ personKey, managerId }]
 */
export function computePlPredictions(fixtures, picks, people) {
  const plPicks = picks.filter((p) => isPlKey(p.fixture));
  const gws = [...new Set(plPicks.map((p) => p.gw))].sort((a, b) => a - b);
  const weeks = gws.map((gw) => weekOf(gw, plFixturesFor(fixtures, gw).map((f) => ({
    key: plFixtureKey(f), home: f.team_h, away: f.team_a,
    score: plResultOf(f) ? [f.team_h_score, f.team_a_score] : null, result: plResultOf(f),
  })), plPicks, people));
  return { weeks, table: scoreWeeks(weeks, people) };
}

// One gameweek's Premier League fixtures in kickoff order.
export function plFixturesFor(fixtures, gw) {
  return fixtures
    .filter((f) => f.event === gw)
    .sort((a, b) => String(a.kickoff_time).localeCompare(String(b.kickoff_time)) || a.id - b.id);
}

function weekOf(gw, fixtures, picks, people) {
  const known = new Set(people.map((p) => p.personKey));
  const byPerson = {};
  for (const p of picks.filter((x) => x.gw === gw)) {
    if (!known.has(p.person) || !fixtures.some((f) => f.key === p.fixture)) continue;
    (byPerson[p.person] ??= {})[p.fixture] = p.pick;
  }
  return { gw, fixtures, picks: byPerson, complete: fixtures.length > 0 && fixtures.every((f) => f.result) };
}

// Weeks of { fixtures: [{ key, result }], picks: { person: { key: pick } } } ->
// the running table. Shared by both games.
function scoreWeeks(weeks, people) {
  const stats = new Map(people.map((p) => [p.personKey, {
    personKey: p.personKey, managerId: p.managerId, played: 0, correct: 0, weeks: 0, bestWeek: 0, perfectWeeks: 0,
    streak: 0, bestStreak: 0, boldCalls: 0, boldHits: 0, byWeek: {},
  }]));

  for (const week of weeks) {
    // crowd favourite per fixture, from everyone's call that week
    const crowd = new Map(week.fixtures.map((f) => {
      const calls = Object.values(week.picks).map((p) => p[f.key]).filter(Boolean);
      return [f.key, calls.length >= MIN_CROWD ? crowdPick(calls) : null];
    }));

    for (const [person, called] of Object.entries(week.picks)) {
      const s = stats.get(person);
      let total = 0;
      let right = 0;
      for (const f of week.fixtures) {
        const pick = called[f.key];
        if (!pick || !f.result) continue; // not called, or not played yet
        total++;
        const hit = pick === f.result;
        if (hit) right++;
        s.streak = hit ? s.streak + 1 : 0;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        const fav = crowd.get(f.key);
        if (fav && pick !== fav) { s.boldCalls++; if (hit) s.boldHits++; }
      }
      if (total === 0) continue;
      s.played += total;
      s.correct += right;
      s.weeks++;
      s.bestWeek = Math.max(s.bestWeek, right);
      if (week.complete && total === week.fixtures.length && right === total) s.perfectWeeks++;
      s.byWeek[week.gw] = { correct: right, total };
    }
  }

  const table = [...stats.values()]
    .filter((s) => s.weeks > 0)
    .map((s) => ({ ...s, pct: s.played ? Math.round((s.correct / s.played) * 1000) / 10 : 0 }))
    .sort((a, b) => b.pct - a.pct || b.correct - a.correct || b.weeks - a.weeks);
  let lastKey = null;
  let lastRank = 0;
  table.forEach((row, i) => {
    const key = `${row.pct}|${row.correct}`;
    row.rank = key === lastKey ? lastRank : i + 1;
    lastKey = key;
    lastRank = row.rank;
  });

  return table;
}
