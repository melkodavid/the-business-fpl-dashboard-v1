# FPL Draft League Dashboard

A static dashboard for a 12-team FPL Draft league. A scheduled GitHub Action pulls
data from the Draft API (`draft.premierleague.com/api/...`), computes every stat in
[`fpl-draft-dashboard-spec-v1.md`](fpl-draft-dashboard-spec-v1.md), and writes the
results to `data/*.json`. The frontend (`index.html` + `js/` + `css/`) is a
dependency-free static site that just reads those JSON files — there's no backend
and no build step, so GitHub Pages can serve the repo directly.

## Season rollover checklist

Run through this at the start of each new season, before the first real Action run:

1. **Verify returning managers' `personKey`s are unchanged.** `personKey` is derived
   automatically from each manager's FPL account first name (lowercased — see
   `personKeyFor()` in `scripts/context.js`), and it's the join key for
   `data/manager-profiles.json`, `data/league-lore.json`, and `data/history-seasons.json`.
   Every lookup against those files is tolerant by design (an unrecognized key just
   falls back to defaults instead of throwing), so a mismatch **fails silently** —
   a manager would simply lose their color/abbreviation, honors, and lore instead
   of erroring. **Muk is the manager to double-check specifically**: if his FPL
   account's first name ever gets re-registered or re-synced as "Marcus" instead of
   "Muk", the fetcher will mint a fresh `marcus` personKey and orphan all of his
   existing history under `muk`. Confirm each returning manager's derived key
   still matches what's already in those three files before trusting the first
   build's output.
2. **Add lore entries for any new managers** — this season that's carm and zach —
   to `data/league-lore.json` (nicknames, generation, family, bridesmaid status;
   see the existing entries for the shape). An entry is optional — a manager with
   no lore entry just gets plain rendering — but the family/generation-war/gauntlet
   detectors can only ever reference managers who have one.
3. **Set `LEAGUE_ID`** (see below).
4. **Set `CUP_ROUND_GWS`** (see below).
5. **Set the `lu-post-mark-era` lore flag** once it's actually relevant (Lu's
   detector-driven "Life After Mark" storylines are gated entirely behind
   `lu.flags` containing `"lu-post-mark-era"` in `data/league-lore.json` — leave it
   unset for any season where that arc isn't live).

## Setting `LEAGUE_ID` when the season starts

Open [`config.js`](config.js) and set:

```js
LEAGUE_ID: 12345, // your league's ID from its draft.premierleague.com URL
```

That's it — everything else (fetchers, stat modules, cup bracket, frontend) works
unmodified once a real ID is in place. Until then, `LEAGUE_ID` is a placeholder, and
the `data/*.json` currently committed in this repo are **mock output** (built from
`data/mock/`, labeled as such in the footer) so the dashboard has something to show.
The first Action run against a real `LEAGUE_ID` overwrites them with real data.

## Setting `CUP_ROUND_GWS`

Also in `config.js`:

```js
CUP_ROUND_GWS: {
  round1: [9],       // single GW
  round2: [18, 19],  // two-GW aggregate
  round3: [27, 28],  // two-GW aggregate
  round4: [36],      // single GW
},
```

Pick these once the season's official fixture list is published. **Before locking
them in, manually check that none of these gameweeks land on a known blank or
double gameweek** for a team that could still be alive in the cup at that stage —
this can't be reliably automated (see the spec's FA Cup Ruleset section). If a
gameweek is a problem, shift that round to the nearest suitable week.

## Enabling GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Build and deployment → Source: **Deploy from a branch**.
3. Branch: your default branch, folder **/ (root)**.
4. Save. The site will build at `https://<user>.github.io/<repo>/`.

(`.nojekyll` is already present so GitHub Pages serves the files as-is.)

## Enabling the scheduled Action

The workflow at [`.github/workflows/update-data.yml`](.github/workflows/update-data.yml)
runs on an hourly cron once it's on the default branch — nothing else to configure.
It fetches fresh data, recomputes every stat, and commits `data/` (and `cache/`) back
to the repo if anything changed.

- **Adjust the schedule**: edit the `cron` expression in the workflow file.
- **Run it manually**: repo → Actions tab → "Update league data" → Run workflow.
- It needs `contents: write` (already set in the workflow) so it can push its own
  commits using the default `GITHUB_TOKEN` — no extra secrets required.

## Running locally against mock data

No `LEAGUE_ID` needed for any of this — everything runs against the fake 12-team
season in `data/mock/`.

```sh
node scripts/build.js --mock   # (re)computes data/*.json from data/mock/
npm test                        # runs the unit + integration test suite
npm run serve                   # serves the repo at http://localhost:8080
```

Open `http://localhost:8080` in a browser — `fetch()` of local JSON files needs an
actual HTTP server, so opening `index.html` directly (`file://`) won't work.

To regenerate the mock fixtures themselves (e.g. after changing the generator):

```sh
node scripts/mock/generate.js
```

## Running against the real league

Once `LEAGUE_ID` is set:

```sh
node scripts/build.js
```

This fetches live data instead of reading `data/mock/`, and caches each *finished*
gameweek's raw API responses under `cache/events/` so future runs don't re-fetch a
gameweek that's already over. The in-progress gameweek is always re-fetched fresh.

## Repo layout

```
config.js              LEAGUE_ID / CUP_ROUND_GWS
scripts/
  build.js              orchestrator: fetch → cache → compute → write data/
  fetch/                one module per Draft API endpoint
  cache/                 per-finished-gameweek cache read/write
  context.js             normalizes all raw API data into one shared shape
  lib/                   shared helpers (optimal-XI solver, roster timeline, etc.)
  stats/                 one module per spec section (standings, all-play, ...)
  cup/bracket.js          FA Cup seeding, random draws, results, tiebreakers
  mock/                  mock-data generator + loader
  narrative/              weekly recap engine (see fpl-draft-dashboard-spec-v1.md
                           and narrative-layer-brief.md): detectors/ (one
                           storyline detector per rule), select.js (scoring +
                           per-GW headline/secondary picks), render.js +
                           templates.json (fills each storyline's template),
                           seasonArcs.js (front-page arc widgets), archive.js
                           (immutable data/recaps/gw{N}.json writer)
data/
  mock/                   fixture data for a fake 12-team league
  league-lore.json         hand-edited nicknames/family/generation/bridesmaid/
                           rivalry data, keyed by personKey (see the season
                           rollover checklist above)
  recaps/                  one immutable gw{N}.json per finished GW plus
                           index.json, written by scripts/narrative/archive.js
  *.json                  generated output the frontend reads (git-ignored from
                           this list only in the sense that they're written by
                           build.js — they're committed so Pages can serve them)
cache/events/             committed per-finished-GW raw API cache
test/                     node:test suite (test/narrative/ covers the recap engine)
index.html, css/, js/     frontend (js/render/schedule.js, taleOfTheTape.js,
                           recapSection.js, recaps.js, seasonArcWidgets.js are
                           the narrative layer's frontend half)
```

## Testing

```sh
npm test
```

Runs `node --test`, which auto-discovers everything under `test/`: unit tests for
the optimal-XI formation solver and roster-timeline helper, and an integration
suite that runs every stat module against the real mock fixtures and checks
structural invariants (e.g. the H2H grid mirrors correctly, every trade nets to
zero across both sides, positional strength "for" and "against" totals match
league-wide).
