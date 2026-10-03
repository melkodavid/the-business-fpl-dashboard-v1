import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeMatchupOdds, outcomeProbabilities, toPercents, normalCdf, estimateSigma, DEFAULT_SIGMA, predictLineups,
} from "../../scripts/stats/matchupOdds.js";

// 15-man squad: 2 GK, 5 DEF, 5 MID, 3 FWD, element ids base..base+14
function squadWith(base, pointsEach) {
  const types = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
  return { ids: types.map((_, i) => base + i), types, pointsEach };
}

function buildContext() {
  const players = new Map();
  for (const base of [100, 200]) {
    squadWith(base, 0).types.forEach((t, i) => players.set(base + i, { elementType: t }));
  }
  return {
    players: { byId: players },
    managers: { list: [{ id: 1 }, { id: 2 }] },
    matches: [{ event: 6, homeManagerId: 1, awayManagerId: 2 }],
    finishedGws: [],
    gwPicks: {},
  };
}

function epFor(base, value) {
  return new Map(squadWith(base, value).ids.map((id) => [id, value]));
}

test("normalCdf: symmetric, 0.5 at zero, ~0.8413 at one sigma", () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(normalCdf(1) - 0.8413) < 1e-3);
  assert.ok(Math.abs(normalCdf(-1) - (1 - normalCdf(1))) < 1e-9);
});

test("outcome probabilities are a proper split, and an even match is symmetric", () => {
  const even = outcomeProbabilities(50, 50, 15);
  assert.ok(Math.abs(even.homeWin - even.awayWin) < 1e-9);
  assert.ok(Math.abs(even.homeWin + even.draw + even.awayWin - 1) < 1e-9);
  assert.ok(even.draw > 0 && even.draw < 0.06);

  const mismatch = outcomeProbabilities(60, 45, 15);
  assert.ok(mismatch.homeWin > 0.7);
  assert.ok(mismatch.awayWin < 0.3);
});

test("toPercents always totals exactly 100", () => {
  for (const triple of [[0.3333, 0.3333, 0.3334], [0.499, 0.021, 0.48], [0.9, 0.04, 0.06], [0.001, 0.003, 0.996]]) {
    const p = toPercents({ homeWin: triple[0], draw: triple[1], awayWin: triple[2] });
    assert.equal(p.home + p.draw + p.away, 100);
  }
});

test("pre-match: the side with higher expected points is the favourite, and the figures reflect the best XI", () => {
  const ctx = buildContext();
  const ep = new Map([...epFor(100, 5), ...epFor(200, 3)]);
  const squads = new Map([[1, squadWith(100, 5).ids], [2, squadWith(200, 3).ids]]);
  const odds = computeMatchupOdds(ctx, { gw: 6, ep, squads, source: "test" });
  const f = odds.fixtures[0];
  assert.equal(f.homeExpected, 55); // 11 starters x 5
  assert.equal(f.awayExpected, 33);
  assert.ok(f.homeWinPct > 85);
  assert.equal(f.homeWinPct + f.drawPct + f.awayWinPct, 100);
  assert.equal(odds.basis, "pre-match");
});

test("identical squads are a coin flip with a small draw chance", () => {
  const ctx = buildContext();
  const ep = new Map([...epFor(100, 4), ...epFor(200, 4)]);
  const squads = new Map([[1, squadWith(100, 4).ids], [2, squadWith(200, 4).ids]]);
  const f = computeMatchupOdds(ctx, { gw: 6, ep, squads, source: "test" }).fixtures[0];
  assert.ok(Math.abs(f.homeWinPct - f.awayWinPct) <= 1);
  assert.ok(f.drawPct <= 5);
});

test("live: points already scored plus remaining expectation, and a nearly-finished lead is far firmer than the pre-match one", () => {
  const ctx = buildContext();
  const ep = new Map([...epFor(100, 4), ...epFor(200, 4)]);
  const squads = new Map([[1, squadWith(100, 4).ids], [2, squadWith(200, 4).ids]]);
  const startersFor = (base) => squadWith(base, 0).ids.slice(0, 11);

  const pre = computeMatchupOdds(ctx, { gw: 6, ep, squads, source: "test" }).fixtures[0];

  // Everything finished (remaining 0): home has scored 50, away 40.
  const points = new Map();
  const remaining = new Map();
  startersFor(100).forEach((id, i) => { points.set(id, i < 10 ? 5 : 0); remaining.set(id, 0); });
  startersFor(200).forEach((id, i) => { points.set(id, i < 10 ? 4 : 0); remaining.set(id, 0); });
  const live = {
    starters: new Map([[1, startersFor(100)], [2, startersFor(200)]]),
    points,
    remaining,
  };
  const odds = computeMatchupOdds(ctx, { gw: 6, ep, squads, live, source: "test" });
  const f = odds.fixtures[0];
  assert.equal(odds.basis, "live");
  assert.equal(f.homeExpected, 50);
  assert.equal(f.awayExpected, 40);
  assert.equal(f.homeSoFar, 50);
  assert.ok(f.homeWinPct > 95, `a 10-point lead with nothing left to play should be ~certain, got ${f.homeWinPct}`);
  assert.ok(f.homeWinPct > pre.homeWinPct);
});

test("estimateSigma: default with too little history, otherwise the league's own weekly swing within sensible bounds", () => {
  assert.equal(estimateSigma({ finishedGws: [1, 2], managers: { list: [] }, gwPicks: {} }), DEFAULT_SIGMA);

  const gwPicks = {};
  [1, 2, 3, 4, 5].forEach((gw, i) => {
    gwPicks[gw] = { 1: { totalPoints: 40 + (i % 2 ? 6 : -6) }, 2: { totalPoints: 50 + (i % 2 ? 6 : -6) } };
  });
  const sigma = estimateSigma({ finishedGws: [1, 2, 3, 4, 5], managers: { list: [{ id: 1 }, { id: 2 }] }, gwPicks });
  assert.ok(sigma >= 8 && sigma <= 14);
});

test("predictLineups: best legal XI by expected points, formation, bench and star man", () => {
  const ctx = buildContext();
  for (const [id, p] of ctx.players.byId) p.webName = `P${id}`;
  const ep = epFor(100, 2);
  ep.set(100, 5); // the first keeper outscores the second
  ep.set(112, 9); // a forward is the top scorer
  const squads = new Map([[1, squadWith(100, 0).ids], [2, squadWith(200, 0).ids]]);
  const lineups = predictLineups(ctx, { ep, squads });
  const lu = lineups[1];
  assert.equal(lu.xi.length, 11);
  assert.equal(lu.bench.length, 4);
  assert.equal(lu.xi.filter((p) => p.type === 1).length, 1);
  assert.equal(lu.xi[0].id, 100); // best keeper starts
  assert.equal(lu.captainId, 112);
  assert.match(lu.formation, /^\d-\d-\d$/);
  assert.equal(lu.formation.split("-").reduce((s, n) => s + Number(n), 0), 10);
  assert.equal(lu.locked, false);
});
