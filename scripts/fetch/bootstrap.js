import { apiGet } from "./client.js";

// Season/gameweek status: current_event, current_event_finished, next_event.
export async function fetchGame() {
  return apiGet("/game");
}

// Players, clubs, gameweek metadata, position definitions.
// { elements, teams, events, element_types }
export async function fetchBootstrapStatic() {
  return apiGet("/bootstrap-static");
}
