// LORE-DRIVEN — any fixture where both managers share a lore family.group:
// "Brother Derby" if they're the same sibling pair, "Cousin Clash" if they
// share the group but not the pair (see lore.familyRelation).
export function detectFamilyDerby(context, lore) {
  const storylines = [];

  for (const m of context.matches) {
    if (!m.finished) continue;
    const homeKey = context.managers.byId.get(m.homeManagerId)?.personKey;
    const awayKey = context.managers.byId.get(m.awayManagerId)?.personKey;
    if (!homeKey || !awayKey) continue;

    const relation = lore.familyRelation(homeKey, awayKey);
    if (!relation) continue;

    storylines.push({
      type: relation === "brother" ? "family-brother-derby" : "family-cousin-clash",
      personKeys: [homeKey, awayKey],
      facts: {
        homeManagerId: m.homeManagerId,
        awayManagerId: m.awayManagerId,
        homePoints: m.homePoints,
        awayPoints: m.awayPoints,
        relation,
      },
      baseWeight: relation === "brother" ? 4 : 3,
      gw: m.event,
      dedupeKey: `family-derby:${m.event}:${[homeKey, awayKey].sort().join("-")}`,
    });
  }

  return storylines;
}
