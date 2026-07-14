// Derives the front page's "season arc" widget payloads from storylines
// already produced for the recaps -- no duplicated detection logic, just
// picks out the current state of each ongoing arc. Each widget is null when
// that arc isn't relevant right now (no active gauntlet run, lu-post-mark-era
// flag unset, no cross-generation matchups played yet), so the frontend can
// simply skip rendering whatever comes back null.
const GAUNTLET_TYPES = new Set(["gauntlet-watch", "gauntlet-progress", "gauntlet-swept"]);
const LIFE_AFTER_MARK_TYPES = new Set([
  "lu-post-mark-tracker",
  "lu-post-mark-trade-scrutiny",
  "lu-post-mark-resolution-won",
  "lu-post-mark-resolution-eliminated",
]);

// dedupeKey shapes: "gauntlet-watch:{managerId}:{startGw}",
// "gauntlet-progress:{managerId}:{startGw}:{played}", "gauntlet-swept:{managerId}:{startGw}"
// -- the run identity is always the type-prefix's next two segments.
function gauntletRunKey(dedupeKey) {
  const [, managerId, startGw] = dedupeKey.split(":");
  return `${managerId}:${startGw}`;
}

function latestGauntletArc(allStorylines) {
  const byRun = new Map();
  for (const s of allStorylines) {
    if (!GAUNTLET_TYPES.has(s.type)) continue;
    const runKey = gauntletRunKey(s.dedupeKey);
    const existing = byRun.get(runKey);
    if (!existing || s.gw > existing.gw) byRun.set(runKey, s);
  }

  // A run is resolved once it's swept (explicit resolution storyline) OR
  // once every fixture in it has been played without being a sweep (no
  // dedicated storyline fires for that case -- the last "progress" entry's
  // own facts are the only signal that the run is actually over).
  const unresolved = [...byRun.values()].filter((s) => {
    if (s.type === "gauntlet-swept") return false;
    if (s.type === "gauntlet-progress" && s.facts.played >= s.facts.length) return false;
    return true;
  });
  if (unresolved.length === 0) return null;

  const latest = unresolved.sort((a, b) => b.gw - a.gw)[0];
  return { type: latest.type, personKeys: latest.personKeys, facts: latest.facts, gw: latest.gw };
}

function latestLifeAfterMarkArc(allStorylines) {
  const relevant = allStorylines.filter((s) => LIFE_AFTER_MARK_TYPES.has(s.type)).sort((a, b) => b.gw - a.gw);
  if (relevant.length === 0) return null;
  const latest = relevant[0];
  return { type: latest.type, personKeys: latest.personKeys, facts: latest.facts, gw: latest.gw };
}

export function computeSeasonArcs(allStorylines, generationWarMatrix, summarize01sVsRest) {
  const hasAnyGenerationMatchups = Object.keys(generationWarMatrix).length > 0;

  return {
    gauntletWatch: latestGauntletArc(allStorylines),
    lifeAfterMark: latestLifeAfterMarkArc(allStorylines),
    generationWar: hasAnyGenerationMatchups
      ? { matrix: generationWarMatrix, oneOhOnesVsRest: summarize01sVsRest(generationWarMatrix) }
      : null,
  };
}
