import { apiGet } from "./client.js";

// { picks: [{ element, position, is_captain, is_vice_captain, multiplier }],
//   entry_history, subs }. picks[].position 1-11 = starting XI, 12-15 = bench.
export async function fetchEntryEvent(entryId, gw) {
  return apiGet(`/entry/${entryId}/event/${gw}`);
}

// Fetches every entry's picks for a single gameweek, keyed by entryId.
export async function fetchEntriesForEvent(entryIds, gw) {
  const results = {};
  for (const entryId of entryIds) {
    results[entryId] = await fetchEntryEvent(entryId, gw);
  }
  return results;
}
