import { test } from "node:test";
import assert from "node:assert/strict";
import { provisionalBonus, teamStates, applyAutoSubs, computeLive, liveTable, cupTieLive, liveWinPct } from "../../js/lib/liveScoring.js";

test("provisional bonus: 3-2-1, ties share and push the next player down", () => {
  assert.deepEqual([...provisionalBonus([[1, 40], [2, 30], [3, 20], [4, 10]])], [[1, 3], [2, 2], [3, 1]]);
  assert.deepEqual([...provisionalBonus([[1, 40], [2, 40], [3, 20]])], [[1, 3], [2, 3], [3, 1]]);
  assert.deepEqual([...provisionalBonus([[1, 40], [2, 40], [3, 40], [4, 20]])], [[1, 3], [2, 3], [3, 3]]);
  assert.deepEqual([...provisionalBonus([[1, 40], [2, 30], [3, 30], [4, 20]])], [[1, 3], [2, 2], [3, 2]]);
});

test("team states: yet / live / done / blank, and a double gameweek with a game left is still to come", () => {
  const fx = [{ id: 1, h: 1, a: 2, st: true, fin: true }, { id: 2, h: 3, a: 4, st: true, fin: false }, { id: 3, h: 5, a: 1, st: false, fin: false }, { id: 4, h: 6, a: 7, st: false, fin: false }];
  const s = teamStates(fx, [1, 2, 3, 6, 9]);
  assert.equal(s.get(2).state, "done");
  assert.equal(s.get(3).state, "live");
  assert.equal(s.get(6).state, "yet");
  assert.equal(s.get(1).state, "yet"); // one done, one to come
  assert.equal(s.get(9).state, "blank");
});

const p = (element, type, extra = {}) => ({ element, type, points: 2, minutes: 90, dnp: false, state: "done", ...extra });

test("auto-subs: first eligible bench player in order, skipping ones who can't keep the formation legal", () => {
  // 3 DEF starters, one of them didn't play; bench order: MID, DEF -> the MID would leave 2 DEF, so the DEF comes on
  const starters = [p(1, 1), p(2, 2, { dnp: true, minutes: 0, points: 0 }), p(3, 2), p(4, 2), p(5, 3), p(6, 3), p(7, 3), p(8, 3), p(9, 3), p(10, 4), p(11, 4)];
  const bench = [p(12, 1), p(13, 3, { points: 6 }), p(14, 2, { points: 1 }), p(15, 4)];
  const { xi, subs, bench: left } = applyAutoSubs(starters, bench);
  assert.deepEqual(subs.map((s) => [s.out, s.in]), [[2, 14]]);
  assert.ok(xi.some((x) => x.element === 14));
  assert.deepEqual(left.map((x) => x.element), [12, 13, 15]);
});

test("auto-subs: goalkeeper only for goalkeeper, bench players who also didn't play are skipped, live starters are never subbed", () => {
  const starters = [p(1, 1, { dnp: true, minutes: 0 }), p(2, 2, { state: "live", minutes: 0 }), p(3, 2), p(4, 2), p(5, 3, { dnp: true, minutes: 0 }), p(6, 3), p(7, 3), p(8, 3), p(9, 4), p(10, 4), p(11, 4)];
  const bench = [p(12, 1, { dnp: true, minutes: 0 }), p(13, 3, { dnp: true, minutes: 0 }), p(14, 4, { state: "yet", minutes: 0 }), p(15, 2)];
  const { subs } = applyAutoSubs(starters, bench);
  // keeper: bench keeper didn't play either -> no sub; MID 5: 13 didn't play, 14 hasn't played yet -> provisional sub
  assert.deepEqual(subs.map((s) => [s.out, s.in, s.pending]), [[5, 14, true]]);
});

// two managers, two PL fixtures (one finished, one not started)
const payload = {
  gw: 9, finished: false,
  matches: [[100, 200]],
  teams: { 1: "ARS", 2: "CHE", 3: "LIV", 4: "MCI" },
  players: {},
  el: {},
  picks: { 100: [], 200: [] },
  fixtures: [
    { id: 1, h: 1, a: 2, hs: 2, as: 0, st: true, fin: true, bon: false, bps: [[1, 50], [2, 30], [3, 25]] },
    { id: 2, h: 3, a: 4, hs: 0, as: 0, st: false, fin: false, bon: false, bps: [] },
  ],
};
// manager 100: all Arsenal/Chelsea (done). manager 200: all Liverpool/City (to come)
for (let i = 1; i <= 15; i++) {
  const type = i === 1 || i === 12 ? 1 : i <= 5 || i === 15 ? 2 : i <= 9 || i === 13 ? 3 : 4;
  payload.players[i] = [`A${i}`, type, i % 2 ? 1 : 2];
  payload.el[i] = [i === 4 ? 0 : 5, i === 4 ? 0 : 90, 0];
  payload.picks[100].push([i, i]);
  payload.players[100 + i] = [`B${i}`, type, i % 2 ? 3 : 4];
  payload.el[100 + i] = [0, 0, 0];
  payload.picks[200].push([100 + i, i]);
}

