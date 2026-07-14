import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadLore } from "../../scripts/narrative/lore.js";

const realLore = loadLore(JSON.parse(readFileSync(new URL("../../data/league-lore.json", import.meta.url))));

const fixture = loadLore({
  people: [
    { personKey: "lu", nicknames: ["Lu"], generation: "97s", family: { group: "palladino", pair: "lu-muk", relation: "brother" }, bridesmaid: false, flags: [] },
    { personKey: "muk", nicknames: ["Muk", "Marcus"], generation: "01s", family: { group: "palladino", pair: "lu-muk", relation: "brother" }, bridesmaid: false, flags: [] },
    { personKey: "anthony", nicknames: ["Neen"], generation: "2000s", family: { group: "palladino", pair: "anthony-noah", relation: "brother" }, bridesmaid: true, flags: ["anth-belt-photos"] },
    { personKey: "noah", nicknames: [], generation: "97s", family: { group: "palladino", pair: "anthony-noah", relation: "brother" }, bridesmaid: false, flags: ["noah-bad-trades"] },
    { personKey: "pat", nicknames: [], generation: "97s", family: null, bridesmaid: { situational: true }, flags: [] },
  ],
  rivalries: [{ pair: ["pat", "noah"], name: "The Noah Who? Derby", blurb: "Pat printed the shirt. Noah has never forgiven him." }],
});

test("a personKey with no lore entry returns a safe empty person, never throws", () => {
  const person = fixture.get("someone-not-in-the-file");
  assert.equal(person.personKey, "someone-not-in-the-file");
  assert.deepEqual(person.nicknames, []);
  assert.equal(person.generation, null);
  assert.equal(person.family, null);
  assert.equal(person.bridesmaid, false);
  assert.deepEqual(person.flags, []);
  assert.equal(fixture.isBridesmaid("someone-not-in-the-file"), false);
  assert.equal(fixture.hasFlag("someone-not-in-the-file", "anything"), false);
});

test("bridesmaid handles both plain boolean and situational-object shapes truthily", () => {
  assert.equal(fixture.isBridesmaid("anthony"), true);
  assert.equal(fixture.isBridesmaid("pat"), true); // { situational: true } is truthy
  assert.equal(fixture.isBridesmaid("lu"), false);
});

test("familyRelation: same pair is brother, same group different pair is cousin, unrelated is null", () => {
  assert.equal(fixture.familyRelation("lu", "muk"), "brother");
  assert.equal(fixture.familyRelation("anthony", "noah"), "brother");
  assert.equal(fixture.familyRelation("lu", "anthony"), "cousin");
  assert.equal(fixture.familyRelation("muk", "noah"), "cousin");
  assert.equal(fixture.familyRelation("lu", "pat"), null);
  assert.equal(fixture.familyRelation("pat", "someone-else"), null);
});

test("familyGroupMembers excludes the person themselves", () => {
  const members = fixture.familyGroupMembers("lu").sort();
  assert.deepEqual(members, ["anthony", "muk", "noah"]);
  assert.deepEqual(fixture.familyGroupMembers("pat"), []);
});

test("rivalryFor matches a pair in either order", () => {
  assert.equal(fixture.rivalryFor("pat", "noah")?.name, "The Noah Who? Derby");
  assert.equal(fixture.rivalryFor("noah", "pat")?.name, "The Noah Who? Derby");
  assert.equal(fixture.rivalryFor("lu", "muk"), null);
});

test("noah's nicknames stay exactly what the lore file provides -- no historical-dictator comparison", () => {
  assert.deepEqual(fixture.nicknamesFor("noah"), []);
});

test("a lore entry for a personKey absent from the current managers list causes no errors", () => {
  const lore = loadLore({
    people: [
      { personKey: "lu", nicknames: ["Lu"], generation: "97s", family: null, bridesmaid: false, flags: [] },
      // "carm" has a lore entry (e.g. added ahead of a season they haven't
      // joined yet, or a departed manager) but never appears in managers.json
      // this season -- nothing should ever throw just because this entry exists.
      { personKey: "carm", nicknames: ["Carm"], generation: "01s", family: null, bridesmaid: false, flags: ["some-future-flag"] },
    ],
    rivalries: [{ pair: ["carm", "lu"], name: "A rivalry with someone not currently playing", blurb: "n/a" }],
  });

  assert.doesNotThrow(() => {
    lore.get("carm");
    lore.isBridesmaid("carm");
    lore.hasFlag("carm", "some-future-flag");
    lore.nicknamesFor("carm");
    lore.generationOf("carm");
    lore.familyRelation("carm", "lu");
    lore.familyGroupMembers("carm");
    lore.rivalryFor("carm", "lu");
  });
  assert.equal(lore.hasFlag("carm", "some-future-flag"), true);
});

test("real league-lore.json loads cleanly and covers every current manager", () => {
  const currentPersonKeys = [
    "lu", "ibrahim", "marshall", "david", "noah", "muk",
    "pat", "mitch", "anthony", "pasquale", "ostap", "mark",
  ];
  for (const key of currentPersonKeys) {
    const person = realLore.get(key);
    assert.equal(person.personKey, key);
  }
  assert.deepEqual(realLore.nicknamesFor("noah"), []);
  assert.equal(realLore.familyRelation("lu", "muk"), "brother");
  assert.equal(realLore.familyRelation("anthony", "noah"), "brother");
  assert.equal(realLore.familyRelation("lu", "anthony"), "cousin");
});
