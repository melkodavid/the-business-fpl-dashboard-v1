// Layer 3 — rendering. Fills a storyline's chosen template with names (pulled
// from context + league-lore.json, rotating in a nickname ~30% of the time)
// and its own facts. Both the nickname roll and the variant choice are
// seeded from (gw, dedupeKey), so re-running build.js against an already-
// published gw's storylines always renders identical text.
import { seededFloat } from "../lib/seededHash.js";

const NICKNAME_CHANCE = 0.3;

function managerByPersonKey(context, personKey) {
  return context.managers.list.find((m) => m.personKey === personKey) ?? null;
}

// Storyline facts store the person either as a personKey string (belt-watch,
// lu-post-mark) or a managerId number (most other detectors, which read
// straight off context.matches/standings) -- normalize either to a personKey.
function resolveToPersonKey(context, value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return context.managers.byId.get(value)?.personKey ?? null;
}

function displayName(context, lore, personKey, seed) {
  if (!personKey) return "Someone";
  const manager = managerByPersonKey(context, personKey);
  const realName = manager?.playerName ?? personKey;
  const nicknames = lore.nicknamesFor(personKey);
  if (nicknames.length > 0 && seededFloat(`${seed}:nickname-roll`) < NICKNAME_CHANCE) {
    const idx = Math.floor(seededFloat(`${seed}:nickname-pick`) * nicknames.length);
    return nicknames[idx];
  }
  return realName;
}

// A few storyline types need a presentational value that isn't directly a
// fact or a name (e.g. "won"/"lost" instead of raw "W"/"L"); computed here
// rather than asking every detector to pre-format display strings.
function derivedFields(storyline) {
  if (storyline.type === "streak") {
    const isWin = storyline.facts.streakType === "W";
    return { streakWord: isWin ? "won" : "lost", streakNoun: isWin ? "winning" : "losing" };
  }
  return {};
}

function buildSubstitutions(storyline, context, lore) {
  const seedBase = `${storyline.gw}:${storyline.dedupeKey}`;
  const names = {};
  storyline.personKeys.forEach((rawKey, i) => {
    const personKey = resolveToPersonKey(context, rawKey);
    names[`name${i + 1}`] = displayName(context, lore, personKey, `${seedBase}:name${i + 1}`);
  });

  return { ...storyline.facts, ...names, ...derivedFields(storyline) };
}

function fillTemplate(template, substitutions) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (!(key in substitutions) || substitutions[key] == null) {
      throw new Error(`Unfilled placeholder {${key}} in template "${template}" (available: ${Object.keys(substitutions).join(", ")})`);
    }
    return String(substitutions[key]);
  });
}

export function renderStoryline(storyline, context, lore, templates) {
  const variants = templates[storyline.type];
  if (!variants || variants.length === 0) {
    throw new Error(`No templates found for storyline type "${storyline.type}"`);
  }

  const variantSeed = `${storyline.gw}:${storyline.dedupeKey}:variant`;
  const variantIndex = Math.floor(seededFloat(variantSeed) * variants.length);
  const template = variants[variantIndex];

  const substitutions = buildSubstitutions(storyline, context, lore);
  return fillTemplate(template, substitutions);
}

// Renders one gw's full selection result into the shape that gets archived:
// rendered text AND the structured facts side by side (see the brief's
// section 3 -- future-proofs an LLM rewrite pass later without re-deriving
// facts from the raw data).
export function renderRecap(selection, context, lore, templates) {
  const renderOne = (storyline) => ({
    type: storyline.type,
    personKeys: storyline.personKeys,
    text: renderStoryline(storyline, context, lore, templates),
    facts: storyline.facts,
    gw: storyline.gw,
  });

  return {
    gw: selection.gw,
    headline: selection.headline ? renderOne(selection.headline) : null,
    secondaries: selection.secondaries.map(renderOne),
  };
}
