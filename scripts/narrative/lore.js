// Loads and normalizes data/league-lore.json -- the hand-edited file of
// nicknames, family/generation groupings, bridesmaid status, and rivalries
// that the lore-driven detectors key off of. Tolerant by design: a personKey
// with no lore entry (a manager the league hasn't written lore for yet), or
// a lore entry for a personKey no longer in the league, must never throw --
// see narrative-layer-brief.md section 1.

const EMPTY_PERSON = Object.freeze({
  personKey: null,
  nicknames: [],
  birthYear: null,
  generation: null,
  family: null,
  bridesmaid: false,
  flags: [],
});

function normalizePerson(raw) {
  return {
    personKey: raw.personKey,
    nicknames: Array.isArray(raw.nicknames) ? raw.nicknames : [],
    birthYear: raw.birthYear ?? null,
    generation: raw.generation ?? null,
    family: raw.family ?? null,
    bridesmaid: raw.bridesmaid ?? false,
    flags: Array.isArray(raw.flags) ? raw.flags : [],
  };
}

// raw = the parsed contents of data/league-lore.json (build.js reads the
// file; this module never touches the filesystem, matching how
// computeHistory() receives historySeasonsData rather than reading it itself).
export function loadLore(raw) {
  const people = Array.isArray(raw?.people) ? raw.people.map(normalizePerson) : [];
  const rivalries = Array.isArray(raw?.rivalries) ? raw.rivalries : [];
  const byKey = new Map(people.map((p) => [p.personKey, p]));

  return {
    people,
    rivalries,

    // Never returns undefined -- any personKey with no lore entry gets a
    // safe, empty person back instead of forcing every caller to null-check.
    get(personKey) {
      return byKey.get(personKey) ?? { ...EMPTY_PERSON, personKey };
    },

    isBridesmaid(personKey) {
      return Boolean(this.get(personKey).bridesmaid);
    },

    hasFlag(personKey, flag) {
      return this.get(personKey).flags.includes(flag);
    },

    nicknamesFor(personKey) {
      return this.get(personKey).nicknames;
    },

    generationOf(personKey) {
      return this.get(personKey).generation;
    },

    // "brother" if both share the same family sibling-pair id, "cousin" if
    // they share a family group but a different pair, otherwise null (not
    // related, or one/both have no family entry). See the family-derby
    // detector for how this distinguishes Brother Derby vs. Cousin Clash.
    familyRelation(keyA, keyB) {
      const a = this.get(keyA).family;
      const b = this.get(keyB).family;
      if (!a || !b || !a.group || a.group !== b.group) return null;
      if (a.pair && a.pair === b.pair) return "brother";
      return "cousin";
    },

    // Same family.group as keyA, excluding keyA itself -- used by the
    // palladino-gauntlet detector to check a manager's upcoming fixtures.
    familyGroupMembers(personKey) {
      const group = this.get(personKey).family?.group;
      if (!group) return [];
      return people.filter((p) => p.family?.group === group && p.personKey !== personKey).map((p) => p.personKey);
    },

    rivalryFor(keyA, keyB) {
      return (
        rivalries.find(
          (r) => (r.pair[0] === keyA && r.pair[1] === keyB) || (r.pair[0] === keyB && r.pair[1] === keyA)
        ) ?? null
      );
    },
  };
}
