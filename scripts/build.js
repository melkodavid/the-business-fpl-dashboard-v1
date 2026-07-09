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
  const gwsToProcess = bootstrap.events
    .filter((e) => e.id <= game.current_event && (e.finished || e.is_current))
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

    const meta = bootstrap.events.find((e) => e.id === gw);
    if (meta?.finished) writeEventCache(gw, data);
  }

  return { bootstrap, game, leagueDetails, draftChoices, transactions, trades, events };
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });

  const raw = MOCK ? loadMockRaw() : await gatherLiveRaw();
  const context = buildContext(raw);

  const cupPath = join(DATA_DIR, "cup.json");
  const previousCup = existsSync(cupPath) ? readJson(cupPath) : null;
  const cup = computeCup(context, config.CUP_ROUND_GWS, previousCup);

  writeData("managers.json", {
    list: context.managers.list.map((m) => ({ id: m.id, name: m.name, shortName: m.shortName })),
  });
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