test("computeLive: scores with provisional bonus and an auto-sub, projection for players still to play", () => {
  const live = computeLive(payload, { ep: new Map([[101, 6]]) });
  const a = live.managers.get(100);
  // 10 starters played for 5 each = 50, plus provisional bonus 3 (el 1) + 2 (el 2) + 1 (el 3);
  // element 4 (DEF) didn't play -> first bench outfielder 13 (MID) keeps 4 DEF, comes on for 5
  assert.equal(a.subs.length, 1);
  assert.deepEqual([a.subs[0].out, a.subs[0].in], [4, 13]);
  assert.equal(a.points, 55 + 6);
  assert.equal(a.toPlay, 0);
  const b = live.managers.get(200);
  assert.equal(b.points, 0);
  assert.equal(b.toPlay, 11);
  assert.equal(b.projected, 6 + 10 * 2);
  assert.ok(live.matches[0].winPct > 50); // home far ahead
  assert.equal(live.fixturesDone, 1);
});

test("live win chance is a certainty when nobody is left to play", () => {
  const done = { toPlay: 0, playing: 0 };
  assert.equal(liveWinPct({ ...done, projected: 50 }, { ...done, projected: 40 }), 100);
  assert.equal(liveWinPct({ ...done, projected: 40 }, { ...done, projected: 40 }), 50);
});

test("live table adds this week's result unless the stored table already has it", () => {
  const rows = [{ managerId: 1, rank: 1, total: 12, pointsFor: 300 }, { managerId: 2, rank: 2, total: 12, pointsFor: 280 }];
  const matches = [{ homeId: 2, awayId: 1, home: { points: 60, started: true }, away: { points: 40, started: true } }];
  const t = liveTable(rows, matches);
  assert.deepEqual(t.map((r) => [r.managerId, r.liveTotal, r.liveRank, r.move, r.result]), [[2, 15, 1, 1, "W"], [1, 12, 2, -1, "L"]]);
  // already counted: no extra points, but the W/L still shows (it used to read "L" for everyone)
  assert.deepEqual(liveTable(rows, matches, { includesGw: true }).map((r) => [r.liveTotal, r.result]), [[12, "L"], [12, "W"]]);
});

test("live table shows no result for a match nobody has kicked off in yet", () => {
  const rows = [{ managerId: 1, rank: 1, total: 12, pointsFor: 300 }, { managerId: 2, rank: 2, total: 9, pointsFor: 280 }];
  const notYet = [{ homeId: 1, awayId: 2, home: { points: 0, started: false }, away: { points: 0, started: false } }];
  assert.deepEqual(liveTable(rows, notYet).map((r) => [r.liveTotal, r.result]), [[12, null], [9, null]]);
});

test("cup tie: earlier legs add up, then bench points, then seed decide who is through", () => {
  const m = new Map([[1, { points: 50, benchPoints: 4 }], [2, { points: 45, benchPoints: 9 }]]);
  const tie = { managerAId: 1, managerBId: 2 };
  assert.equal(cupTieLive(tie, m, { liveGw: 19 }).leaderId, 1);
  const twoLegs = cupTieLive(tie, m, { liveGw: 19, legs: { 18: { 1: 40, 2: 50 } } });
  assert.deepEqual([twoLegs.scoreA, twoLegs.scoreB, twoLegs.leaderId, twoLegs.by], [90, 95, 2, null]);
  const level = cupTieLive(tie, new Map([[1, { points: 50, benchPoints: 4 }], [2, { points: 50, benchPoints: 9 }]]), { liveGw: 9 });
  assert.deepEqual([level.leaderId, level.by], [2, "bench"]);
  const dead = cupTieLive(tie, new Map([[1, { points: 50, benchPoints: 4 }], [2, { points: 50, benchPoints: 4 }]]), { liveGw: 9, seeds: new Map([[1, 7], [2, 3]]) });
  assert.deepEqual([dead.leaderId, dead.by], [2, "seed"]);
});
