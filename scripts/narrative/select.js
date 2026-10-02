// Layer 2 — scoring & selection. Takes every storyline every detector ever
// emitted (across the whole season) and, walking gw by gw in order, picks
// one headline + up to 5 secondaries per finished gw. Fully deterministic:
// no randomness anywhere, and ties are broken with a seeded hash of
// (gw, dedupeKey) rather than relying on array order.
import { matchImportance } from "../lib/matchImportance.js";
import { hashString } from "../lib/seededHash.js";

const MAX_SECONDARIES = 5;

// Repetition guards, applied to what a single recap may contain. Without them
// an early-season week can fill up with near-identical lines (three "season
// high" records, four streaks) just because they all score similarly.
const MAX_PER_TYPE = 2; // lines of one storyline type in a single recap (headline included)
const MAX_PER_TYPE_OVERRIDES = { "gauntlet-watch": 1, "record-high-gw": 1, "record-low-gw": 1 };
const MAX_PER_PERSON = 2; // lines about the same person in a single recap (headline included)
const SAME_SUBJECT_COOLDOWN_GWS = 2; // a secondary skips "same type about same people" seen this recently
const COOLDOWN_EXEMPT_TYPES = new Set(["gauntlet-swept"]); // resolutions are one-off, never "repeats"

const SEASON_FIRST_BONUS = 1.5;
const HEAVY_FRESHNESS_PENALTY = 0.3; // same type headlined within the last 3 gws
const MILD_FRESHNESS_PENALTY = 0.7; // same type appeared (any role) last gw
const TOP2_LATE_SEASON_FROM_GW = 25;
const TOP2_LATE_SEASON_BOOST = 1.3;

const MANAGER_ID_FACT_KEYS = [
  "managerId",
  "homeManagerId",
  "awayManagerId",
  "winnerId",
  "loserId",
  "newLeaderId",
  "previousLeaderId",
  "oldManagerId",
  "opponentId",
];

function extractManagerIds(storyline) {
  const ids = MANAGER_ID_FACT_KEYS.map((key) => storyline.facts[key]).filter((v) => v != null);
  return [...new Set(ids)];
}

// Bigger underlying numbers matter more, but gently -- baseWeight and stakes
// should still dominate the score, not this.
function magnitudeMultiplier(storyline) {
  const f = storyline.facts;
  const multiplier = (() => {
    switch (storyline.type) {
      case "streak":
        return 1 + Math.max(0, f.length - 3) * 0.15;
      case "record-blowout":
        return 1 + f.margin / 50;
      case "record-closest":
        return 1 + (20 - Math.min(f.margin, 20)) / 20;
      case "record-high-gw":
      case "record-low-win":
        return 1 + f.score / 100;
      case "gauntlet-swept":
        return 1 + f.length * 0.2;
      case "trade-ex-factor":
        return 1 + f.points / 20;
      case "generation-sweep":
        return 1 + f.count * 0.1;
      default:
        return 1;
    }
  })();
  // A malformed/missing fact (e.g. from a future detector added without
  // updating this switch) should never corrupt the sort with NaN -- fall
  // back to a neutral multiplier instead of silently breaking selection.
  return Number.isFinite(multiplier) ? multiplier : 1;
}

// Reuses the same importance formula This Week's Schedule uses (via the
// shared helper), applied retroactively against the replay snapshot for
// whichever gw this storyline happened at. Storylines with no discernible
// manager(s) in their facts (e.g. a generation-war record) get no stakes
// boost -- they're not tied to one specific fixture.
function stakesMultiplier(storyline, context, replay) {
  const snapshot = replay.at(storyline.gw);
  if (!snapshot) return 1;

  const managerIds = extractManagerIds(storyline);
  if (managerIds.length === 0) return 1;

  const match =
    context.matches.find(
      (m) =>
        m.event === storyline.gw &&
        m.finished &&
        managerIds.includes(m.homeManagerId) &&
        managerIds.includes(m.awayManagerId)
    ) ??
    context.matches.find(
      (m) => m.event === storyline.gw && m.finished && (managerIds.includes(m.homeManagerId) || managerIds.includes(m.awayManagerId))
    );
  if (!match) return 1;

  const teamCount = snapshot.standings.length;
  const rankByManagerId = new Map(snapshot.standings.map((r) => [r.managerId, r.rank]));
  const totalByManagerId = new Map(snapshot.standings.map((r) => [r.managerId, r.total]));

  const homeRank = rankByManagerId.get(match.homeManagerId) ?? teamCount;
  const awayRank = rankByManagerId.get(match.awayManagerId) ?? teamCount;
  const { importance } = matchImportance({
    homeRank,
    awayRank,
    homeTotal: totalByManagerId.get(match.homeManagerId) ?? 0,
    awayTotal: totalByManagerId.get(match.awayManagerId) ?? 0,
    teamCount,
  });

  let multiplier = 1 + importance / 5;
  const bestRank = Math.min(homeRank, awayRank);
  if (storyline.gw >= TOP2_LATE_SEASON_FROM_GW && bestRank <= 2) multiplier *= TOP2_LATE_SEASON_BOOST;

  return multiplier;
}

