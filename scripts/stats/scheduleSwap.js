// Schedule swap: "what if manager A had manager B's schedule?" Every finished
// week, A keeps their own score but faces whoever B actually faced that week.
// When B's opponent was A themselves, A faces B instead (the usual convention).
//
// Only A's own results change in the what-if: everyone else's record is left as
// it really is, so a swapped rank is an estimate -- it places A's new points
// among the real table.
//
// Also ranks the schedules themselves by the plain measure everyone understands:
// the average score of the opponents faced (lower = easier). Each manager's
// "schedule luck" is their real points minus the average they'd have earned with
// the same scores on every other schedule.

const WIN = 3;
const DRAW = 1;

const resultOf = (mine, theirs) => (mine > theirs ? "W" : mine < theirs ? "L" : "D");
const round1 = (n) => Math.round(n * 10) / 10;

export function computeScheduleSwap(context) {
  const ids = context.managers.list.map((m) => m.id);
  const finished = context.matches.filter((m) => m.finished);
  const gws = [...new Set(finished.map((m) => m.event))].sort((a, b) => a - b);

  // score[gw][id], opp[gw][id]
  const score = {};
  const opp = {};
  for (const m of finished) {
    (score[m.event] ??= {})[m.homeManagerId] = m.homePoints;
    (score[m.event] ??= {})[m.awayManagerId] = m.awayPoints;
    (opp[m.event] ??= {})[m.homeManagerId] = m.awayManagerId;
    (opp[m.event] ??= {})[m.awayManagerId] = m.homeManagerId;
  }

  const actual = {};
  for (const id of ids) {
    let w = 0, d = 0, l = 0, pointsFor = 0;
    for (const gw of gws) {
      if (score[gw]?.[id] === undefined) continue;
      pointsFor += score[gw][id];
      const r = resultOf(score[gw][id], score[gw][opp[gw][id]]);
      if (r === "W") w++; else if (r === "D") d++; else l++;
    }
    actual[id] = { w, d, l, pts: w * WIN + d * DRAW, pointsFor };
  }

  const rankOf = (id, pts, pointsFor) => 1 + ids.filter((o) => o !== id && (actual[o].pts > pts || (actual[o].pts === pts && actual[o].pointsFor > pointsFor))).length;
  for (const id of ids) actual[id].rank = rankOf(id, actual[id].pts, actual[id].pointsFor);

  const matrix = {};
  for (const a of ids) {
    matrix[a] = {};
    for (const b of ids) {
      let w = 0, d = 0, l = 0;
      const weeks = [];
      for (const gw of gws) {
        const mine = score[gw]?.[a];
        if (mine === undefined) continue;
        const realOpp = opp[gw][a];
        let swappedOpp = a === b ? realOpp : opp[gw][b];
        if (swappedOpp === a) swappedOpp = b; // B's opponent was A themselves
        const theirs = score[gw][swappedOpp];
        const result = resultOf(mine, theirs);
        if (result === "W") w++; else if (result === "D") d++; else l++;
        weeks.push({
          gw, score: mine,
          realOpp, realOppScore: score[gw][realOpp], realResult: resultOf(mine, score[gw][realOpp]),
          opp: swappedOpp, oppScore: theirs, result,
        });
      }
      const pts = w * WIN + d * DRAW;
      matrix[a][b] = { w, d, l, pts, rank: rankOf(a, pts, actual[a].pointsFor), weeks };
    }
  }

  const schedules = ids.map((b) => {
    const others = ids.filter((a) => a !== b);
    const avgPtsForOthers = others.reduce((s, a) => s + matrix[a][b].pts, 0) / (others.length || 1);
    const oppScores = gws.map((gw) => score[gw]?.[opp[gw]?.[b]]).filter((v) => v !== undefined);
    const avgPtsOverOthers = others.reduce((s, other) => s + matrix[b][other].pts, 0) / (others.length || 1);
    return {
      managerId: b,
      avgPtsForOthers: round1(avgPtsForOthers),
      oppAvgScore: oppScores.length ? round1(oppScores.reduce((s, v) => s + v, 0) / oppScores.length) : null,
      actualPts: actual[b].pts,
      avgPtsOnAnySchedule: round1(avgPtsOverOthers),
      scheduleLuck: round1(actual[b].pts - avgPtsOverOthers),
    };
  });
  const byEase = [...schedules].sort((x, y) => (x.oppAvgScore ?? Infinity) - (y.oppAvgScore ?? Infinity) || y.avgPtsForOthers - x.avgPtsForOthers);
  byEase.forEach((s, i) => { s.easeRank = i + 1; });

  return {
    gws,
    managerIds: ids,
    actual,
    matrix,
    leagueAvgScore: round1(schedules.reduce((a, x) => a + (x.oppAvgScore ?? 0), 0) / (schedules.length || 1)),
    schedules: byEase,
    easiestId: byEase[0]?.managerId ?? null,
    hardestId: byEase.at(-1)?.managerId ?? null,
  };
}
