import { apiGet } from "./client.js";

// { trades: [...] } — raw trade objects, from the API's own /trades endpoint
// (confirmed to exist and to be separate from /transactions). The sample league
// used to verify this project's other endpoints had zero trades, so the exact
// field names per side were never observed. normalizeTrade() below is the single
// place that translates whatever the API actually sends into this project's
// canonical shape:
//   { id, event, sides: [{ entry, playersIn: [elementId], playersOut: [elementId] }, ...] }
// Every stat module downstream (tradeLedger.js, rosterEvents.js) only ever reads
// the canonical shape, so if the real field names differ, only this adapter needs
// updating.
export async function fetchTrades(leagueId) {
  const raw = await apiGet(`/draft/league/${leagueId}/trades`);
  return { trades: (raw.trades ?? []).map(normalizeTrade) };
}

export function normalizeTrade(raw) {
  const sides = [];

  for (const n of [1, 2]) {
    const entry = raw[`entry${n}_entry`] ?? raw[`entry${n}`];
    if (entry === undefined) continue;

    const playersIn =
      raw[`entry${n}_players_in`] ??
      raw[`entry${n}_gaining`] ??
      raw[`entry${n}_element_in`] ??
      [];
    const playersOut =
      raw[`entry${n}_players_out`] ??
      raw[`entry${n}_losing`] ??
      raw[`entry${n}_element_out`] ??
      [];

    sides.push({
      entry,
      playersIn: Array.isArray(playersIn) ? playersIn : [playersIn],
      playersOut: Array.isArray(playersOut) ? playersOut : [playersOut],
    });
  }

  return {
    id: raw.id,
    event: raw.event,
    sides,
    _raw: raw,
  };
}
