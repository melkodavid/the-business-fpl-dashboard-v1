// Per the brief's stability requirement: a recap is immutable once its GW is
// finished. This proves it directly against writeRecapArchive rather than
// relying on manual inspection of build.js's output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeRecapArchive } from "../../scripts/narrative/archive.js";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

test("a second run with different content for an already-published GW does not modify its file", () => {
  const dir = mkdtempSync(join(tmpdir(), "recap-archive-test-"));
  try {
    const firstRun = {
      1: { gw: 1, headline: { type: "streak", personKeys: ["lu"], text: "Lu is at 4 straight.", facts: {}, gw: 1 }, secondaries: [] },
    };
    writeRecapArchive(firstRun, dir);
    const originalGw1 = readJson(join(dir, "gw1.json"));

    // Simulate a rerun after editing templates.json/league-lore.json: same GW,
    // different (would-be) rendered text, plus one newly-finished GW.
    const secondRun = {
      1: { gw: 1, headline: { type: "streak", personKeys: ["lu"], text: "COMPLETELY DIFFERENT TEXT", facts: {}, gw: 1 }, secondaries: [] },
      2: { gw: 2, headline: { type: "streak", personKeys: ["muk"], text: "Muk is at 2 straight.", facts: {}, gw: 2 }, secondaries: [] },
    };
    writeRecapArchive(secondRun, dir);

    assert.deepEqual(readJson(join(dir, "gw1.json")), originalGw1);
    assert.equal(readJson(join(dir, "gw2.json")).headline.text, "Muk is at 2 straight.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("index.json lists every published recap with its headline text, sorted by GW", () => {
  const dir = mkdtempSync(join(tmpdir(), "recap-archive-test-"));
  try {
    const recaps = {
      2: { gw: 2, headline: { type: "streak", personKeys: ["muk"], text: "GW2 headline", facts: {}, gw: 2 }, secondaries: [] },
      1: { gw: 1, headline: { type: "streak", personKeys: ["lu"], text: "GW1 headline", facts: {}, gw: 1 }, secondaries: [] },
    };
    writeRecapArchive(recaps, dir);

    const index = readJson(join(dir, "index.json"));
    assert.deepEqual(index.recaps, [
      { gw: 1, headline: "GW1 headline" },
      { gw: 2, headline: "GW2 headline" },
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a recap with a null headline is still archived (keeps the per-GW mapping 1:1)", () => {
  const dir = mkdtempSync(join(tmpdir(), "recap-archive-test-"));
  try {
    writeRecapArchive({ 1: { gw: 1, headline: null, secondaries: [] } }, dir);
    const recap = readJson(join(dir, "gw1.json"));
    assert.equal(recap.headline, null);

    const index = readJson(join(dir, "index.json"));
    assert.deepEqual(index.recaps, [{ gw: 1, headline: null }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
