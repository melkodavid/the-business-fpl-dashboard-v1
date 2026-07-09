// Dev tool (not part of the production build path): generates data/mock/*.json —
// a deterministic fake 12-team season, shaped exactly like the raw Draft API
// responses (see scripts/fetch/*.js), so build.js --mock can run the real
// fetch-shape-consuming pipeline (context.js, every stats/*.js module) end to end
// without a network call. Re-run with `node scripts/mock/generate.js` any time the
// fixtures need regenerating; the output is committed so tests don't depend on
// re-running this.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "..", "data", "mock");

const SEED = 20260708;
const NUM_CLUBS = 20;
const NUM_MANAGERS = 12;
const SQUAD_SIZE = 15; // 2 GKP, 5 DEF, 5 MID, 3 FWD
const FA_POOL_SIZE = 20;
const TOTAL_PLAYERS = NUM_MANAGERS * SQUAD_SIZE + FA_POOL_SIZE; // 200
const FINISHED_GWS = Array.from({ length: 10 }, (_, i) => i + 1); // GW1-10
const CURRENT_GW = 11; // not started, no data generated for it
const DGW_CLUB_ID = 5; // this club plays twice in GW7
const DGW_GW = 7;

// ---------- deterministic RNG ----------
function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(SEED);
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
const choice = (arr) => arr[Math.floor(rng() * arr.length)];
const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

// ---------- clubs ----------
const CLUB_NAME_PARTS_A = [
  "Riverside", "Northgate", "Fenwick", "Eastport", "Milbury", "Ashford", "Sandhill",
  "Kirkstone", "Bramwell", "Thorncliffe", "Wexbridge", "Hollowmere", "Cravendale",
  "Marlow", "Stonecross", "Greybrook", "Falkirk Vale", "Oakmoor", "Redditch Park", "Wintershaw",
];
const clubs = CLUB_NAME_PARTS_A.map((name, i) => ({
  id: i + 1,
  name: `${name} ${choice(["United", "City", "Town", "Rovers", "Athletic", "Wanderers"])}`,
  short_name: name.slice(0, 3).toUpperCase(),
}));

// ---------- players ----------
const FIRST_NAMES = ["James", "Liam", "Noah", "Oliver", "Elijah", "Lucas", "Mason", "Ethan",
  "Aiden", "Jacob", "Marcus", "Kwame", "Diego", "Pierre", "Andres", "Kai", "Tomas", "Youssef",
  "Bruno", "Rafael", "Callum", "Declan", "Fabio", "Gerard", "Hugo"];
const LAST_NAMES = ["Smith", "Johnson", "Silva", "Mensah", "Costa", "Fernandez", "Novak",
  "Berg", "Okafor", "Dubois", "Rossi", "Kowalski", "Haddad", "Larsen", "Petrov", "Adeyemi",
  "Moreno", "Kalu", "Vidal", "Santos", "Weber", "Nilsson", "Osei", "Trigueros", "Halvorsen"];

// 26 GKP, 66 DEF, 68 MID, 40 FWD = 200
const typeSlots = shuffle([
  ...Array(26).fill(1),
  ...Array(66).fill(2),
  ...Array(68).fill(3),
  ...Array(40).fill(4),
]);

const players = [];
for (let i = 0; i < TOTAL_PLAYERS; i++) {
  const id = i + 1;
  const firstName = choice(FIRST_NAMES);
  const lastName = choice(LAST_NAMES);
  players.push({
    id,
    first_name: firstName,
    second_name: `${lastName}${i}`, // keep unique for readability of mock data
    web_name: `${lastName[0]}. ${lastName}${i}`,
    team: clubs[i % NUM_CLUBS].id,
    element_type: typeSlots[i],
    ability: randInt(20, 95), // mock-only field, drives simulation; not in real API
    total_points: 0, // filled in after simulation
  });
}
const playerById = new Map(players.map((p) => [p.id, p]));

// ---------- draft pool split: per position, so every manager ends up with the
// standard 2 GKP / 5 DEF / 5 MID / 3 FWD squad (matches real Draft squad rules) ----------
const SQUAD_QUOTA = { 1: 2, 2: 5, 3: 5, 4: 3 };
const DRAFTABLE_PER_TYPE = { 1: NUM_MANAGERS * 2, 2: NUM_MANAGERS * 5, 3: NUM_MANAGERS * 5, 4: NUM_MANAGERS * 3 };

