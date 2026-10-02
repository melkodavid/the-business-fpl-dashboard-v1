import { test } from "node:test";
import assert from "node:assert/strict";
import { prestigeScore, rarityFor, prestigeRanks, seedHue, RARITIES } from "../../js/lib/cardRarity.js";

test("prestige is 100 per title plus 1 per career win", () => {
  assert.equal(prestigeScore({ titles: 4, w: 185 }), 585);
  assert.equal(prestigeScore({ titles: 0, w: 76 }), 76);
  assert.equal(prestigeScore({}), 0);
});

test("rarity climbs with prestige, and each boundary lands in the tier it names", () => {
  for (const tier of RARITIES) {
    assert.equal(rarityFor({ titles: 0, w: tier.min }).id, tier.id);
  }
  assert.equal(rarityFor({ titles: 0, w: 0 }).id, "common");
  assert.equal(rarityFor({ titles: 0, w: 99 }).id, "common");
  assert.equal(rarityFor({ titles: 1, w: 0 }).id, "uncommon");
  assert.equal(rarityFor({ titles: 4, w: 185 }).id, "mythic");
});

test("a win never lowers rarity: more wins is always the same tier or higher", () => {
  const order = RARITIES.map((r) => r.id).reverse(); // lowest first
  let previous = 0;
  for (let w = 0; w <= 600; w++) {
    const idx = order.indexOf(rarityFor({ titles: 0, w }).id);
    assert.ok(idx >= previous);
    previous = idx;
  }
});

test("progress and next-tier distance describe the climb to the next rarity", () => {
  const r = rarityFor({ titles: 0, w: 150 }); // rare (130..199)
  assert.equal(r.id, "rare");
  assert.equal(r.next.label, "Epic");
  assert.equal(r.next.needed, 50);
  assert.ok(r.progress > 0 && r.progress < 1);

  const top = rarityFor({ titles: 6, w: 300 });
  assert.equal(top.next, null);
  assert.equal(top.progress, 1);
});

test("prestige ranks order the whole ladder, tying on equal scores", () => {
  const ranks = prestigeRanks([
    { managerKey: "a", titles: 4, w: 185 },
    { managerKey: "b", titles: 2, w: 125 },
    { managerKey: "c", titles: 0, w: 125 },
    { managerKey: "d", titles: 1, w: 25 }, // 125, same score as c but more titles
    { managerKey: "e", titles: 0, w: 5 },
  ]);
  assert.equal(ranks.get("a").rank, 1);
  assert.equal(ranks.get("b").rank, 2); // 325
  assert.equal(ranks.get("c").total, 5);
  assert.equal(ranks.get("e").rank, 5);
});

test("seedHue is stable and within a hue circle", () => {
  assert.equal(seedHue("lu"), seedHue("lu"));
  assert.notEqual(seedHue("lu"), seedHue("noah"));
  for (const k of ["lu", "noah", "ibrahim", "", undefined]) {
    const h = seedHue(k);
    assert.ok(h >= 0 && h < 360);
  }
});
