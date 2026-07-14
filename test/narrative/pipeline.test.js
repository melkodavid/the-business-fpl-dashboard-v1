// End-to-end smoke test: every detector, feeding the full season into
// selection, against the real mock fixtures. Catches integration-level
// issues (NaN scores, crashes, structural gaps) that isolated unit tests
// on crafted fixtures can't.
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadMockRaw } from "../../scripts/mock/loadMockRaw.js";
import { buildContext } from "../../scripts/context.js";
import { loadLore } from "../../scripts/narrative/lore.js";
import { buildSeasonReplay } from "../../scripts/narrative/seasonReplay.js";
import { selectSeasonNarrative } from "../../scripts/narrative/select.js";

import { computeAllPlay } from "../../scripts/stats/allPlay.js";
import { computeBenchStats } from "../../scripts/stats/benchStats.js";
import { computeFiftyNineClub } from "../../scripts/stats/fiftyNineClub.js";
import { computeTradeLedger } from "../../scripts/stats/tradeLedger.js";
import { computeWaiverHitRate } from "../../scripts/stats/waiverHitRate.js";

import { detectStreaks } from "../../scripts/narrative/detectors/streaks.js";
import { detectRecords } from "../../scripts/narrative/detectors/records.js";
import { detectLuck } from "../../scripts/narrative/detectors/luck.js";
import { detectLineupPain } from "../../scripts/narrative/detectors/lineupPain.js";
import { detectTableDrama } from "../../scripts/narrative/detectors/tableDrama.js";
import { detectTradesWaivers } from "../../scripts/narrative/detectors/tradesWaivers.js";
import { detectFamilyDerby } from "../../scripts/narrative/detectors/familyDerby.js";
import { detectPalladinoGauntlet } from "../../scripts/narrative/detectors/palladinoGauntlet.js";
import { detectGenerationWar } from "../../scripts/narrative/detectors/generationWar.js";
import { detectBridesmaids } from "../../scripts/narrative/detectors/bridesmaids.js";
import { detectNoahTradeDesk } from "../../scripts/narrative/detectors/noahTradeDesk.js";
import { detectBeltWatch } from "../../scripts/narrative/detectors/beltWatch.js";
import { detectLuPostMark } from "../../scripts/narrative/detectors/luPostMark.js";

const context = buildContext(loadMockRaw());
const replay = buildSeasonReplay(context);

// The mock fixtures use fictional personKeys with no lore entries at all --
// deliberately, to prove the whole pipeline tolerates that (per the brief:
// "lore entries for managers absent from managers.json cause no errors").
const lore = loadLore({ people: [], rivalries: [] });

const allPlay = computeAllPlay(context);
const benchStats = computeBenchStats(context);
const fiftyNineClub = computeFiftyNineClub(context);
const tradeLedger = computeTradeLedger(context);
const waiverHitRate = computeWaiverHitRate(context);
const history = { seasons: [{ championKey: null }, { isCurrent: true }] }; // no real prior champion in mock data

const allStorylines = [
  ...detectStreaks(context, replay),
  ...detectRecords(context),
  ...detectLuck(context, allPlay),
  ...detectLineupPain(context, benchStats, fiftyNineClub),
  ...detectTableDrama(context, replay),
  ...detectTradesWaivers(context, tradeLedger, waiverHitRate),
  ...detectFamilyDerby(context, lore),
  ...detectPalladinoGauntlet(context, lore),
  ...detectGenerationWar(context, lore).storylines,
  ...detectBridesmaids(context, replay, lore),
  ...detectNoahTradeDesk(context, tradeLedger),
  ...detectBeltWatch(context, replay, history),
  ...detectLuPostMark(context, replay, tradeLedger, lore),
];

test("the full pipeline runs against a lore-less season without throwing", () => {
  assert.ok(allStorylines.length > 0);
});

test("no storyline ever produces a NaN score during selection", () => {
  const byGw = selectSeasonNarrative(allStorylines, context, replay);
  for (const gw of context.finishedGws) {
    const { headline, secondaries } = byGw[gw];
    if (headline) assert.ok(Number.isFinite(headline.score));
    for (const s of secondaries) assert.ok(Number.isFinite(s.score));
  }
});

test("every finished gw gets a selection result (possibly a null headline, but always a defined entry)", () => {
  const byGw = selectSeasonNarrative(allStorylines, context, replay);
  for (const gw of context.finishedGws) {
    assert.ok(byGw[gw] !== undefined);
    assert.ok(Array.isArray(byGw[gw].secondaries));
  }
});

test("re-running selection on the same storylines is deterministic", () => {
  const first = selectSeasonNarrative(allStorylines, context, replay);
  const second = selectSeasonNarrative(allStorylines, context, replay);
  assert.deepEqual(first, second);
});
