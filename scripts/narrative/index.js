// Narrative layer orchestrator -- runs every detector (Layer 1), feeds the
// results through selection (Layer 2), and renders one recap per finished GW
// (Layer 3). Stat modules that several detectors also need (allPlay,
// benchStats, fiftyNineClub, tradeLedger, waiverHitRate) are passed in rather
// than recomputed here, since build.js already computes them for data/*.json.
import { loadLore } from "./lore.js";
import { buildSeasonReplay } from "./seasonReplay.js";
import { selectSeasonNarrative } from "./select.js";
import { renderRecap } from "./render.js";

import { detectStreaks } from "./detectors/streaks.js";
import { detectRecords } from "./detectors/records.js";
import { detectLuck } from "./detectors/luck.js";
import { detectLineupPain } from "./detectors/lineupPain.js";
import { detectTableDrama } from "./detectors/tableDrama.js";
import { detectTradesWaivers } from "./detectors/tradesWaivers.js";
import { detectFamilyDerby } from "./detectors/familyDerby.js";
import { detectPalladinoGauntlet } from "./detectors/palladinoGauntlet.js";
import { detectGenerationWar, summarize01sVsRest } from "./detectors/generationWar.js";
import { detectBridesmaids } from "./detectors/bridesmaids.js";
import { detectNoahTradeDesk } from "./detectors/noahTradeDesk.js";
import { detectBeltWatch } from "./detectors/beltWatch.js";
import { detectLuPostMark } from "./detectors/luPostMark.js";
import { computeSeasonArcs } from "./seasonArcs.js";

function collectStorylines(context, replay, history, lore, statModules, generationWar) {
  const { allPlay, benchStats, fiftyNineClub, tradeLedger, waiverHitRate } = statModules;

  return [
    ...detectStreaks(context, replay),
    ...detectRecords(context),
    ...detectLuck(context, allPlay),
    ...detectLineupPain(context, benchStats, fiftyNineClub),
    ...detectTableDrama(context, replay),
    ...detectTradesWaivers(context, tradeLedger, waiverHitRate),
    ...detectFamilyDerby(context, lore),
    ...detectPalladinoGauntlet(context, lore),
    ...generationWar.storylines,
    ...detectBridesmaids(context, replay, lore),
    ...detectNoahTradeDesk(context, tradeLedger),
    ...detectBeltWatch(context, replay, history),
    ...detectLuPostMark(context, replay, tradeLedger, lore),
  ];
}

// Returns { recapsByGw: { [gw]: renderedRecap }, allStorylines, seasonArcs }
// -- one rendered recap per finished GW (context.finishedGws already
// excludes the current in-progress GW, so that exclusion falls out for
// free), plus the front page's season-arc widget payloads.
export function buildNarrativeLayer(context, history, loreRaw, templates, statModules) {
  const lore = loadLore(loreRaw);
  const replay = buildSeasonReplay(context);
  const generationWar = detectGenerationWar(context, lore);

  const allStorylines = collectStorylines(context, replay, history, lore, statModules, generationWar);
  const selectionByGw = selectSeasonNarrative(allStorylines, context, replay);

  const recapsByGw = {};
  for (const gw of context.finishedGws) {
    recapsByGw[gw] = renderRecap(selectionByGw[gw], context, lore, templates);
  }

  const seasonArcs = computeSeasonArcs(allStorylines, generationWar.matrix, summarize01sVsRest);

  return { recapsByGw, allStorylines, seasonArcs };
}
