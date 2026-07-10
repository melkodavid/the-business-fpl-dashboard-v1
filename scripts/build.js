import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import config from "../config.js";
import { fetchGame, fetchBootstrapStatic } from "./fetch/bootstrap.js";
import { fetchLeagueDetails } from "./fetch/league.js";
import { fetchDraftChoices } from "./fetch/draft.js";
import { fetchTransactions } from "./fetch/transactions.js";
import { fetchTrades } from "./fetch/trades.js";
import { fetchEntriesForEvent } from "./fetch/entries.js";
import { fetchEventLive } from "./fetch/live.js";
import { readEventCache, writeEventCache } from "./cache/store.js";
import { loadMockRaw } from "./mock/loadMockRaw.js";
import { buildContext } from "./context.js";
import { computeCup } from "./cup/bracket.js";

import { computeStandings } from "./stats/standings.js";
import { computeAllPlay } from "./stats/allPlay.js";
import { computeH2HGrid } from "./stats/h2hGrid.js";
import { computeWeeklyAwards } from "./stats/weeklyAwards.js";
import { computePositionalStrength } from "./stats/positionalStrength.js";
import { computeScoringType } from "./stats/scoringType.js";
import { computeFiftyNineClub } from "./stats/fiftyNineClub.js";
import { computeBenchStats } from "./stats/benchStats.js";
import { computeDraftGrades } from "./stats/draftGrades.js";
import { computeTradeLedger } from "./stats/tradeLedger.js";
import { computeWaiverHitRate } from "./stats/waiverHitRate.js";
import { computeFormGuide } from "./stats/formGuide.js";
import { computeHistory } from "./stats/history.js";
import { computeSchedule } from "./stats/schedule.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "data");

const MOCK = process.argv.includes("--mock");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeData(name, payload) {
  writeFileSync(join(DATA_DIR, name), JSON.stringify(payload, null, 2));
}

// "25/26"-style label for the season currently being played, derived from
// GW1's deadline so it never needs manual updating. Mock fixtures don't carry
// a real deadline, hence the fallback.
function currentSeasonLabelFrom(bootstrap) {
  const first = bootstrap.events.data?.[0];
  if (!first?.deadline_time) return "Current Season";
  const startYear = new Date(first.deadline_time).getFullYear();
  const yy = startYear % 100;
  return `${String(yy).padStart(2, "0")}/${String(yy + 1).padStart(2, "0")}`;
}

async function gatherLiveRaw() {
  const leagueId = config.LEAGUE_ID;
  const [game, bootstrap, leagueDetails, draftChoices, transactions, trades] = await Promise.all([
    fetchGame(),
    fetchBootstrapStatic(),
    fetchLeagueDetails(leagueId),
    fetchDraftChoices(leagueId),
    fetchTransactions(leagueId),
    fetchTrades(leagueId),
  ]);

  const entryIds = leagueDetails.league_entries.map((e) => e.entry_id);
  // bootstrap.events is { current, data: [...] } -- the per-GW array is .data.
  // Real event objects only ever carry `finished`, not `is_current`/`is_next`,
  // so "should we process this GW" is just "at or before the current GW".
  const gwsToProcess = bootstrap.events.data
    .filter((e) => e.id <= game.current_event)
    .map((e) => e.id);

  const events = {};
  for (const gw of gwsToProcess) {
    const cached = readEventCache(gw);
    if (cached) {
      events[gw] = cached;
      continue;
    }

    const live = await fetchEventLive(gw);
    const entries = await fetchEntriesForEvent(entryIds, gw);
    const data = { live, entries };
    events[gw] = data;

    const meta = bootstrap.events.data.find((e) => e.id === gw);
    if (meta?.finished) writeEventCache(gw, data);
  }

  return { bootstrap, game, leagueDetails, draftChoices, transactions, trades, events };
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const raw = MOCK ? loadMockRaw() : await gatherLiveRaw();
  const context = buildContext(raw);

  // A previous cup.json is only trusted as "already drawn" state if it came
  // from the same mode (mock vs. live) as this run -- otherwise a local
  // --mock run (e.g. while testing) leaves mock manager IDs in data/cup.json,
  // and a subsequent live run would find that file and "correctly" preserve
  // it as an already-drawn round, silently carrying mock data into real
  // output (and vice versa for a mock run after a live one).
  const cupPath = join(DATA_DIR, "cup.json");
  const previousCupRaw = existsSync(cupPath) ? readJson(cupPath) : null;
  const previousCup = previousCupRaw?._mock === MOCK ? previousCupRaw : null;
  const cup = { ...computeCup(context, config.CUP_ROUND_GWS, previousCup), _mock: MOCK };

  const profilesData = readJson(join(ROOT, "data", "manager-profiles.json"));
  const profileByKey = new Map(profilesData.profiles.map((p) => [p.personKey, p]));
  const historySeasonsData = readJson(join(ROOT, "data", "history-seasons.json"));
  const currentSeasonLabel = MOCK ? "Mock Season" : currentSeasonLabelFrom(raw.bootstrap);
  const history = computeHistory(context, historySeasonsData, currentSeasonLabel);

  writeData("managers.json", {
    list: context.managers.list.map((m) => {
      const profile = profileByKey.get(m.personKey);
      return {
        id: m.id,
        name: m.name,
        shortName: m.shortName,
        // Real FPL account name, unless manager-profiles.json specifies a
        // preferred display name/nickname (e.g. "Mitchell P. \"General\" Grice").
        playerName: profile?.displayName ?? m.playerName,
        personKey: m.personKey,
        color: profile?.color ?? null,
        abbreviation: profile?.abbreviation ?? m.shortName,
        titles: history.titleCounts[m.personKey] ?? 0,
      };
    }),
  });
  writeData("history.json", history);
  writeData("standings.json", computeStandings(context));
  writeData("all-play.json", computeAllPlay(context));
  writeData("h2h-grid.json", computeH2HGrid(context));
  writeData("awards.json", computeWeeklyAwards(context));
  writeData("positional-strength.json", computePositionalStrength(context));
  writeData("scoring-type.json", computeScoringType(context));
  writeData("fifty-nine-club.json", computeFiftyNineClub(context));
  writeData("bench-stats.json", computeBenchStats(context));
  writeData("draft-grades.json", computeDraftGrades(context));
  writeData("trade-ledger.json", computeTradeLedger(context));
  writeData("waiver-hit-rate.json", computeWaiverHitRate(context));
  writeData("form-guide.json", computeFormGuide(context));
  writeData("schedule.json", computeSchedule(context));
  writeData("cup.json", cup);

  writeData("meta.json", {
    lastUpdated: new Date().toISOString(),
    currentGw: context.currentGw,
    finishedThroughGw: context.finishedGws[context.finishedGws.length - 1] ?? null,
    leagueName: raw.leagueDetails?.league?.name,
    mock: MOCK,
  });

  console.log(`Build complete (${MOCK ? "mock" : "live"} data). Finished GWs: ${context.finishedGws.join(", ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
