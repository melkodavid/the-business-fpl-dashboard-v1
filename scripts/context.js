// Builds one normalized, in-memory object from every raw API response, so every
// stat module reads consistent field names regardless of the Draft API's own
// (sometimes inconsistent) naming.
//
// A note on confidence: bootstrap-static, /event/{gw}/live, /entry/{id}/event/{gw},
// draft choices, and transactions field names were confirmed against the live API
// this session. league/{id}/details' league_entries/matches/standings field names
// below are this project's best-documented guess (the Draft API is known to use a
// dual-ID scheme: a league-scoped `league_entry` id for matches/standings, and a
// global `entry_id` for everything else — draft choices, transactions, and the
// /entry/{id}/event endpoint). firstDefined() guards every read from that section
// so a small naming mismatch degrades gracefully instead of throwing; spot-check
// these against a real league response once LEAGUE_ID is set (see README).
function firstDefined(obj, keys) {
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function buildManagers(leagueEntries) {
  const list = leagueEntries.map((raw) => ({
    id: firstDefined(raw, ["id"]),
    entryId: firstDefined(raw, ["entry_id", "entry"]),
    name: firstDefined(raw, ["entry_name", "name"]),
    shortName: firstDefined(raw, ["short_name", "entry_short_name"]),
    playerName: [raw.player_first_name, raw.player_last_name].filter(Boolean).join(" "),
    waiverPick: firstDefined(raw, ["waiver_pick"]),
  }));

  return {
    list,
    byId: new Map(list.map((m) => [m.id, m])),
    byEntryId: new Map(list.map((m) => [m.entryId, m])),
  };
}

function buildMatches(rawMatches) {
  return rawMatches.map((raw) => ({
    event: raw.event,
    homeManagerId: firstDefined(raw, ["league_entry_1", "league_entry_1_id"]),
    homePoints: firstDefined(raw, ["league_entry_1_points", "league_entry_1_pts"]),
    awayManagerId: firstDefined(raw, ["league_entry_2", "league_entry_2_id"]),
    awayPoints: firstDefined(raw, ["league_entry_2_points", "league_entry_2_pts"]),
    started: Boolean(raw.started),
    finished: Boolean(raw.finished),
  }));
}

function buildStandings(rawStandings) {
  return rawStandings.map((raw) => ({
    managerId: firstDefined(raw, ["league_entry", "league_entry_id"]),
    rank: firstDefined(raw, ["rank"]),
    played: firstDefined(raw, ["matches_played", "played"]),
    won: firstDefined(raw, ["matches_won", "won"]),
    drawn: firstDefined(raw, ["matches_drawn", "drawn"]),
    lost: firstDefined(raw, ["matches_lost", "lost"]),
    pointsFor: firstDefined(raw, ["points_for", "pts_for"]),
    pointsAgainst: firstDefined(raw, ["points_against", "pts_against"]),
    total: firstDefined(raw, ["total", "league_points"]),
  }));
}

function buildPlayers(elements, elementTypes, teams) {
  const elementTypeById = new Map(
    elementTypes.map((t) => [t.id, t.singular_name_short ?? t.singular_name])
  );
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));

  const list = elements.map((el) => ({
    id: el.id,
    webName: el.web_name,
    firstName: el.first_name,
    secondName: el.second_name,
    teamId: el.team,
    teamName: teamNameById.get(el.team),
    elementType: el.element_type,
    positionName: elementTypeById.get(el.element_type),
    seasonTotalPoints: el.total_points,
  }));

  return { list, byId: new Map(list.map((p) => [p.id, p])) };
}

// Standard classic-FPL live "explain" shape: an array of one entry per fixture
// played that gameweek, each with a per-fixture stats breakdown. Some responses
// have been observed to flatten this to [statsArray, fixtureId] pairs instead of
// { fixture, stats }, so both are handled.
function extractFixtureBreakdowns(explain) {
  if (!Array.isArray(explain)) return [];

  return explain.map((entry) => {
    if (Array.isArray(entry)) {
      const [stats, fixtureId] = entry;
      return { fixtureId, stats: stats ?? [] };
    }
    return { fixtureId: entry.fixture, stats: entry.stats ?? [] };
  });
}

function statValue(stats, identifiers) {
  const found = stats.find((s) =>
    identifiers.includes(s.identifier ?? s.stat ?? s.name)
  );
  return found ? found.value : 0;
}