function freshnessPenalty(storyline, priorSelections) {
  const recentHeadline = priorSelections.some(
    (p) => p.role === "headline" && p.type === storyline.type && p.gw >= storyline.gw - 3 && p.gw < storyline.gw
  );
  if (recentHeadline) return HEAVY_FRESHNESS_PENALTY;

  const appearedLastGw = priorSelections.some((p) => p.gw === storyline.gw - 1 && p.type === storyline.type);
  if (appearedLastGw) return MILD_FRESHNESS_PENALTY;

  return 1;
}

function seededTiebreak(a, b) {
  return hashString(`${a.gw}:${a.dedupeKey}`) - hashString(`${b.gw}:${b.dedupeKey}`);
}

function scoreStoryline(storyline, context, replay, seenDedupeKeys, priorSelections) {
  const rarity = seenDedupeKeys.has(storyline.dedupeKey) ? 1 : SEASON_FIRST_BONUS;
  const magnitude = magnitudeMultiplier(storyline);
  const stakes = stakesMultiplier(storyline, context, replay);
  const freshness = freshnessPenalty(storyline, priorSelections);
  return storyline.baseWeight * rarity * magnitude * stakes * freshness;
}

// Selects one gw's headline + secondaries. Exported mainly for direct
// testing; selectSeasonNarrative is the real entry point since freshness/
// rarity are inherently sequential (they depend on what earlier gws picked).
export function subjectKey(storyline) {
  return `${storyline.type}|${[...storyline.personKeys].map(String).sort().join(",")}`;
}

export function selectForGw(allStorylines, gw, context, replay, priorSelections, seenDedupeKeys) {
  const candidates = allStorylines.filter((s) => s.gw === gw);
  const scored = candidates
    .map((s) => ({ ...s, score: scoreStoryline(s, context, replay, seenDedupeKeys, priorSelections) }))
    .sort((a, b) => b.score - a.score || seededTiebreak(a, b));

  const headline = scored[0] ?? null;

  const typeCounts = new Map();
  const personCounts = new Map();
  const take = (s) => {
    typeCounts.set(s.type, (typeCounts.get(s.type) ?? 0) + 1);
    for (const p of s.personKeys.map(String)) personCounts.set(p, (personCounts.get(p) ?? 0) + 1);
  };
  if (headline) take(headline);

  const secondaries = [];
  for (const s of scored.slice(1)) {
    if (secondaries.length >= MAX_SECONDARIES) break;
    if ((typeCounts.get(s.type) ?? 0) >= (MAX_PER_TYPE_OVERRIDES[s.type] ?? MAX_PER_TYPE)) continue;
    if (s.personKeys.some((p) => (personCounts.get(String(p)) ?? 0) >= MAX_PER_PERSON)) continue;
    if (!COOLDOWN_EXEMPT_TYPES.has(s.type)) {
      const key = subjectKey(s);
      const recentlyShown = priorSelections.some(
        (p) => p.subject === key && p.gw >= gw - SAME_SUBJECT_COOLDOWN_GWS && p.gw < gw
      );
      if (recentlyShown) continue;
    }
    secondaries.push(s);
    take(s);
  }

  return { headline, secondaries };
}

// Walks the whole season in order, returning { [gw]: { headline, secondaries } }
// for every finished gw. Deterministic given the same detector outputs.
export function selectSeasonNarrative(allStorylines, context, replay) {
  const byGw = {};
  const seenDedupeKeys = new Set();
  const priorSelections = [];

  for (const gw of context.finishedGws) {
    const { headline, secondaries } = selectForGw(allStorylines, gw, context, replay, priorSelections, seenDedupeKeys);
    byGw[gw] = { gw, headline, secondaries };

    if (headline) {
      seenDedupeKeys.add(headline.dedupeKey);
      priorSelections.push({ gw, type: headline.type, dedupeKey: headline.dedupeKey, role: "headline", subject: subjectKey(headline) });
    }
    for (const s of secondaries) {
      seenDedupeKeys.add(s.dedupeKey);
      priorSelections.push({ gw, type: s.type, dedupeKey: s.dedupeKey, role: "secondary", subject: subjectKey(s) });
    }
  }

  return byGw;
}