const draftablePlayers = [];
const faPool = [];
for (const type of [1, 2, 3, 4]) {
  const ofType = players.filter((p) => p.element_type === type).sort((a, b) => b.ability - a.ability);
  // shuffle noise within position, so it's not a pure ability ranking
  for (let i = 0; i < ofType.length; i++) {
    if (rng() < 0.4) {
      const j = Math.max(0, Math.min(ofType.length - 1, i + randInt(-4, 4)));
      [ofType[i], ofType[j]] = [ofType[j], ofType[i]];
    }
  }
  draftablePlayers.push(...ofType.slice(0, DRAFTABLE_PER_TYPE[type]));
  faPool.push(...ofType.slice(DRAFTABLE_PER_TYPE[type]).map((p) => p.id));
}
// Overall best-first-with-noise order used as "preference order" during the draft.
const draftOrderPool = shuffle(draftablePlayers).sort((a, b) => b.ability - a.ability);
for (let i = 0; i < draftOrderPool.length; i++) {
  if (rng() < 0.4) {
    const j = Math.max(0, Math.min(draftOrderPool.length - 1, i + randInt(-4, 4)));
    [draftOrderPool[i], draftOrderPool[j]] = [draftOrderPool[j], draftOrderPool[i]];
  }
}

// ---------- managers ----------
const MANAGER_FIRST = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey", "Jamie", "Riley",
  "Drew", "Charlie", "Reese", "Quinn"];
const MANAGER_TEAM_NAMES = ["Galactic Ballers", "Midweek Warriors", "The Xavi Files",
  "Tactically Naive FC", "Bench Press United", "Draft Dodgers", "Zonal Marking Zealots",
  "Point Guardians", "The Kwoncept", "Set Piece Society", "Autopilot XI", "Sunday League Legends"];

const managers = Array.from({ length: NUM_MANAGERS }, (_, i) => ({
  leagueEntryId: i + 1, // league-scoped id, used by matches/standings
  entryId: 1000 + i + 1, // global id, used by /entry, draft choices, transactions
  entryName: MANAGER_TEAM_NAMES[i],
  playerFirstName: MANAGER_FIRST[i],
  playerLastName: `Manager${i + 1}`,
  shortName: MANAGER_TEAM_NAMES[i].split(" ").map((w) => w[0]).join("").toUpperCase(),
  waiverPick: i + 1,
}));

// ---------- draft choices (snake, 15 rounds) ----------
// Greedy pick: each manager takes the best remaining player (by the noisy
// quality order above) whose position quota they haven't already filled — the
// same constraint a real Draft squad enforces (exactly 2 GKP/5 DEF/5 MID/3 FWD).
const remainingPool = [...draftOrderPool];
const typeCountByEntry = new Map(managers.map((m) => [m.entryId, { 1: 0, 2: 0, 3: 0, 4: 0 }]));

const choices = [];
let overallIndex = 0;
for (let round = 1; round <= SQUAD_SIZE; round++) {
  const order = round % 2 === 1 ? managers : [...managers].reverse();
  for (let pos = 0; pos < NUM_MANAGERS; pos++) {
    overallIndex++;
    const manager = order[pos];
    const counts = typeCountByEntry.get(manager.entryId);
    const pickIdx = remainingPool.findIndex((p) => counts[p.element_type] < SQUAD_QUOTA[p.element_type]);
    const [player] = remainingPool.splice(pickIdx, 1);
    counts[player.element_type]++;

    choices.push({
      id: overallIndex,
      index: overallIndex,
      round,
      pick: pos + 1,
      entry: manager.entryId,
      element: player.id,
      entry_name: manager.entryName,
      player_first_name: player.first_name,
      player_last_name: player.second_name,
      choice_time: `2026-08-0${(round % 9) + 1}T12:00:00Z`,
      seconds_to_pick: randInt(10, 90),
      was_auto: false,
    });
  }
}

// initial rosters, in pick order, per manager
const initialRosterByEntry = new Map(managers.map((m) => [m.entryId, []]));
for (const c of choices) {
  initialRosterByEntry.get(c.entry).push(c.element);
}

