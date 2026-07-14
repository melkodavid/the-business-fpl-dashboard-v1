// LORE-DRIVEN — running inter-generation H2H tally. Only cross-generation
// matchups count (two 97s playing each other isn't a "war"). Returns the
// storylines (weekly sweeps -- a genuine dramatic moment) separately from
// the running matrix (persistent data for the front page's "Generation War
// scoreboard" widget, not something that competes for a headline slot).
export function detectGenerationWar(context, lore) {
  const storylines = [];
  const matrix = new Map(); // `${genA}|${genB}` -> { wins, draws, losses } from genA's pov

  function cell(genA, genB) {
    const key = `${genA}|${genB}`;
    if (!matrix.has(key)) matrix.set(key, { wins: 0, draws: 0, losses: 0 });
    return matrix.get(key);
  }

  for (const gw of context.finishedGws) {
    const gwMatches = context.matches.filter((m) => m.event === gw && m.finished);
    const resultsByGeneration = new Map(); // generation -> [{ managerId, won }]

    for (const m of gwMatches) {
      const homeKey = context.managers.byId.get(m.homeManagerId)?.personKey;
      const awayKey = context.managers.byId.get(m.awayManagerId)?.personKey;
      const homeGen = lore.generationOf(homeKey);
      const awayGen = lore.generationOf(awayKey);
      if (!homeGen || !awayGen || homeGen === awayGen) continue;

      const homeWon = m.homePoints > m.awayPoints;
      const awayWon = m.awayPoints > m.homePoints;
      const drew = m.homePoints === m.awayPoints;

      const homeCell = cell(homeGen, awayGen);
      const awayCell = cell(awayGen, homeGen);
      if (drew) {
        homeCell.draws++;
        awayCell.draws++;
      } else if (homeWon) {
        homeCell.wins++;
        awayCell.losses++;
      } else {
        awayCell.wins++;
        homeCell.losses++;
      }

      for (const [gen, managerId, won] of [
        [homeGen, m.homeManagerId, homeWon],
        [awayGen, m.awayManagerId, awayWon],
      ]) {
        if (!resultsByGeneration.has(gen)) resultsByGeneration.set(gen, []);
        resultsByGeneration.get(gen).push({ managerId, won });
      }
    }

    for (const [generation, results] of resultsByGeneration) {
      if (results.length > 0 && results.every((r) => r.won)) {
        storylines.push({
          type: "generation-sweep",
          personKeys: results.map((r) => context.managers.byId.get(r.managerId)?.personKey),
          facts: { generation, count: results.length },
          baseWeight: 3,
          gw,
          dedupeKey: `generation-sweep:${gw}:${generation}`,
        });
      }
    }
  }

  const matrixObject = Object.fromEntries(
    [...matrix.entries()].map(([key, record]) => [key, record])
  );

  return { storylines, matrix: matrixObject };
}

// Convenience for the "01s vs everyone else" headline number the front page
// widget wants -- sums every cross-generation cell where 01s is genA.
export function summarize01sVsRest(matrix) {
  const totals = { wins: 0, draws: 0, losses: 0 };
  for (const [key, record] of Object.entries(matrix)) {
    if (!key.startsWith("01s|")) continue;
    totals.wins += record.wins;
    totals.draws += record.draws;
    totals.losses += record.losses;
  }
  return totals;
}
