import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRosterEvents } from "../../scripts/lib/rosterEvents.js";

function makeContext({ draftChoices = [], transactions = [], trades = [] }) {
  return { draftChoices, transactions, trades };
}

test("a drafted player who's never moved is rostered through season end", () => {
  const context = makeContext({ draftChoices: [{ managerId: 1, elementId: 100 }] });
  const { tenureEndGw } = buildRosterEvents(context);
  assert.equal(tenureEndGw(1, 100, 1, 10), 10);
});

test("a waiver drop ends tenure the GW before the drop", () => {
  const context = makeContext({
    draftChoices: [{ managerId: 1, elementId: 100 }],
    transactions: [{ event: 5, managerId: 1, kind: "w", elementIn: null, elementOut: 100, result: "a" }],
  });
  const { tenureEndGw } = buildRosterEvents(context);
  assert.equal(tenureEndGw(1, 100, 1, 10), 4);
});

test("a declined transaction is ignored", () => {
  const context = makeContext({
    draftChoices: [{ managerId: 1, elementId: 100 }],
    transactions: [{ event: 5, managerId: 1, kind: "w", elementIn: null, elementOut: 100, result: "d" }],
  });
  const { tenureEndGw } = buildRosterEvents(context);
  assert.equal(tenureEndGw(1, 100, 1, 10), 10);
});

test("a traded-away player's tenure with the new team ends at the next event that removes them", () => {
  const context = makeContext({
    trades: [
      {
        event: 6,
        sides: [
          { managerId: 1, playersIn: [200], playersOut: [] },
          { managerId: 2, playersIn: [], playersOut: [200] },
        ],
      },
      {
        // manager 1 later trades the same player away again at GW9
        event: 9,
        sides: [
          { managerId: 3, playersIn: [200], playersOut: [] },
          { managerId: 1, playersIn: [], playersOut: [200] },
        ],
      },
    ],
  });
  const { tenureEndGw } = buildRosterEvents(context);
  assert.equal(tenureEndGw(1, 200, 6, 10), 8);
  assert.equal(tenureEndGw(3, 200, 9, 10), 10);
});