// ---------- formation & lineup construction ----------
// Starting XI = 1 GKP, 4 DEF, 4 MID, 2 FWD (valid: DEF 3-5, MID 2-5, FWD 1-3).
// Bench = the remaining 1 GKP, 1 DEF, 1 MID, 1 FWD.
function buildLineup(roster) {
  const byType = { 1: [], 2: [], 3: [], 4: [] };
  for (const elementId of roster) {
    byType[playerById.get(elementId).element_type].push(elementId);
  }
  for (const t of [1, 2, 3, 4]) {
    byType[t].sort((a, b) => playerById.get(b).ability - playerById.get(a).ability);
  }
  const starters = [
    ...byType[1].slice(0, 1),
    ...byType[2].slice(0, 4),
    ...byType[3].slice(0, 4),
    ...byType[4].slice(0, 2),
  ];
  const bench = [
    ...byType[1].slice(1, 2),
    ...byType[2].slice(4, 5),
    ...byType[3].slice(4, 5),
    ...byType[4].slice(2, 3),
  ];
  return { starters, bench };
}

// ---------- transactions (waivers + free agents) ----------
const transactions = [];
const availableFA = [...faPool];
function pickFromFA() {
  const idx = randInt(0, availableFA.length - 1);
  return availableFA.splice(idx, 1)[0];
}

const rosterByEntry = new Map(
  [...initialRosterByEntry.entries()].map(([entryId, roster]) => [entryId, [...roster]])
);

function weakestBenchPlayer(entryId, elementType) {
  const roster = rosterByEntry.get(entryId);
  const { bench } = buildLineup(roster);
  const candidates = elementType ? bench.filter((id) => playerById.get(id).element_type === elementType) : bench;
  const pool = candidates.length ? candidates : bench;
  return pool.sort((a, b) => playerById.get(a).ability - playerById.get(b).ability)[0];
}

function applyTransaction({ event, entry, kind }) {
  const incoming = pickFromFA();
  const outgoing = weakestBenchPlayer(entry, playerById.get(incoming).element_type);
  const roster = rosterByEntry.get(entry);
  roster.splice(roster.indexOf(outgoing), 1, incoming);
  transactions.push({
    id: transactions.length + 1,
    added: `2026-${String(9 + Math.floor(event / 5)).padStart(2, "0")}-0${(event % 9) + 1}T09:00:00Z`,
    event,
    entry,
    kind,
    index: kind === "w" ? randInt(1, 12) : null,
    priority: kind === "w" ? randInt(1, 12) : null,
    element_in: incoming,
    element_out: outgoing,
    result: "a",
  });
  availableFA.push(outgoing); // dropped player returns to the FA pool
}

applyTransaction({ event: 3, entry: managers[2].entryId, kind: "w" });
applyTransaction({ event: 5, entry: managers[7].entryId, kind: "f" });
applyTransaction({ event: 8, entry: managers[2].entryId, kind: "f" });
applyTransaction({ event: 8, entry: managers[10].entryId, kind: "w" });

// ---------- one multi-for-multi trade ----------
// A trade must preserve each manager's exact squad quota (2 GKP/5 DEF/5 MID/3
// FWD), so both sides must swap matching position types — here a 2-for-2:
// each side gives one DEF and one MID from their bench, of differing quality.
const TRADE_GW = 6;
const tradeManagerA = managers[0];
const tradeManagerB = managers[1];
const rosterA = rosterByEntry.get(tradeManagerA.entryId);
const rosterB = rosterByEntry.get(tradeManagerB.entryId);

const aBench = buildLineup(rosterA).bench;
const bBench = buildLineup(rosterB).bench;
const aDef = aBench.find((id) => playerById.get(id).element_type === 2);
const aMid = aBench.find((id) => playerById.get(id).element_type === 3);
const bDef = bBench.find((id) => playerById.get(id).element_type === 2);
const bMid = bBench.find((id) => playerById.get(id).element_type === 3);

const aGivesUp = [aDef, aMid];
const bGivesUp = [bDef, bMid];
for (const el of aGivesUp) rosterA.splice(rosterA.indexOf(el), 1);
for (const el of bGivesUp) rosterB.splice(rosterB.indexOf(el), 1);
rosterA.push(...bGivesUp);
rosterB.push(...aGivesUp);