function buildGwPlayerStats(gw, live) {
  const result = {};
  for (const [elementId, data] of Object.entries(live.elements ?? {})) {
    // defensiveContribution is kept per-fixture (not just summed into the GW
    // total below) because its scoring bonus is a per-match threshold — summing
    // first would mis-score a double-gameweek player who had, say, 6 defensive
    // actions in each of two fixtures (12 combined, over the MID/FWD threshold
    // of 12) despite neither individual fixture actually crossing it.
    const fixtures = extractFixtureBreakdowns(data.explain).map((f) => ({
      fixtureId: f.fixtureId,
      minutes: statValue(f.stats, ["minutes"]),
      defensiveContribution: statValue(f.stats, ["defensive_contribution"]),
    }));

    const stats = data.stats ?? {};
    result[elementId] = {
      totalPoints: stats.total_points ?? 0,
      minutes: stats.minutes ?? 0,
      goalsScored: stats.goals_scored ?? 0,
      assists: stats.assists ?? 0,
      cleanSheets: stats.clean_sheets ?? 0,
      defensiveContribution: stats.defensive_contribution ?? 0,
      bonus: stats.bonus ?? 0,
      yellowCards: stats.yellow_cards ?? 0,
      redCards: stats.red_cards ?? 0,
      fixtures,
    };
  }
  return result;
}

function buildGwPicks(gw, entriesForGw, entryIdToManagerId) {
  const result = {};
  for (const [entryId, data] of Object.entries(entriesForGw)) {
    const picks = data.picks ?? [];
    const managerId = entryIdToManagerId.get(Number(entryId));
    result[managerId] = {
      starters: picks.filter((p) => p.position <= 11).map((p) => p.element),
      bench: picks.filter((p) => p.position >= 12).map((p) => p.element),
      captain: picks.find((p) => p.is_captain)?.element,
      viceCaptain: picks.find((p) => p.is_vice_captain)?.element,
      totalPoints: data.entry_history?.points,
    };
  }
  return result;
}

export function buildContext(raw) {
  const { bootstrap, game, leagueDetails, draftChoices, transactions, trades, events } = raw;

  const players = buildPlayers(bootstrap.elements, bootstrap.element_types, bootstrap.teams);
  const managers = buildManagers(leagueDetails.league_entries);
  const matches = buildMatches(leagueDetails.matches);
  const standings = buildStandings(leagueDetails.standings);

  // Every stat module downstream deals with a single "managerId" space (the
  // league-scoped id matches/standings already use) — draft choices,
  // transactions, trades, and per-GW picks all come from the API keyed by the
  // *global* entry id instead, so that conversion happens once, here.
  const entryIdToManagerId = new Map(managers.list.map((m) => [m.entryId, m.id]));

  const finishedGws = bootstrap.events.filter((e) => e.finished).map((e) => e.id).sort((a, b) => a - b);
  const currentGw = game.current_event;

  const gwPlayerStats = {};
  const gwPicks = {};
  for (const [gw, data] of Object.entries(events)) {
    gwPlayerStats[gw] = buildGwPlayerStats(gw, data.live);
    gwPicks[gw] = buildGwPicks(gw, data.entries, entryIdToManagerId);
  }

  const normalizedDraftChoices = draftChoices.choices.map((c) => ({
    index: c.index,
    round: c.round,
    pick: c.pick,
    managerId: entryIdToManagerId.get(c.entry),
    elementId: c.element,
  }));

  const normalizedTransactions = transactions.transactions.map((t) => ({
    id: t.id,
    event: t.event,
    managerId: entryIdToManagerId.get(t.entry),
    kind: t.kind,
    elementIn: t.element_in,
    elementOut: t.element_out,
    result: t.result,
  }));

  const normalizedTrades = trades.trades.map((t) => ({
    id: t.id,
    event: t.event,
    sides: t.sides.map((side) => ({
      managerId: entryIdToManagerId.get(side.entry),
      playersIn: side.playersIn,
      playersOut: side.playersOut,
    })),
  }));

  return {
    currentGw,
    finishedGws,
    players,
    managers,
    matches,
    standings,
    draftChoices: normalizedDraftChoices,
    transactions: normalizedTransactions,
    trades: normalizedTrades,
    gwPlayerStats,
    gwPicks,
  };
}
