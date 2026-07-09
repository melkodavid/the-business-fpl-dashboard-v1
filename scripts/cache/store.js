import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, "..", "..", "cache", "events");

function cachePath(gw) {
  return join(CACHE_DIR, `${gw}.json`);
}

export function readEventCache(gw) {
  const path = cachePath(gw);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

// Only ever called for gameweeks bootstrap-static has marked `finished`, so a
// cached file always represents a final, immutable result.
export function writeEventCache(gw, data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath(gw), JSON.stringify(data, null, 2));
}
