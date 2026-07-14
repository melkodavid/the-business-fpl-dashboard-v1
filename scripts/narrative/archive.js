// Recap archive plumbing. Per the brief's stability requirement, a recap is
// immutable once its GW is finished: this only ever writes a gw{N}.json that
// doesn't already exist on disk, so re-running build.js after editing
// templates.json or league-lore.json never rewrites a previously published
// week's story. index.json is safe to fully regenerate every run since it's
// just a listing derived from whatever gw{N}.json files already exist.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const GW_FILE_RE = /^gw(\d+)\.json$/;

export function writeRecapArchive(recapsByGw, recapsDir) {
  mkdirSync(recapsDir, { recursive: true });

  for (const [gw, recap] of Object.entries(recapsByGw)) {
    const path = join(recapsDir, `gw${gw}.json`);
    if (existsSync(path)) continue;
    writeFileSync(path, JSON.stringify(recap, null, 2));
  }

  const index = readdirSync(recapsDir)
    .map((file) => file.match(GW_FILE_RE))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b)
    .map((gw) => {
      const recap = JSON.parse(readFileSync(join(recapsDir, `gw${gw}.json`), "utf-8"));
      return { gw, headline: recap.headline?.text ?? null };
    });

  writeFileSync(join(recapsDir, "index.json"), JSON.stringify({ recaps: index }, null, 2));
}
