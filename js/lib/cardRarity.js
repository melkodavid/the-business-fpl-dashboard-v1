// Card rarity -- pure logic, no DOM. The more a manager has won, the rarer
// (and more over-the-top) their card gets.
//
// Prestige = 100 per championship + 1 per career match win. Titles dominate,
// but because every win counts, two managers with the same number of titles
// still land in different places -- and every extra win nudges a card closer
// to the next rarity, so the ladder keeps moving all season.
export const TITLE_PRESTIGE = 100;

// Highest first. `min` is the prestige needed to reach the tier.
export const RARITIES = [
  { id: "mythic", label: "Mythic", min: 500, blurb: "Hall of Fame" },
  { id: "legendary", label: "Legendary", min: 300, blurb: "A league legend" },
  { id: "epic", label: "Epic", min: 200, blurb: "Proven winner" },
  { id: "rare", label: "Rare", min: 130, blurb: "Established name" },
  { id: "uncommon", label: "Uncommon", min: 100, blurb: "On the rise" },
  { id: "common", label: "Common", min: 0, blurb: "Still earning it" },
];

export function prestigeScore(card) {
  return (card.titles ?? 0) * TITLE_PRESTIGE + (card.w ?? 0);
}

// -> { id, label, blurb, prestige, next: { label, needed } | null, progress: 0..1 }
export function rarityFor(card) {
  const prestige = prestigeScore(card);
  const index = RARITIES.findIndex((r) => prestige >= r.min);
  const tier = RARITIES[index];
  const above = index > 0 ? RARITIES[index - 1] : null;

  return {
    id: tier.id,
    label: tier.label,
    blurb: tier.blurb,
    prestige,
    next: above ? { label: above.label, needed: above.min - prestige } : null,
    progress: above ? (prestige - tier.min) / (above.min - tier.min) : 1,
  };
}

// Map<managerKey, { rank, total }> -- each card's place on the prestige ladder
// (ties share a rank, then break by titles so the more decorated card wins).
export function prestigeRanks(cards) {
  const sorted = [...cards].sort((a, b) => prestigeScore(b) - prestigeScore(a) || (b.titles ?? 0) - (a.titles ?? 0));
  const map = new Map();
  let lastScore = null;
  let lastRank = 0;
  sorted.forEach((card, i) => {
    const score = prestigeScore(card);
    const rank = score === lastScore ? lastRank : i + 1;
    lastScore = score;
    lastRank = rank;
    map.set(card.managerKey, { rank, total: sorted.length });
  });
  return map;
}

// Stable 0-359 number from a key -- gives every card its own foil hue so two
// cards of the same rarity still don't look identical.
export function seedHue(key) {
  let h = 0;
  for (const ch of String(key ?? "")) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
