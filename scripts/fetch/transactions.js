import { apiGet } from "./client.js";

// { transactions: [{ id, event, entry, kind: "w"|"f", element_in, element_out,
//   result: "a"|"d..." , index, priority, added }] }
// kind "w" = waiver-priority claim, "f" = instant free-agent add.
export async function fetchTransactions(leagueId) {
  return apiGet(`/draft/league/${leagueId}/transactions`);
}
