// LORE-DRIVEN — any manager whose schedule has 3+ consecutive fixtures all
// against the Palladino family group. Detected from the fixed round-robin
// schedule (context.matches includes future, unplayed fixtures with known
// opponents), so the "watch" fires ahead of the run actually starting;
// progress is tracked fixture-by-fixture as the run plays out; a clean
// sweep (0-for-N) gets its own resolution storyline.
// A manager can have several separate runs in a season; announcing all of them
// at once (and from the opening week) just repeats the same line. Each recap
// only gets the manager's NEXT run, and only once it's close.
const WATCH_LEAD_GWS = 3;

export function detectPalladinoGauntlet(context, lore) {
  const storylines = [];

  for (const manager of context.managers.list) {
    const upcomingRuns = [];
    const fixtures = context.matches
      .filter((m) => m.homeManagerId === manager.id || m.awayManagerId === manager.id)
      .sort((a, b) => a.event - b.event)
      .map((m) => {
        const isHome = m.homeManagerId === manager.id;
        const opponentId = isHome ? m.awayManagerId : m.homeManagerId;
        const opponentKey = context.managers.byId.get(opponentId)?.personKey;
        const isPalladino = lore.get(opponentKey).family?.group === "palladino";
        const won = m.finished ? (isHome ? m.homePoints > m.awayPoints : m.awayPoints > m.homePoints) : null;
        return { gw: m.event, opponentId, finished: m.finished, won, isPalladino };
      });

    let i = 0;
    while (i < fixtures.length) {
      if (!fixtures[i].isPalladino) {
        i++;
        continue;
      }
      let j = i;
      while (j < fixtures.length && fixtures[j].isPalladino) j++;
      const run = fixtures.slice(i, j);

      if (run.length >= 3) {
        const startGw = run[0].gw;
        const runKey = `${manager.id}:${startGw}`;

        upcomingRuns.push({ startGw, runKey, length: run.length, opponentIds: run.map((f) => f.opponentId) });

        // PROGRESS -- one storyline per fixture in the run, the gw it resolves.
        let wins = 0;
        let played = 0;
        for (const f of run) {
          if (!f.finished) break; // run is chronological; stop at the first not-yet-played leg
          played++;
          if (f.won) wins++;
          storylines.push({
            type: "gauntlet-progress",
            personKeys: [manager.personKey],
            facts: { managerId: manager.id, wins, played, length: run.length },
            baseWeight: 2,
            gw: f.gw,
            dedupeKey: `gauntlet-progress:${runKey}:${played}`,
          });
        }

        if (played === run.length && wins === 0) {
          storylines.push({
            type: "gauntlet-swept",
            personKeys: [manager.personKey],
            facts: { managerId: manager.id, length: run.length },
            baseWeight: 5,
            gw: run[run.length - 1].gw,
            dedupeKey: `gauntlet-swept:${runKey}`,
          });
        }
      }

      i = j;
    }

    // GAUNTLET WATCH -- each finished gw announces only the next run still to
    // start, and only inside the lead window. The dedupeKey is per run, so
    // selection's freshness penalty still throttles how often it's featured.
    for (const gw of context.finishedGws) {
      const next = upcomingRuns.filter((r) => r.startGw > gw).sort((a, b) => a.startGw - b.startGw)[0];
      if (!next || next.startGw - gw > WATCH_LEAD_GWS) continue;
      storylines.push({
        type: "gauntlet-watch",
        personKeys: [manager.personKey],
        facts: { managerId: manager.id, startGw: next.startGw, length: next.length, opponentIds: next.opponentIds },
        baseWeight: 3,
        gw,
        dedupeKey: `gauntlet-watch:${next.runKey}`,
      });
    }
  }

  return storylines;
}