// Matches the real API's confirmed shape: tradeitem_set pairs are from
// offered_entry's perspective (they give element_out, receive element_in).
const rawTrade = {
  id: 1,
  event: TRADE_GW,
  offered_entry: tradeManagerA.entryId,
  received_entry: tradeManagerB.entryId,
  state: "p",
  tradeitem_set: [
    { element_in: bGivesUp[0], element_out: aGivesUp[0] },
    { element_in: bGivesUp[1], element_out: aGivesUp[1] },
  ],
};

// ---------- schedule (circle-method round robin, 11 rounds for 12 teams) ----------
function roundRobinSchedule(teams) {
  const n = teams.length;
  const rounds = [];
  const arr = [...teams];
  const fixed = arr[0];
  let rest = arr.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const roundTeams = [fixed, ...rest];
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      pairs.push([roundTeams[i], roundTeams[n - 1 - i]]);
    }
    rounds.push(pairs);
    rest = [rest[rest.length - 1], ...rest.slice(0, rest.length - 1)];
  }
  return rounds;
}
const schedule = roundRobinSchedule(managers); // 11 rounds, index 0 = GW1

// ---------- roster-at-GW helper: apply transactions/trade in event order ----------
function rosterAtGw(entryId, gw) {
  // Recompute chronologically from the initial roster, since rosterByEntry above
  // already reflects the *final* state. Replay events up to `gw`.
  let roster = [...initialRosterByEntry.get(entryId)];
  const events = [];
  for (const t of transactions) {
    if (t.event <= gw && t.entry === entryId) events.push({ event: t.event, out: t.element_out, in: t.element_in });
  }
  if (TRADE_GW <= gw) {
    if (entryId === tradeManagerA.entryId) {
      events.push({ event: TRADE_GW, out: aGivesUp[0], in: bGivesUp[0] }, { event: TRADE_GW, out: aGivesUp[1], in: bGivesUp[1] });
    }
    if (entryId === tradeManagerB.entryId) {
      events.push({ event: TRADE_GW, out: bGivesUp[0], in: aGivesUp[0] }, { event: TRADE_GW, out: bGivesUp[1], in: aGivesUp[1] });
    }
  }
  events.sort((a, b) => a.event - b.event);
  for (const e of events) {
    if (e.out && roster.includes(e.out)) roster.splice(roster.indexOf(e.out), 1);
    if (e.in && !roster.includes(e.in)) roster.push(e.in);
  }
  return roster;
}

// ---------- fixture stat simulation ----------
function appearancePoints(minutes) {
  if (minutes >= 60) return 2;
  if (minutes > 0) return 1;
  return 0;
}
const GOAL_POINTS = { 1: 6, 2: 6, 3: 5, 4: 4 };
const CS_POINTS = { 1: 4, 2: 4, 3: 1, 4: 0 };
const DC_THRESHOLD = { 2: 10, 3: 12, 4: 12 };

function simulateMinutes(ability) {
  const p = ability / 100;
  const weights = [0.1, 0.06, 0.05, 0.04, 0.35, 0.4]; // 0, 1-44, 45-58, 59, 60-89, 90
  weights[0] = Math.max(0.02, weights[0] - p * 0.06);
  weights[5] = weights[5] + p * 0.06;
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  let bucket = 0;
  for (; bucket < weights.length; bucket++) {
    if (roll < weights[bucket]) break;
    roll -= weights[bucket];
  }
  switch (bucket) {
    case 0: return 0;
    case 1: return randInt(1, 44);
    case 2: return randInt(45, 58);
    case 3: return 59;
    case 4: return randInt(60, 89);
    default: return 90;
  }
}

