import { apiGet } from "./client.js";
import { fetchEntriesForEvent } from "./entries.js";
import { fetchEventLive } from "./live.js";

// Everything the matchup-odds model needs that the main fetch doesn't already
// have. Two extra sources:
//   * the classic FPL API (public, no login) -- it fills in each player's
//     expected points (ep_next / ep_this), which the Draft API leaves empty.
//     Players join across the two APIs by their stable `code`.
//   * the Draft API's element-status -- who currently owns every player, i.e.
//     each manager's squad (future gameweeks have no saved picks yet).
// Once a gameweek is under way it also pulls the real starters, the points
// scored so far, and how much of each player's fixture is still to come.
const CLASSIC_BASE = "https://fantasy.premierleague.com/api";

async function classicGet(path) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`${CLASSIC_BASE}${path}`, {
        headers: { "User-Agent": "Mozilla/5.0 (fpl-draft-dashboard build)" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
  }
  throw new Error(`classic ${path}: ${lastError.message}`);
}

// 0 = every fixture that player's club has this gameweek is over, 1 = none has
// kicked off, in between = how much of the current match is left. Averaged over
// double-gameweek fixtures.
function remainingShareByTeam(fixtures) {
  const perTeam = new Map();
  const add = (teamId, share) => {
    if (!perTeam.has(teamId)) perTeam.set(teamId, []);
    perTeam.get(teamId).push(share);
  };
  for (const f of fixtures) {
    const share = f.finished || f.finished_provisional ? 0 : f.started ? Math.max(0, (90 - (f.minutes ?? 0)) / 90) : 1;
    add(f.team_h, share);
    add(f.team_a, share);
  }
  return new Map([...perTeam].map(([team, shares]) => [team, shares.reduce((a, b) => a + b, 0) / shares.length]));
}

export async function gatherOddsInputs(context, { leagueId, gw, started }) {
  const classic = await classicGet("/bootstrap-static/");
  const classicEvent = classic.events.find((e) => e.id === gw);
  const useThis = Boolean(classicEvent?.is_current);
  const field = useThis ? "ep_this" : "ep_next";

  const byCode = new Map(classic.elements.map((e) => [e.code, e]));
  const ep = new Map();
  for (const player of context.players.list) {
    const value = Number(byCode.get(player.code)?.[field]);
    if (Number.isFinite(value)) ep.set(player.id, value);
  }
  if (ep.size === 0) throw new Error("no expected-points values returned");

  const status = await apiGet(`/league/${leagueId}/element-status`);
  const squads = new Map();
  for (const row of status.element_status ?? []) {
    if (row.owner == null) continue;
    const manager = context.managers.byEntryId.get(row.owner);
    if (!manager) continue;
    if (!squads.has(manager.id)) squads.set(manager.id, []);
    squads.get(manager.id).push(row.element);
  }

  const inputs = {
    gw,
    ep,
    squads,
    source: useThis ? "Official FPL expected points (this gameweek)" : "Official FPL expected points (next gameweek)",
  };

  if (started) {
    const entryIds = context.managers.list.map((m) => m.entryId);
    const [liveData, picks, fixtures] = await Promise.all([
      fetchEventLive(gw),
      fetchEntriesForEvent(entryIds, gw),
      classicGet(`/fixtures/?event=${gw}`),
    ]);

    const starters = new Map();
    for (const manager of context.managers.list) {
      const entry = picks[manager.entryId];
      if (!entry?.picks) continue; // lineups not locked in yet -> stay on the pre-match view for them
      starters.set(manager.id, entry.picks.filter((p) => p.position <= 11).map((p) => p.element));
    }

    const points = new Map();
    for (const [id, data] of Object.entries(liveData.elements ?? {})) points.set(Number(id), data.stats?.total_points ?? 0);

    const shareByTeam = remainingShareByTeam(fixtures);
    const remaining = new Map();
    for (const player of context.players.list) remaining.set(player.id, shareByTeam.get(player.teamId) ?? 0);

    if (starters.size > 0) inputs.live = { starters, points, remaining };
  }

  return inputs;
}
