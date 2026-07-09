import { benchPointsForGw } from "../lib/benchPoints.js";

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Recomputes the league table as it stood after a specific GW (not "as of
// now") — needed because seeding is a point-in-time snapshot, and the API's
// own standings object only ever reflects the current state.
function standingsAsOf(context, throughGw) {
  const totals = new Map(
    context.managers.list.map((m) => [m.id, { won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 }])
  );
  for (const m of context.matches) {
    if (!m.finished || m.event > throughGw) continue;
    const home = totals.get(m.homeManagerId);
    const away = totals.get(m.awayManagerId);
    home.pointsFor += m.homePoints; home.pointsAgainst += m.awayPoints;
    away.pointsFor += m.awayPoints; away.pointsAgainst += m.homePoints;
    if (m.homePoints > m.awayPoints) { home.won++; away.lost++; }
    else if (m.homePoints < m.awayPoints) { away.won++; home.lost++; }
    else { home.drawn++; away.drawn++; }
  }

  return [...totals.entries()]
    .map(([managerId, t]) => ({ managerId, total: t.won * 3 + t.drawn, pointsFor: t.pointsFor }))
    .sort((a, b) => b.total - a.total || b.pointsFor - a.pointsFor)
    .map((row, i) => ({ managerId: row.managerId, seed: i + 1 }));
}

function gwScore(context, gws, managerId) {
  return gws.reduce((sum, gw) => sum + (context.gwPicks[gw]?.[managerId]?.totalPoints ?? 0), 0);
}

function benchScore(context, gws, managerId) {
  return gws.reduce((sum, gw) => sum + benchPointsForGw(context, gw, managerId), 0);
}

// Resolves a single cup match: standard score (or, for the 2-GW rounds,
// summed across both GWs), falling through the spec's tiebreakers in order.
function resolveMatch(context, gws, managerAId, managerBId, seedByManager) {
  const scoreA = gwScore(context, gws, managerAId);
  const scoreB = gwScore(context, gws, managerBId);
  if (scoreA !== scoreB) {
    return { scoreA, scoreB, winnerId: scoreA > scoreB ? managerAId : managerBId, tiebreaker: null };
  }

  const benchA = benchScore(context, gws, managerAId);
  const benchB = benchScore(context, gws, managerBId);
  if (benchA !== benchB) {
    return { scoreA, scoreB, winnerId: benchA > benchB ? managerAId : managerBId, tiebreaker: "bench" };
  }

  const seedA = seedByManager.get(managerAId);
  const seedB = seedByManager.get(managerBId);
  return { scoreA, scoreB, winnerId: seedA < seedB ? managerAId : managerBId, tiebreaker: "seed" };
}

function allGwsFinished(context, gws) {
  return gws.every((gw) => context.finishedGws.includes(gw));
}

function resolveRound(context, roundConfig, draw, seedByManager) {
  if (!allGwsFinished(context, roundConfig.gws)) return null;
  return draw.map((pairing) => ({
    ...pairing,
    ...resolveMatch(context, roundConfig.gws, pairing.managerAId, pairing.managerBId, seedByManager),
  }));
}

/**
 * @param previous the last-written data/cup.json, or null on the first run —
 *   any round already drawn there is carried forward as-is so a re-run never
 *   reshuffles an already-drawn round.
 */
export function computeCup(context, cupRoundGws, previous) {
  const seedingSnapshotGw = cupRoundGws.round1[0] - 1;
  if (!context.finishedGws.includes(seedingSnapshotGw)) {
    return { status: "pending", reason: `Waiting for GW${seedingSnapshotGw} to finish before seeding the cup.` };
  }

  const seeds = previous?.seeds ?? standingsAsOf(context, seedingSnapshotGw);
  const seedByManager = new Map(seeds.map((s) => [s.managerId, s.seed]));
  const byeSeeds = seeds.filter((s) => s.seed <= 4).map((s) => s.managerId);
  const fieldSeeds = seeds.filter((s) => s.seed > 4).map((s) => s.managerId);

  const round1Draw =
    previous?.rounds?.round1?.draw ??
    (() => {
      const shuffled = shuffle(fieldSeeds);
      const pairs = [];
      for (let i = 0; i < shuffled.length; i += 2) {
        pairs.push({ matchId: `r1-${pairs.length + 1}`, managerAId: shuffled[i], managerBId: shuffled[i + 1] });
      }
      return pairs;
    })();
  const round1Results = resolveRound(context, { gws: cupRoundGws.round1 }, round1Draw, seedByManager);

  let round2Draw = previous?.rounds?.round2?.draw ?? null;
  if (!round2Draw && round1Results) {
    const round1Winners = round1Results.map((m) => m.winnerId);
    const shuffled = shuffle([...byeSeeds, ...round1Winners]);
    round2Draw = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      round2Draw.push({ matchId: `r2-${round2Draw.length + 1}`, managerAId: shuffled[i], managerBId: shuffled[i + 1] });
    }
  }
  const round2Results = round2Draw ? resolveRound(context, { gws: cupRoundGws.round2 }, round2Draw, seedByManager) : null;

  let round3Draw = previous?.rounds?.round3?.draw ?? null;
  if (!round3Draw && round2Results) {
    const shuffled = shuffle(round2Results.map((m) => m.winnerId));
    round3Draw = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      round3Draw.push({ matchId: `r3-${round3Draw.length + 1}`, managerAId: shuffled[i], managerBId: shuffled[i + 1] });
    }
  }
  const round3Results = round3Draw ? resolveRound(context, { gws: cupRoundGws.round3 }, round3Draw, seedByManager) : null;

  let round4Draw = previous?.rounds?.round4?.draw ?? null;
  if (!round4Draw && round3Results) {
    const [a, b] = round3Results.map((m) => m.winnerId);
    round4Draw = [{ matchId: "final", managerAId: a, managerBId: b }];
  }
  const round4Results = round4Draw ? resolveRound(context, { gws: cupRoundGws.round4 }, round4Draw, seedByManager) : null;

  const champion = round4Results ? round4Results[0].winnerId : null;

  return {
    status: champion ? "complete" : "in_progress",
    seeds,
    seedingSnapshotGw,
    rounds: {
      round1: { gws: cupRoundGws.round1, draw: round1Draw, results: round1Results },
      round2: { gws: cupRoundGws.round2, draw: round2Draw, results: round2Results },
      round3: { gws: cupRoundGws.round3, draw: round3Draw, results: round3Results },
      round4: { gws: cupRoundGws.round4, draw: round4Draw, results: round4Results },
    },
    champion,
  };
}
