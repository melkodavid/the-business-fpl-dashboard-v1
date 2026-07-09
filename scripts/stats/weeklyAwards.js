import { benchPointsForGw } from "../lib/benchPoints.js";
import { computeFiftyNineClub } from "./fiftyNineClub.js";

// Spec §4 — Weekly Awards, computed per completed GW, plus a running
// season "Hall of Fame" tally per award.
export function computeWeeklyAwards(context) {
  const { instances: fiftyNineInstances } = computeFiftyNineClub(context);
  const fiftyNineByGw = new Map();
  for (const inst of fiftyNineInstances) {
    if (!fiftyNineByGw.has(inst.gw)) fiftyNineByGw.set(inst.gw, []);
    fiftyNineByGw.get(inst.gw).push(inst);
  }

  const managerName = (managerId) => context.managers.byId.get(managerId)?.name;

  const recaps = [];
  const hallOfFame = {
    topScore: new Map(),
    markOfTheWeek: new Map(),
    blowout: new Map(),
    worstLineup: new Map(),
  };
  const tally = (map, managerId) => map.set(managerId, (map.get(managerId) ?? 0) + 1);

  for (const gw of context.finishedGws) {
    const scores = context.managers.list
      .map((m) => ({ managerId: m.id, score: context.gwPicks[gw]?.[m.id]?.totalPoints }))
      .filter((s) => s.score !== undefined);
    if (scores.length === 0) continue;

    const maxScore = Math.max(...scores.map((s) => s.score));
    const minScore = Math.min(...scores.map((s) => s.score));
    const topScore = scores.filter((s) => s.score === maxScore).map((s) => s.managerId);
    const lowScore = scores.filter((s) => s.score === minScore).map((s) => s.managerId);

    const gwMatches = context.matches.filter((m) => m.event === gw && m.finished);
    let blowout = null;
    for (const m of gwMatches) {
      const margin = Math.abs(m.homePoints - m.awayPoints);
      const winnerId = m.homePoints > m.awayPoints ? m.homeManagerId : m.awayManagerId;
      const loserId = m.homePoints > m.awayPoints ? m.awayManagerId : m.homeManagerId;
      const record = { winnerId, loserId, margin };
      if (!blowout || margin > blowout.margin) blowout = record;
    }

    const benchScores = context.managers.list.map((m) => ({
      managerId: m.id,
      benchPoints: benchPointsForGw(context, gw, m.id),
    }));
    const maxBench = Math.max(...benchScores.map((b) => b.benchPoints));
    const worstLineup = benchScores.filter((b) => b.benchPoints === maxBench).map((b) => b.managerId);

    for (const id of topScore) tally(hallOfFame.topScore, id);
    for (const id of lowScore) tally(hallOfFame.markOfTheWeek, id);
    if (blowout) tally(hallOfFame.blowout, blowout.winnerId);
    for (const id of worstLineup) tally(hallOfFame.worstLineup, id);

    recaps.push({
      gw,
      topScore: { managerIds: topScore, score: maxScore },
      markOfTheWeek: { managerIds: lowScore, score: minScore },
      blowout: blowout && {
        title: `${managerName(blowout.winnerId)} took ${managerName(blowout.loserId)} behind the bushes`,
        winnerId: blowout.winnerId,
        loserId: blowout.loserId,
        margin: blowout.margin,
      },
      worstLineup: { managerIds: worstLineup, benchPoints: maxBench },
      fiftyNineClubInstances: fiftyNineByGw.get(gw) ?? [],
    });
  }

  const toArray = (map) =>
    [...map.entries()].map(([managerId, count]) => ({ managerId, count })).sort((a, b) => b.count - a.count);

  return {
    recaps,
    hallOfFame: {
      topScore: toArray(hallOfFame.topScore),
      markOfTheWeek: toArray(hallOfFame.markOfTheWeek),
      blowout: toArray(hallOfFame.blowout),
      worstLineup: toArray(hallOfFame.worstLineup),
    },
  };
}
