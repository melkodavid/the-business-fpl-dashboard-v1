// Integration test against the committed REAL season (data/recaps/*.json,
// generated from the real league by build.js), distinct from pipeline.test.js
// which only proves the engine tolerates mock data + empty lore. This proves
// the actual shipped archive satisfies the brief's structural invariants:
// every finished GW gets exactly one recap, headline always present, and no
// template placeholder was left unfilled anywhere in the real output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
const RECAPS_DIR = join(ROOT, "data/recaps");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

const meta = readJson(join(ROOT, "data/meta.json"));
const managers = readJson(join(ROOT, "data/managers.json"));
const managerPersonKeys = new Set(managers.list.map((m) => m.personKey));

test("data/recaps exists for this committed season", () => {
  assert.ok(existsSync(RECAPS_DIR), "run `node scripts/build.js` at least once before this test");
});

test("every finished GW (1..finishedThroughGw) has exactly one recap file, and no extra ones beyond it", () => {
  const finishedThrough = meta.finishedThroughGw;
  assert.ok(Number.isInteger(finishedThrough) && finishedThrough > 0);

  for (let gw = 1; gw <= finishedThrough; gw++) {
    assert.ok(existsSync(join(RECAPS_DIR, `gw${gw}.json`)), `missing recap for finished GW${gw}`);
  }

  const gwFiles = readdirSync(RECAPS_DIR).filter((f) => /^gw\d+\.json$/.test(f));
  assert.equal(gwFiles.length, finishedThrough);
});

test("the current in-progress GW (if the season isn't over) never gets a recap", () => {
  if (meta.currentGw === meta.finishedThroughGw) return; // season complete, nothing in-progress
  assert.ok(!existsSync(join(RECAPS_DIR, `gw${meta.currentGw}.json`)));
});

test("every recap has a non-null headline, and every storyline's text has no unfilled {placeholder}", () => {
  const gwFiles = readdirSync(RECAPS_DIR).filter((f) => /^gw\d+\.json$/.test(f));
  assert.ok(gwFiles.length > 0);

  for (const file of gwFiles) {
    const recap = readJson(join(RECAPS_DIR, file));
    assert.ok(recap.headline, `${file}: headline is null`);
    assert.ok(!recap.headline.text.includes("{"), `${file}: unfilled placeholder in headline: "${recap.headline.text}"`);

    for (const secondary of recap.secondaries) {
      assert.ok(!secondary.text.includes("{"), `${file}: unfilled placeholder in secondary: "${secondary.text}"`);
    }
  }
});

test("no recap reports the exact same underlying event twice (same type + facts)", () => {
  // Checking rendered text would be too strict: two genuinely different
  // events (e.g. two separate gauntlet runs for two different managers) can
  // coincidentally land on the same template variant and render identically.
  // Same type + same facts, though, really is the same real-world event.
  const gwFiles = readdirSync(RECAPS_DIR).filter((f) => /^gw\d+\.json$/.test(f));

  for (const file of gwFiles) {
    const recap = readJson(join(RECAPS_DIR, file));
    const keys = [recap.headline, ...recap.secondaries].filter(Boolean).map((s) => `${s.type}:${JSON.stringify(s.facts)}`);
    assert.equal(new Set(keys).size, keys.length, `${file}: duplicate underlying event found`);
  }
});

test("every personKey referenced by a real-season storyline resolves to a real manager", () => {
  const gwFiles = readdirSync(RECAPS_DIR).filter((f) => /^gw\d+\.json$/.test(f));

  for (const file of gwFiles) {
    const recap = readJson(join(RECAPS_DIR, file));
    const storylines = [recap.headline, ...recap.secondaries].filter(Boolean);
    for (const storyline of storylines) {
      for (const personKey of storyline.personKeys) {
        assert.ok(managerPersonKeys.has(personKey), `${file}: unknown personKey "${personKey}" in ${storyline.type}`);
      }
    }
  }
});

test("index.json lists exactly the same GWs, in order, with matching headline text", () => {
  const index = readJson(join(RECAPS_DIR, "index.json"));
  const expectedGws = [];
  for (let gw = 1; gw <= meta.finishedThroughGw; gw++) expectedGws.push(gw);

  assert.deepEqual(
    index.recaps.map((r) => r.gw),
    expectedGws
  );

  for (const entry of index.recaps) {
    const recap = readJson(join(RECAPS_DIR, `gw${entry.gw}.json`));
    assert.equal(entry.headline, recap.headline.text);
  }
});
