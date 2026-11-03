import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCup } from "../../scripts/cup/bracket.js";

// Round 1 (GW9): four ties among ids 5..12; ids 1..4 have byes.
const managers = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, personKey: `p${i + 1}` }));
const rounds = { round1: [9], round2: [18, 19], round3: [27, 28], round4: [36] };
const draw = [[5, 6], [7, 8], [9, 10], [11, 12]];
const manual = { round1: draw, round2: [[1, { winnerOf: "r1-1" }], [2, { winnerOf: "r1-2" }], [3, { winnerOf: "r1-3" }], [4, { winnerOf: "r1-4" }]] };
const picks = (scores) => Object.fromEntries(Object.entries(scores).map(([id, pts]) => [id, { totalPoints: pts }]));
const ctx = (finishedGws, gwPicks) => ({ managers: { list: managers }, matches: [], finishedGws: [8, ...finishedGws], gwPicks });
const seeding = { priorOrder: managers.map((m) => m.personKey) };
const gw9 = picks({ 5: 50, 6: 40, 7: 38, 8: 38, 9: 30, 10: 31, 11: 60, 12: 20 }); // 7 v 8 is level
const cupAt = (finished, gwPicks) => computeCup(ctx(finished, gwPicks), rounds, null, seeding, { hold: ["round1", "round2"], manual });

test("a level tie has no winner yet: it's replayed the following gameweek, and the next round waits", () => {
  const cup = cupAt([9], { 9: gw9 });
  const tie = cup.rounds.round1.results.find((m) => m.matchId === "r1-2");
  assert.equal(tie.winnerId, null);
  assert.equal(tie.replayGw, 10);
  assert.deepEqual([tie.scoreA, tie.scoreB], [38, 38]);
  // the other three are decided as normal
  assert.deepEqual(cup.rounds.round1.results.filter((m) => m.winnerId).map((m) => m.winnerId), [5, 10, 11]);
  // round 2 isn't drawn while a round-1 tie is still to be replayed
  assert.equal(cup.rounds.round2.draw, null);
  assert.equal(cup.status, "in_progress");
});

test("the replay decides it, and then round 2 fills in from the supplied bracket", () => {
  const cup = cupAt([9, 10], { 9: gw9, 10: picks({ 7: 45, 8: 52 }) });
  const tie = cup.rounds.round1.results.find((m) => m.matchId === "r1-2");
  assert.equal(tie.winnerId, 8);
  assert.deepEqual(tie.replays, [{ gw: 10, scoreA: 45, scoreB: 52 }]);
  assert.equal(tie.replayGw, undefined);
  assert.deepEqual(cup.rounds.round2.draw.map((p) => [p.managerAId, p.managerBId]), [[1, 5], [2, 8], [3, 10], [4, 11]]);
});

test("a replay that's level again goes to another replay the week after", () => {
  const level = cupAt([9, 10], { 9: gw9, 10: picks({ 7: 41, 8: 41 }) });
  const tie = level.rounds.round1.results.find((m) => m.matchId === "r1-2");
  assert.equal(tie.winnerId, null);
  assert.equal(tie.replayGw, 11);
  assert.equal(tie.replays.length, 1);

  const settled = cupAt([9, 10, 11], { 9: gw9, 10: picks({ 7: 41, 8: 41 }), 11: picks({ 7: 60, 8: 33 }) });
  const done = settled.rounds.round1.results.find((m) => m.matchId === "r1-2");
  assert.equal(done.winnerId, 7);
  assert.equal(done.replays.length, 2);
});
