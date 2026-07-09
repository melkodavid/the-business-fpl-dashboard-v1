import { apiGet } from "./client.js";

// { trades: [...] } — raw trade objects, from the API's own /trades endpoint
// (confirmed separate from /transactions). Real shape, confirmed against a
// completed league with actual trade history:
//   { id, event, offered_entry, received_entry, state,
//     tradeitem_set: [{ element_in, element_out }, ...] }
// `tradeitem_set` items are from `offered_entry`'s perspective (they give up
// element_out, receive element_in); `received_entry` is the exact mirror.
// Every trade returned by this endpoint has been observed with state "p" and
// a populated response_time, i.e. actually agreed -- there's no "declined"
// case to filter out the way transactions.js filters on result !== "a".
// normalizeTrade() is the single place that maps this into the project's
// canonical shape: { id, event, sides: [{ entry, playersIn, playersOut }, ...] }
export async function fetchTrades(leagueId) {
  const raw = await apiGet(`/draft/league/${leagueId}/trades`);
  return { trades: (raw.trades ?? []).map(normalizeTrade) };
}

export function normalizeTrade(raw) {
  const offeredIn = raw.tradeitem_set.map((item) => item.element_in);
  const offeredOut = raw.tradeitem_set.map((item) => item.element_out);

  return {
    id: raw.id,
    event: raw.event,
    sides: [
      { entry: raw.offered_entry, playersIn: offeredIn, playersOut: offeredOut },
      { entry: raw.received_entry, playersIn: offeredOut, playersOut: offeredIn },
    ],
  };
}
