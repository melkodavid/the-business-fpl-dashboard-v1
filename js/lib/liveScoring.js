// Live gameweek scoring -- pure logic, no DOM, so it runs in node tests too.
//
// Input is the compact payload the Apps Script relay returns for `?action=live`
// (see scripts/predictions/Code.gs, live_()):
//   { gw, finished, matches: [[homeId, awayId]], picks: { managerId: [[element, position]] },
//     players: { element: [name, type, teamId] }, teams: { teamId: "ARS" },
//     el: { element: [points, minutes, confirmedBonus] },
//     fixtures: [{ id, h, a, hs, as, k, st, fin, bon, bps: [[element, value]] }] }
//
// Draft has no captains or chips; a manager's score is their XI after
// automatic substitutions, and bench points are the cup's first tie-breaker.

export const POS = { 1: "GKP", 2: "DEF", 3: "MID", 4: "FWD" };
const MIN_IN_XI = { 2: 3, 3: 2, 4: 1 }; // DEF / MID / FWD floors (always exactly one GK)

// Provisional bonus from a fixture's BPS leaders, FPL style: ties share the
// higher award and push the next player down (two tied first -> 3, 3, then 1).
export function provisionalBonus(bpsList) {
  const awards = new Map();
  for (const [element, value] of bpsList ?? []) {
    const rank = 1 + bpsList.filter(([, v]) => v > value).length;
    const bonus = rank === 1 ? 3 : rank === 2 ? 2 : rank === 3 ? 1 : 0;
    if (bonus) awards.set(element, bonus);
  }
  return awards;
}

// Map<teamId, { state: "yet"|"live"|"done"|"blank", fixtures: [...] }>.
// "done" means every one of the team's fixtures is over; a double-gameweek
// team with one game left is "yet" (more to come) even if one is done.
export function teamStates(fixtures, teamIds) {
  const out = new Map();
  for (const team of teamIds) {
    const mine = fixtures.filter((f) => f.h === team || f.a === team);
    let state = "blank";
    if (mine.length) {
      if (mine.every((f) => f.fin)) state = "done";
      else if (mine.some((f) => f.st && !f.fin)) state = "live";
      else state = "yet";
    }
    out.set(team, { state, fixtures: mine });
  }
  return out;
}

// One player's live line: points include provisional bonus from any of their
// team's fixtures whose bonus hasn't been confirmed yet.
function playerLine(element, position, payload, states, bonusByFixture) {
  const [name, type, team] = payload.players[element] ?? [`#${element}`, 3, 0];
  const [points, minutes] = payload.el[element] ?? [0, 0];
  const teamState = states.get(team) ?? { state: "blank", fixtures: [] };
  let bonus = 0;
  for (const f of teamState.fixtures) {
    if (f.st && !f.bon) bonus += bonusByFixture.get(f.id)?.get(element) ?? 0;
  }
  const state = teamState.state;
  const next = teamState.fixtures.filter((f) => !f.st).map((f) => f.k).sort()[0] ?? null;
  return {
    element, position, name, type, pos: POS[type], team: payload.teams[team] ?? "",
    minutes, bonus, points: points + bonus, state, kickoff: next,
    // certain not to feature: every fixture over (or none at all) and no minutes
    dnp: minutes === 0 && (state === "done" || state === "blank"),
  };
}

// Draft auto-subs: a starter who certainly didn't play is replaced by the first
// bench player (in bench order) who did -- or still could -- play, as long as
// the formation stays legal. The bench goalkeeper only covers the goalkeeper.
export function applyAutoSubs(starters, bench) {
  const xi = [...starters];
  const subs = [];
  const used = new Set();
  const count = (list, type) => list.filter((p) => p.type === type).length;

  for (let i = 0; i < xi.length; i++) {
    const out = xi[i];
    if (!out.dnp) continue;
    for (const cand of bench) {
      if (used.has(cand.element) || cand.dnp) continue;
      if ((out.type === 1) !== (cand.type === 1)) continue;
      const trial = xi.map((p, j) => (j === i ? cand : p));
      const legal = Object.entries(MIN_IN_XI).every(([type, min]) => count(trial, Number(type)) >= min);
      if (!legal) continue;
      xi[i] = cand;
      used.add(cand.element);
      subs.push({ out: out.element, in: cand.element, pending: cand.state !== "done" && cand.minutes === 0 });
      break;
    }
  }
  const benchLeft = bench.filter((p) => !used.has(p.element));
  return { xi, bench: benchLeft, subs };
}

// Everything the page needs for one manager.
// `ep` is Map<element, expected points> for players still to play (projection).
export function managerLive(managerId, payload, { ep = new Map(), states, bonusByFixture } = {}) {
  const picks = [...(payload.picks[managerId] ?? [])].sort((a, b) => a[1] - b[1]);
  const lines = picks.map(([element, position]) => playerLine(element, position, payload, states, bonusByFixture));
  const { xi, bench, subs } = applyAutoSubs(lines.filter((p) => p.position <= 11), lines.filter((p) => p.position > 11));
  const subbedIn = new Set(subs.map((s) => s.in));
  const subbedOut = new Set(subs.map((s) => s.out));
  const sum = (list) => list.reduce((t, p) => t + p.points, 0);
  const points = sum(xi);
  const toPlay = xi.filter((p) => p.state === "yet").length;
  const playing = xi.filter((p) => p.state === "live").length;
  const projected = points + xi.filter((p) => p.state === "yet").reduce((t, p) => t + (ep.get(p.element) ?? 2), 0);
  return {
    managerId, points, benchPoints: sum(bench), projected: Math.round(projected),
    // any of their 15 has kicked off (a blank-gameweek team doesn't count)
    started: lines.some((p) => p.state === "live" || p.state === "done"),
    toPlay, playing, done: xi.length - toPlay - playing,
    xi: xi.map((p) => ({ ...p, subIn: subbedIn.has(p.element) })),
    bench: lines.filter((p) => p.position > 11).map((p) => ({ ...p, subOut: false, usedAsSub: subbedIn.has(p.element) })),
    subbedOff: lines.filter((p) => subbedOut.has(p.element)),
    subs, hasPicks: picks.length > 0,
  };
}

