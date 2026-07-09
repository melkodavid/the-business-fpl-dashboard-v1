import { apiGet } from "./client.js";

// { choices, idle, element_status }. `choices` is every draft pick, in draft
// order, with `index` = overall pick number across the whole draft.
export async function fetchDraftChoices(leagueId) {
  return apiGet(`/draft/${leagueId}/choices`);
}
