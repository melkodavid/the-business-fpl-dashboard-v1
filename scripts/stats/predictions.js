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
  const gws = [...new Set(picks.map((p) => p.gw))].sort((a, b) => a - b);
  const personIds = new Map(people.map((p) => [p.personKey, p.managerId]));

  const weeks = gws.map((gw) => {
    const fixtures = matches
      .filter((m) => m.event === gw)
      .map((m) => ({ key: fixtureKey(m), home: m.homeManagerId, away: m.awayManagerId, result: resultOf(m) }));
    const byPerson = {};
    for (const p of picks.filter((x) => x.gw === gw)) {
      if (!personIds.has(p.person) || !fixtures.some((f) => f.key === p.fixture)) continue;
      (byPerson[p.person] ??= {})[p.fixture] = p.pick;
    }
    return { gw, fixtures, picks: byPerson, complete: fixtures.length > 0 && fixtures.every((f) => f.result) };
  });

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

  return { weeks, table };
}