// Normal-CDF via the Abramowitz-Stegun erf approximation -- plenty for odds.
function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152072) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

// Live win chance from projected finals; the uncertainty shrinks as fewer
// players are left to play, and collapses to a certainty when nobody is.
export function liveWinPct(home, away, sigma = 9.6) {
  const left = (home.toPlay + home.playing + away.toPlay + away.playing) / 22;
  const diff = home.projected - away.projected;
  if (left === 0) return diff > 0 ? 100 : diff < 0 ? 0 : 50;
  const s = Math.max(sigma * Math.sqrt(left), 1.5);
  return Math.round(phi(diff / s) * 100);
}

// Whole-league view: every manager's live line, each H2H match, and fixtures.
export function computeLive(payload, { ep = new Map(), sigma } = {}) {
  const teamIds = new Set(Object.values(payload.players).map((p) => p[2]));
  for (const f of payload.fixtures) { teamIds.add(f.h); teamIds.add(f.a); }
  const states = teamStates(payload.fixtures, teamIds);
  const bonusByFixture = new Map(payload.fixtures.map((f) => [f.id, provisionalBonus(f.bps)]));
  const managers = new Map(
    Object.keys(payload.picks).map((id) => [Number(id), managerLive(Number(id), payload, { ep, states, bonusByFixture })])
  );
  const matches = payload.matches.map(([homeId, awayId]) => {
    const home = managers.get(homeId);
    const away = managers.get(awayId);
    const winPct = home && away ? liveWinPct(home, away, sigma) : 50;
    return { homeId, awayId, home, away, winPct };
  });
  const fixturesDone = payload.fixtures.filter((f) => f.fin).length;
  return { gw: payload.gw, managers, matches, fixturesDone, fixturesTotal: payload.fixtures.length, anyStarted: payload.fixtures.some((f) => f.st) };
}

// The league table as it would stand if every live score held.
// `rows` are standings rows (managerId, total, pointsFor, rank); the live GW is
// only added when the stored table doesn't already include it.
// Each row's `result` (W/D/L) comes from the match itself, so it reads right
// whether or not the stored table already counts this gameweek; it stays null
// until at least one player in the match has kicked off.
export function liveTable(rows, matches, { includesGw = false } = {}) {
  const add = new Map();
  const result = new Map();
  for (const m of matches) {
    if (!m.home || !m.away || !(m.home.started || m.away.started)) continue;
    const h = m.home.points, a = m.away.points;
    result.set(m.homeId, h > a ? "W" : h === a ? "D" : "L");
    result.set(m.awayId, a > h ? "W" : h === a ? "D" : "L");
    if (includesGw) continue;
    add.set(m.homeId, { pts: h > a ? 3 : h === a ? 1 : 0, pf: h });
    add.set(m.awayId, { pts: a > h ? 3 : h === a ? 1 : 0, pf: a });
  }
  const live = rows.map((r) => {
    const extra = add.get(r.managerId) ?? { pts: 0, pf: 0 };
    return { ...r, liveTotal: r.total + extra.pts, livePointsFor: r.pointsFor + extra.pf, result: result.get(r.managerId) ?? null };
  });
  live.sort((x, y) => y.liveTotal - x.liveTotal || y.livePointsFor - x.livePointsFor);
  return live.map((r, i) => ({ ...r, liveRank: i + 1, move: r.rank - (i + 1) }));
}

// A cup tie as it stands: this gameweek's live score plus any earlier legs,
// falling through the cup's tie-breakers (bench points, then seed).
export function cupTieLive(tie, managers, { legs = {}, liveGw, seeds = new Map() } = {}) {
  const earlier = (id) => Object.entries(legs).filter(([gw]) => Number(gw) !== liveGw).reduce((t, [, scores]) => t + (scores[id] ?? 0), 0);
  const a = managers.get(tie.managerAId);
  const b = managers.get(tie.managerBId);
  const scoreA = (a?.points ?? 0) + earlier(tie.managerAId);
  const scoreB = (b?.points ?? 0) + earlier(tie.managerBId);
  let leaderId = null, by = null;
  if (scoreA !== scoreB) leaderId = scoreA > scoreB ? tie.managerAId : tie.managerBId;
  else if ((a?.benchPoints ?? 0) !== (b?.benchPoints ?? 0)) { leaderId = a.benchPoints > b.benchPoints ? tie.managerAId : tie.managerBId; by = "bench"; }
  else { leaderId = (seeds.get(tie.managerAId) ?? 99) < (seeds.get(tie.managerBId) ?? 99) ? tie.managerAId : tie.managerBId; by = "seed"; }
  return { ...tie, a, b, scoreA, scoreB, leaderId, by, twoLegs: Object.keys(legs).length > 0 };
}