function simulateFixture(player, clubCleanSheet) {
  const ability = player.ability;
  const p = ability / 100;
  const minutes = simulateMinutes(ability);
  const played = minutes > 0;
  const elementType = player.element_type;

  let goals = 0;
  if (played) {
    const goalChance = { 1: 0.002, 2: 0.03, 3: 0.08, 4: 0.14 }[elementType] * p;
    if (rng() < goalChance) goals = rng() < 0.15 ? 2 : 1;
  }
  let assists = 0;
  if (played) {
    const assistChance = { 1: 0.005, 2: 0.04, 3: 0.10, 4: 0.08 }[elementType] * p;
    if (rng() < assistChance) assists = 1;
  }
  const cleanSheet = played && minutes >= 60 && clubCleanSheet;
  const dc = elementType === 1 ? 0 : Math.round(randInt(0, elementType === 2 ? 16 : 14) * (0.5 + p * 0.5));
  const yellow = played && rng() < 0.1 ? 1 : 0;
  const red = played && rng() < 0.01 ? 1 : 0;
  const bonusRoll = rng();
  const bonus = bonusRoll > 0.93 ? 3 : bonusRoll > 0.83 ? 2 : bonusRoll > 0.68 ? 1 : 0;

  const dcBonus = elementType !== 1 && dc >= DC_THRESHOLD[elementType] ? 2 : 0;
  const points =
    appearancePoints(minutes) +
    GOAL_POINTS[elementType] * goals +
    3 * assists +
    (cleanSheet ? CS_POINTS[elementType] : 0) +
    dcBonus +
    bonus -
    yellow -
    3 * red;

  return { minutes, goals, assists, cleanSheet, defensiveContribution: dc, yellow, red, bonus, points };
}

// live[gw] = { elements: { [playerId]: { explain: [{fixture,stats}], stats: {...} } } }
const liveByGw = {};
const seasonTotals = new Map(players.map((p) => [p.id, 0]));

for (const gw of FINISHED_GWS) {
  const clubCleanSheetByFixture = new Map(); // key `${clubId}:${fixtureNum}` -> bool
  const elements = {};

  for (const player of players) {
    const isDgwPlayer = gw === DGW_GW && player.team === DGW_CLUB_ID;
    const fixtureCount = isDgwPlayer ? 2 : 1;
    const fixtureResults = [];

    for (let f = 1; f <= fixtureCount; f++) {
      const csKey = `${player.team}:${f}`;
      if (!clubCleanSheetByFixture.has(csKey)) clubCleanSheetByFixture.set(csKey, rng() < 0.32);
      const result = simulateFixture(player, clubCleanSheetByFixture.get(csKey));
      fixtureResults.push({ fixtureId: gw * 100 + player.team * 10 + f, ...result });
    }

    const totals = fixtureResults.reduce(
      (acc, f) => ({
        minutes: acc.minutes + f.minutes,
        goals: acc.goals + f.goals,
        assists: acc.assists + f.assists,
        cleanSheets: acc.cleanSheets + (f.cleanSheet ? 1 : 0),
        dc: acc.dc + f.defensiveContribution,
        yellow: acc.yellow + f.yellow,
        red: acc.red + f.red,
        bonus: acc.bonus + f.bonus,
        points: acc.points + f.points,
      }),
      { minutes: 0, goals: 0, assists: 0, cleanSheets: 0, dc: 0, yellow: 0, red: 0, bonus: 0, points: 0 }
    );

    elements[player.id] = {
      explain: fixtureResults.map((f) => ({
        fixture: f.fixtureId,
        stats: [
          { identifier: "minutes", points: appearancePoints(f.minutes), value: f.minutes },
          { identifier: "goals_scored", points: GOAL_POINTS[player.element_type] * f.goals, value: f.goals },
          { identifier: "assists", points: 3 * f.assists, value: f.assists },
          { identifier: "clean_sheets", points: f.cleanSheet ? CS_POINTS[player.element_type] : 0, value: f.cleanSheet ? 1 : 0 },
          { identifier: "defensive_contribution", points: 0, value: f.defensiveContribution },
          { identifier: "bonus", points: f.bonus, value: f.bonus },
          { identifier: "yellow_cards", points: -f.yellow, value: f.yellow },
          { identifier: "red_cards", points: -3 * f.red, value: f.red },
        ],
      })),
      stats: {
        minutes: totals.minutes,
        goals_scored: totals.goals,
        assists: totals.assists,
        clean_sheets: totals.cleanSheets,
        defensive_contribution: totals.dc,
        bonus: totals.bonus,
        yellow_cards: totals.yellow,
        red_cards: totals.red,
        total_points: totals.points,
      },
    };

    seasonTotals.set(player.id, seasonTotals.get(player.id) + totals.points);
  }

  liveByGw[gw] = { elements };
}

