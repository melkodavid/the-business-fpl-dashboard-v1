import { apiGet } from "./client.js";

// { league, league_entries, matches, standings }
export async function fetchLeagueDetails(leagueId) {
  return apiGet(`/league/${leagueId}/details`);
}
