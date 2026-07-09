import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeTrade } from "../fetch/trades.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_DIR = join(__dirname, "..", "..", "data", "mock");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

// Reads data/mock/* and shapes it exactly like the live fetch modules would
// (see scripts/fetch/*.js), so build.js --mock and the test suite both exercise
// the identical buildContext()/stats pipeline the real API feeds.
export function loadMockRaw() {
  const bootstrap = readJson(join(MOCK_DIR, "bootstrap-static.json"));
  const game = readJson(join(MOCK_DIR, "game.json"));
  const leagueDetails = readJson(join(MOCK_DIR, "league-details.json"));
  const draftChoices = readJson(join(MOCK_DIR, "draft-choices.json"));
  const transactions = readJson(join(MOCK_DIR, "transactions.json"));
  const rawTrades = readJson(join(MOCK_DIR, "trades.json"));
  const trades = { trades: (rawTrades.trades ?? []).map(normalizeTrade) };

  const eventsDir = join(MOCK_DIR, "events");
  const gws = readdirSync(eventsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => Number(f.replace(".json", "")))
    .sort((a, b) => a - b);

  const events = {};
  for (const gw of gws) events[gw] = readJson(join(eventsDir, `${gw}.json`));

  return { bootstrap, game, leagueDetails, draftChoices, transactions, trades, events };
}
