// GENERIC — win/loss streaks reaching 3+ (and each further extension), plus
// a first-win-after-4+-losses relief storyline. Walks the season replay so
// each threshold crossing is attributed to the exact gw it happened.
export function detectStreaks(context, replay) {
  const storylines = [];

  for (const gw of context.finishedGws) {
    const prev = replay.before(gw);
    const current = replay.at(gw);

    for (const manager of context.managers.list) {
      const streak = current.streaksByManagerId.get(manager.id);
      const prevStreak = prev?.streaksByManagerId.get(manager.id) ?? null;
      if (!streak) continue;

      if ((streak.type === "W" || streak.type === "L") && streak.count >= 3) {
        const grew = !prevStreak || prevStreak.type !== streak.type || prevStreak.count < streak.count;
        if (grew) {
          storylines.push({
            type: "streak",
            personKeys: [manager.personKey],
            facts: { managerId: manager.id, streakType: streak.type, length: streak.count },
            baseWeight: streak.type === "W" ? 3 : 2,
            gw,
            dedupeKey: `streak:${manager.id}:${streak.type}:${streak.count}`,
          });
        }
      }

      if (streak.type === "W" && streak.count === 1 && prevStreak?.type === "L" && prevStreak.count >= 4) {
        storylines.push({
          type: "streak-break",
          personKeys: [manager.personKey],
          facts: { managerId: manager.id, brokenLength: prevStreak.count },
          baseWeight: 3,
          gw,
          dedupeKey: `streak-break:${manager.id}:${gw}`,
        });
      }
    }
  }

  return storylines;
}