// Force one guaranteed exactly-59'-in-one-fixture-of-a-double-gameweek case,
// on a player who is in some manager's starting XI that week, so the 59 Club
// tracker has a real instance to surface.
{
  const dgwStarter = players.find((p) => p.team === DGW_CLUB_ID && p.element_type === 3);
  const rec = liveByGw[DGW_GW].elements[dgwStarter.id];
  const before = rec.explain[0].stats.find((s) => s.identifier === "minutes").value;
  rec.explain[0].stats.find((s) => s.identifier === "minutes").value = 59;
  rec.explain[0].stats.find((s) => s.identifier === "minutes").points = 1;
  const delta = appearancePoints(59) - appearancePoints(before);
  rec.stats.minutes += 59 - before;
  rec.stats.total_points += delta;
  seasonTotals.set(dgwStarter.id, seasonTotals.get(dgwStarter.id) + delta);
}

// ---------- entries (picks) per GW, and manager GW points ----------
const entriesByGw = {};
const managerGwPoints = {}; // managerGwPoints[gw][entryId] = points

for (const gw of FINISHED_GWS) {
  entriesByGw[gw] = {};
  managerGwPoints[gw] = {};

  for (const manager of managers) {
    const roster = rosterAtGw(manager.entryId, gw);
    const { starters, bench } = buildLineup(roster);
    const captain = starters[0];
    const viceCaptain = starters[1];

    const picks = [
      ...starters.map((element, i) => ({
        element,
        position: i + 1,
        is_captain: element === captain,
        is_vice_captain: element === viceCaptain,
        multiplier: element === captain ? 2 : 1,
      })),
      ...bench.map((element, i) => ({
        element,
        position: 12 + i,
        is_captain: false,
        is_vice_captain: false,
        multiplier: 0,
      })),
    ];

    const gwPoints = starters.reduce((sum, elementId) => {
      const pts = liveByGw[gw].elements[elementId].stats.total_points;
      const mult = elementId === captain ? 2 : 1;
      return sum + pts * mult;
    }, 0);

    entriesByGw[gw][manager.entryId] = {
      picks,
      entry_history: { event: gw, points: gwPoints },
      subs: [],
    };
    managerGwPoints[gw][manager.entryId] = gwPoints;
  }
}

// ---------- engineer one guaranteed "Could Have Won" case ----------
// GW4: manager[3] loses to their scheduled opponent by a small margin; swap
// their weakest starting MID for their bench MID (formation-neutral swap) so
// the optimal-XI recompute would have flipped the result.
{
  const gw = 4;
  const loserEntry = managers[3].entryId;
  const roster = rosterAtGw(loserEntry, gw);
  const { starters } = buildLineup(roster);
  const midStarters = starters.filter((id) => playerById.get(id).element_type === 3);
  const weakestStarterMid = midStarters.sort(
    (a, b) => liveByGw[gw].elements[a].stats.total_points - liveByGw[gw].elements[b].stats.total_points
  )[0];
  const benchEntry = entriesByGw[gw][loserEntry].picks.find(
    (p) => p.position >= 12 && playerById.get(p.element).element_type === 3
  );
  // Give the bench MID enough points to flip a ~5-point deficit.
  const weakestPts = liveByGw[gw].elements[weakestStarterMid].stats.total_points;
  const boosted = weakestPts + 8;
  const before = liveByGw[gw].elements[benchEntry.element].stats.total_points;
  liveByGw[gw].elements[benchEntry.element].stats.total_points = boosted;
  seasonTotals.set(benchEntry.element, seasonTotals.get(benchEntry.element) - before + boosted);
}

// ---------- engineer one guaranteed waiver "hit" ----------
// The GW8 free-agent pickup (transactions[2]) is rostered for 3 GWs; boost its
// GW8 points so points-while-rostered clears the 5-pts/GW hit threshold, so the
// Waiver Hit Rate leaderboards have at least one real hit to show alongside misses.
{
  const txn = transactions[2];
  const boostGw = txn.event;
  const before = liveByGw[boostGw].elements[txn.element_in].stats.total_points;
  const boosted = before + 12;
  liveByGw[boostGw].elements[txn.element_in].stats.total_points = boosted;
  seasonTotals.set(txn.element_in, seasonTotals.get(txn.element_in) - before + boosted);
}

