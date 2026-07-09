import { apiGet } from "./client.js";

// { elements: { [playerId]: { explain: [[statBreakdown[], fixtureId]], stats: {...} } } }
// `explain` holds one entry per fixture the player played that gameweek (needed
// for the 59th-minute tracker during double gameweeks); `stats` is the
// gameweek-aggregated total.
export async function fetchEventLive(gw) {
  return apiGet(`/event/${gw}/live`);
}
