import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCup } from "../../scripts/cup/bracket.js";

const keys = ["lu", "muk", "anthony", "marshall", "mitch", "ibrahim", "noah", "david", "ostap", "pat", "carmine", "zac"];
const managers = keys.map((personKey, i) => ({ id: i + 1, personKey }));
const idOf = (k) => managers.find((m) => m.personKey === k).id;
// GW1..8 finished; carmine beat zac in the only match that matters for the newcomers' order
const context = {
  managers: { list: managers },
  matches: [
    { event: 8, homeManagerId: idOf("carmine"), awayManagerId: idOf("zac"), homePoints: 60, awayPoints: 40, finished: true },
  ],
  finishedGws: [8],
  gwPicks: {},
};
const rounds = { round1: [9], round2: [18, 19], round3: [27, 28], round4: [36] };
// last season's table: Mark finished 3rd but has left; Pasquale 11th, also gone
const priorOrder = ["lu", "muk", "mark", "anthony", "marshall", "mitch", "ibrahim", "noah", "david", "ostap", "pasquale", "pat"];

test("byes go to last season's top four who are still in the league (Mark skipped, next one up)", () => {
  const cup = computeCup(context, rounds, null, { priorOrder, label: "25/26" });
  const byes = cup.seeds.filter((s) => s.seed <= 4).map((s) => managers.find((m) => m.id === s.managerId).personKey);
  assert.deepEqual(byes, ["lu", "muk", "anthony", "marshall"]);
  // the draw only involves the other eight, and everyone appears exactly once
  const drawn = cup.rounds.round1.draw.flatMap((p) => [p.managerAId, p.managerBId]);
  assert.equal(drawn.length, 8);
  assert.ok(!byes.some((k) => drawn.includes(idOf(k))));
  assert.equal(new Set(cup.seeds.map((s) => s.managerId)).size, 12);
  assert.deepEqual(cup.seedingBasis, { type: "last-season", label: "25/26" });
});

test("new managers are seeded after everyone with a record, in current-table order", () => {
  const cup = computeCup(context, rounds, null, { priorOrder, label: "25/26" });
  const tail = cup.seeds.slice(-2).map((s) => managers.find((m) => m.id === s.managerId).personKey);
  assert.deepEqual(tail, ["carmine", "zac"]);
  assert.ok(cup.seeds.slice(-2).every((s) => s.basis === "new"));
});

test("without a prior table it falls back to the current league table, and an existing draw is never reseeded", () => {
  const fallback = computeCup(context, rounds, null);
  assert.equal(fallback.seedingBasis.type, "league-table");
  const first = computeCup(context, rounds, null, { priorOrder, label: "25/26" });
  const again = computeCup(context, rounds, first, null);
  assert.deepEqual(again.seeds, first.seeds);
  assert.deepEqual(again.rounds.round1.draw, first.rounds.round1.draw);
});
