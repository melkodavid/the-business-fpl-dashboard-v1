import { computeOptimalXI } from "../lib/optimalXI.js";

// Win / draw / loss chances for a gameweek's H2H fixtures, built from the
// official FPL expected points (ep_next / ep_this). Pure: everything it needs is
// passed in, so build.js owns the (failure-tolerant) network fetching.
//
// Pre-match, each manager's expected score is their best legal XI by expected
// points. Once a gameweek is under way it switches to a live estimate: points
// already scored by their actual starters plus what's still expected from
// players whose fixture hasn't finished. The two totals are compared with a
// normal approximation -- a score is a sum of many noisy player results, so the
// gap between two managers is roughly bell-shaped around the gap in expectation.
// This is a for-fun estimate, not a bookmaker's price.
export const DEFAULT_SIGMA = 11;
const SIGMA_RANGE = [8, 14];
const MIN_LIVE_SPREAD_SHARE = 0.08; // never let a nearly-finished week collapse to certainty

// Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf).
export function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
  const erf = 1 - poly * t * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + (z >= 0 ? erf : -erf));
}

// How much a manager's weekly score typically swings around their own average
// in this league (pooled across managers); the default until enough weeks exist.
export function estimateSigma(context) {
  const gws = context.finishedGws;
  if (gws.length < 3) return DEFAULT_SIGMA;

  let sumSq = 0;
  let dof = 0;
  for (const manager of context.managers.list) {
    const scores = gws.map((gw) => context.gwPicks[gw]?.[manager.id]?.totalPoints).filter((s) => Number.isFinite(s));
    if (scores.length < 3) continue;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    sumSq += scores.reduce((a, s) => a + (s - mean) ** 2, 0);
    dof += scores.length - 1;
  }
  if (dof === 0) return DEFAULT_SIGMA;
  const sigma = Math.sqrt(sumSq / dof);
  return Math.min(SIGMA_RANGE[1], Math.max(SIGMA_RANGE[0], sigma));
}

// P(home win), P(draw), P(away win) for expected scores muH/muA with spread s
// (difference of two independent teams). Scores are whole numbers, so a draw is
// a gap within half a point either side of zero.
export function outcomeProbabilities(muHome, muAway, spread) {
  const d = muHome - muAway;
  const homeWin = 1 - normalCdf((0.5 - d) / spread);
  const awayWin = normalCdf((-0.5 - d) / spread);
  const draw = Math.max(0, 1 - homeWin - awayWin);
  return { homeWin, draw, awayWin };
}

// Whole-percent split that always totals exactly 100 (largest remainder).
export function toPercents({ homeWin, draw, awayWin }) {
  const raw = [homeWin, draw, awayWin].map((p) => p * 100);
  const floors = raw.map(Math.floor);
  let short = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < short; k++) floors[order[k % 3][1]]++;
  return { home: floors[0], draw: floors[1], away: floors[2] };
}

function preMatchSide(context, squad, ep) {
  const roster = squad
    .map((elementId) => ({
      elementId,
      elementType: context.players.byId.get(elementId)?.elementType,
      points: ep.get(elementId) ?? 0,
    }))
    .filter((p) => p.elementType);
  const xi = computeOptimalXI(roster);
  return { expected: xi?.points ?? 0, remainingShare: 1, soFar: 0 };
}

function liveSide(starters, ep, live) {
  let soFar = 0;
  let remaining = 0;
  let totalExpected = 0;
  for (const elementId of starters) {
    const expected = ep.get(elementId) ?? 0;
    const left = live.remaining.get(elementId) ?? 1; // 0 = fixture(s) finished, 1 = not started
    soFar += live.points.get(elementId) ?? 0;
    remaining += expected * left;
    totalExpected += expected;
  }
  return { expected: soFar + remaining, remainingShare: totalExpected > 0 ? remaining / totalExpected : 0, soFar };
}

// Folds computeMatchupOdds()'s output onto the schedule's fixtures (matched by
// the home/away pair), plus a small `oddsMeta` block describing how the numbers
// were made. Fixtures with no odds simply keep no `odds` field.
export function attachOdds(schedule, odds) {
  const byPair = new Map(odds.fixtures.map((f) => [`${f.homeManagerId}:${f.awayManagerId}`, f]));
  for (const fixture of schedule.fixtures) {
    const o = byPair.get(`${fixture.homeManagerId}:${fixture.awayManagerId}`);
    if (!o) continue;
    fixture.odds = {
      homeWinPct: o.homeWinPct,
      drawPct: o.drawPct,
      awayWinPct: o.awayWinPct,
      homeExpected: o.homeExpected,
      awayExpected: o.awayExpected,
      homeSoFar: o.homeSoFar,
      awaySoFar: o.awaySoFar,
    };
  }
  schedule.oddsMeta = { source: odds.source, basis: odds.basis, sigma: odds.sigma };
  return schedule;
}

/**
 * @param context   the normalized build context (needs .players, .managers, .matches, .finishedGws, .gwPicks)
 * @param inputs    {
 *   gw, source,                              // label shown on the site, e.g. "FPL expected points (ep_next)"
 *   ep: Map<elementId, number>,              // expected points for `gw`
 *   squads: Map<managerId, elementId[]>,     // current 15-man squads
 *   live?: { starters: Map<managerId, elementId[]>,
 *            points: Map<elementId, number>,        // points scored so far this gw
 *            remaining: Map<elementId, number> }    // 0..1 share of the player's fixture(s) still to play
 * }
 * @returns { gw, source, sigma, basis, fixtures: [{ homeManagerId, awayManagerId, ... }] }
 */
export function computeMatchupOdds(context, inputs) {
  const { gw, ep, squads, live } = inputs;
  const sigma = estimateSigma(context);

  const sideFor = (managerId) => {
    if (live?.starters.has(managerId)) return liveSide(live.starters.get(managerId), ep, live);
    return preMatchSide(context, squads.get(managerId) ?? [], ep);
  };

  const fixtures = context.matches
    .filter((m) => m.event === gw)
    .map((m) => {
      const home = sideFor(m.homeManagerId);
      const away = sideFor(m.awayManagerId);
      const spreadOf = (side) => sigma * Math.sqrt(live ? Math.max(MIN_LIVE_SPREAD_SHARE, side.remainingShare) : 1);
      const spread = Math.sqrt(spreadOf(home) ** 2 + spreadOf(away) ** 2);
      const pct = toPercents(outcomeProbabilities(home.expected, away.expected, spread));
      return {
        homeManagerId: m.homeManagerId,
        awayManagerId: m.awayManagerId,
        homeExpected: Math.round(home.expected * 10) / 10,
        awayExpected: Math.round(away.expected * 10) / 10,
        homeSoFar: live ? home.soFar : null,
        awaySoFar: live ? away.soFar : null,
        homeWinPct: pct.home,
        drawPct: pct.draw,
        awayWinPct: pct.away,
      };
    });

  return { gw, source: inputs.source, sigma: Math.round(sigma * 10) / 10, basis: live ? "live" : "pre-match", fixtures };
}