// ---------- schedule -> matches/standings across GW1-10 ----------
const matches = [];
for (let round = 0; round < FINISHED_GWS.length; round++) {
  const gw = round + 1;
  for (const [homeMgr, awayMgr] of schedule[round]) {
    matches.push({
      event: gw,
      league_entry_1: homeMgr.leagueEntryId,
      league_entry_1_points: managerGwPoints[gw][homeMgr.entryId],
      league_entry_2: awayMgr.leagueEntryId,
      league_entry_2_points: managerGwPoints[gw][awayMgr.entryId],
      started: true,
      finished: true,
    });
  }
}

const standingsMap = new Map(
  managers.map((m) => [m.leagueEntryId, { played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 }])
);
for (const m of matches) {
  const home = standingsMap.get(m.league_entry_1);
  const away = standingsMap.get(m.league_entry_2);
  home.played++; away.played++;
  home.pointsFor += m.league_entry_1_points; home.pointsAgainst += m.league_entry_2_points;
  away.pointsFor += m.league_entry_2_points; away.pointsAgainst += m.league_entry_1_points;
  if (m.league_entry_1_points > m.league_entry_2_points) { home.won++; away.lost++; }
  else if (m.league_entry_1_points < m.league_entry_2_points) { away.won++; home.lost++; }
  else { home.drawn++; away.drawn++; }
}
const standings = managers
  .map((m) => {
    const s = standingsMap.get(m.leagueEntryId);
    return {
      league_entry: m.leagueEntryId,
      matches_played: s.played,
      matches_won: s.won,
      matches_drawn: s.drawn,
      matches_lost: s.lost,
      points_for: s.pointsFor,
      points_against: s.pointsAgainst,
      total: s.won * 3 + s.drawn,
    };
  })
  .sort((a, b) => b.total - a.total || b.points_for - a.points_for)
  .map((s, i) => ({ ...s, rank: i + 1 }));

// ---------- finalize player season totals ----------
for (const p of players) p.total_points = seasonTotals.get(p.id);

// ---------- write output files ----------
mkdirSync(join(OUT_DIR, "events"), { recursive: true });

function write(name, data) {
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2));
}

write("bootstrap-static.json", {
  elements: players.map(({ ability, ...rest }) => rest), // ability is mock-only, not a real API field
  teams: clubs,
  element_types: [
    { id: 1, singular_name_short: "GKP" },
    { id: 2, singular_name_short: "DEF" },
    { id: 3, singular_name_short: "MID" },
    { id: 4, singular_name_short: "FWD" },
  ],
  // Matches the real API's shape: { current, data: [...] } -- real event
  // objects only ever carry `finished`, not `is_current`/`is_next`.
  events: {
    current: CURRENT_GW,
    data: Array.from({ length: 38 }, (_, i) => ({
      id: i + 1,
      finished: i + 1 <= 10,
    })),
  },
});

write("game.json", {
  current_event: CURRENT_GW,
  current_event_finished: false,
  next_event: CURRENT_GW + 1,
  processing_status: "n",
  trades_time_for_approval: false,
  waivers_processed: true,
});

write("league-details.json", {
  league: {
    id: 1,
    name: "Mock Draft League",
    scoring: "h2h",
    variant: "draft",
    trades: "y",
    start_event: 1,
  },
  league_entries: managers.map((m) => ({
    id: m.leagueEntryId,
    entry_id: m.entryId,
    entry_name: m.entryName,
    player_first_name: m.playerFirstName,
    player_last_name: m.playerLastName,
    short_name: m.shortName,
    waiver_pick: m.waiverPick,
  })),
  matches,
  standings,
});

write("draft-choices.json", {
  choices,
  idle: [],
  element_status: players.map((p) => ({ element: p.id, owner: null, status: "a" })),
});

write("transactions.json", { transactions });
write("trades.json", { trades: [rawTrade] });

for (const gw of FINISHED_GWS) {
  write(`events/${gw}.json`, { live: liveByGw[gw], entries: entriesByGw[gw] });
}

console.log(`Generated mock fixtures for ${TOTAL_PLAYERS} players, ${NUM_MANAGERS} managers, GW1-${FINISHED_GWS.length} in ${OUT_DIR}`);
