import { currentStreak } from "../lib/streak.js";

// Spec §3 — 12x12 Head-to-Head Rivalry Grid. One cell per ordered manager pair
// (A,B); B's cell is the mirror of A's, so the frontend can render a symmetric
// grid without recomputing.
export function computeH2HGrid(context) {
  const managerIds = context.managers.list.map((m) => m.id);
  const finishedMatches = context.matches.filter((m) => m.finished).sort((a, b) => a.event - b.event);

  const cells = [];
  for (const a of managerIds) {
    for (const b of managerIds) {
      if (a === b) continue;

      const headToHead = finishedMatches
        .map((m) => {
          if (m.homeManagerId === a && m.awayManagerId === b) return { mine: m.homePoints, theirs: m.awayPoints };
          if (m.awayManagerId === a && m.homeManagerId === b) return { mine: m.awayPoints, theirs: m.homePoints };
          return null;
        })
        .filter(Boolean);

      if (headToHead.length === 0) continue;

      let wins = 0, losses = 0, draws = 0, pointsFor = 0, pointsAgainst = 0;
      const results = [];
      for (const { mine, theirs } of headToHead) {
        pointsFor += mine;
        pointsAgainst += theirs;
        if (mine > theirs) { wins++; results.push("W"); }
        else if (mine < theirs) { losses++; results.push("L"); }
        else { draws++; results.push("D"); }
      }

      cells.push({
        managerId: a,
        opponentId: b,
        wins,
        losses,
        draws,
        pointsFor,
        pointsAgainst,
        streak: currentStreak(results),
      });
    }
  }

  return { cells };
}
