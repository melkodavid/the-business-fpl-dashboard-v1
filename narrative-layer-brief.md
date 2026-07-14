# NARRATIVE LAYER — Weekly Recaps, Tale of the Tape, League Lore

Read this alongside fpl-draft-dashboard-spec-v1.md. Reuse existing modules,
data files, and conventions (personKey, data/*.json outputs, build.js
pipeline, node:test). This is Option A: a deterministic rules + template
engine. No LLM calls, no new dependencies.

## 1. NEW CONFIG FILE: data/league-lore.json

Editable by hand, keyed by personKey (same convention as
manager-profiles.json). Must tolerate personKeys not present in the
current season's managers.json (and managers with no lore entry).

Schema per person:

    personKey, nicknames[] ,
    birthYear (mitch: 1847 — jokingly; render as-is),
    generation ("01s" | "2000s" | "97s" | "ancient"),
    family: { group: "palladino" | null, relation: "brother"|"cousin" },
    bridesmaid: true|false,
    flags: [] (freeform, e.g. "noah-bad-trades", "anth-belt-photos",
      "lu-post-mark-era")

Plus top-level: rivalries[] — pairs with a name and blurb, e.g.

    { pair: ["pat","noah"], name: "The Noah Who? Derby",
      blurb: "Pat printed the shirt. Noah has never forgiven him." }

Seed it with (personKey = the key already used in managers.json /
manager-profiles.json — NOT necessarily the person's real first name):

    ibrahim = "Abe" (nicknames: ["Abe"]) — real name Ibrahim Abdulnour
    muk     = "Marcus" (nicknames: ["Muk", "Marcus"]) — a Palladino
    mark    = Mark Lamascese — DIFFERENT person from muk/Marcus; not in
              the league this season (lu-post-mark-era references him)

Palladino family group: lu, muk, anthony, noah
  brothers: lu+muk; anthony+noah; the two pairs are cousins

Generations:
  01s: david, ibrahim, muk, marshall, carm, zach
  2000s: ostap, anthony
  97s: lu, noah, pat, pasquale
  ancient: mitch (birthYear 1847)

carm and zach have no personKey in the data yet (new next season) —
lore entries for them must not break anything until their keys exist;
when next season's league is created, confirm every returning manager
kept the same personKey and add carm/zach.

Nicknames: anthony: ["Neen"], muk: ["Muk"], ibrahim: ["Abe"],
lu: ["Lu"]. (Content rule below still applies to noah.)

Bridesmaids: marshall, anthony (longest-suffering, primary roast
targets); pat with situational: true. NOT ibrahim — he has 2 titles.

Title data: read from history.json (do NOT duplicate titles in lore).

CONTENT RULE: nicknames[] and all template text must stay within the
lore file and templates as provided/edited by the league. Do not add
the nickname "Hitler" for noah anywhere — use "Noah" only.

## 2. STORYLINE ENGINE: scripts/narrative/

Three layers, each independently unit-testable.

### Layer 1 — detectors/

One module each; every detector takes the shared context + lore and
returns candidate storylines with structured facts.

GENERIC:

- streaks: manager win/loss streak reaching 3+ (and each extension);
  first win after 4+ losses
- records: season-high GW score; season-low; biggest H2H blowout so far;
  closest margin; highest losing score; lowest winning score
- luck: won with a bottom-3 all-play score that GW ("daylight robbery");
  lost with a top-3 score
- lineup-pain: bench outscored starters; "could have won" trigger
  (reuse §8 solver output); 59th-minute victim (reuse §7)
- table-drama: 1st place changes hands; a manager enters/exits top 4;
  late-season mathematical elimination from the Belt race
- trades-waivers: a trade's netValue flips sign vs. the previous GW;
  a dropped/traded-away player scores 10+ against his old manager
  ("the Ex Factor"); a waiver pickup outscores every player drafted
  in round 1 that GW

LORE-DRIVEN:

- family-derby: any fixture where both managers share family.group
  ("Brother Derby" if relation is brother-brother, else "Cousin Clash")
- palladino-gauntlet: any manager whose next 3+ consecutive fixtures are
  all vs family.group=="palladino" — detect IN ADVANCE from the
  schedule ("GAUNTLET WATCH"), track progress each week, and a special
  storyline if swept 0-for-N (reference: Pat's original 0-fer)
- generation-war: running season tally of inter-generation H2H results
  (01s vs everyone else headline number, full matrix stored);
  weekly delta storyline when a generation sweeps its cross-matchups
- bridesmaids: any bridesmaid in 1st place ("don't get comfortable");
  a bridesmaid losing a match flagged importance >= 2.5;
  escalate weight sharply from GW30+ if a bridesmaid leads
- noah-trade-desk: fires whenever noah completes a trade ("Noah has
  entered the market. Historically, this goes poorly."); fires again
  when any noah trade's netValue goes negative; season running total
  of noah's net trade value surfaced whenever negative
- belt-watch: leader after each GW "carries the Belt into GW N+1"
  (presentational vocab, see Layer 3); anth-belt-photos flag adds a
  template line when anthony enters/exits top 4
- lu-post-mark: SEASON ARC, only active when lore flag lu-post-mark-era
  is set: persistent tracker of lu's rank, form, and trade count
  ("Life After Mark"); every lu trade triggers scrutiny copy noting
  his usual trade partner is gone; if lu wins the Belt, or is
  eliminated, emit a headline-weight resolution storyline. Frame as:
  defending champion (4 titles, per history.json) attempting to
  retain without Mark.

Each detector emits: { type, personKeys[], facts{...}, baseWeight,
gw, dedupeKey }.

### Layer 2 — scoring & selection (narrative/select.js)

    score = baseWeight
          * rarity multiplier (season-first > repeat)
          * magnitude scaling where numeric (margin size, streak length)
          * stakes multiplier (reuse schedule.json importance; involves
            top-2 race after GW25 = boost)
          * freshness penalty: same type headlined within last 3 GWs
            = heavy penalty; appeared at all last GW = mild penalty

Output per GW: 1 headline + 3–5 secondary items, hard cap; everything
else dropped. Deterministic given the same inputs (seed any RNG from
gw number so reruns are stable).

### Layer 3 — rendering (narrative/render.js + narrative/templates.json)

templates.json: per storyline type, 3–4 template variants with
{placeholders} filled from facts + lore (nicknames rotate in ~30% of
uses). League vocabulary constants: the title = "the Belt"; winning
it = "winning the Belt"; keep the existing bushes-blowout phrasing
from spec §4. Templates file is data, editable by the league without
touching code. Variant choice seeded by (gw, dedupeKey) so output is
stable across reruns.

## 3. STABILITY / ARCHIVE

Recaps are IMMUTABLE once their GW is finished: build.js writes
data/recaps/gw{N}.json once when finishedThroughGw >= N and never
rewrites it (existence check). data/recaps/index.json lists published
recaps. The current in-progress GW never gets a recap. Full archive
browsable on the site ("Season Story" view). Recap JSON stores the
rendered strings AND the structured facts (future-proofs an LLM
rewrite pass later without re-deriving facts).

## 4. FRONT PAGE

Reorder the site so the landing view is "This Week":

1. Latest published recap (headline styled large, secondaries below)
2. Tale of the Tape cards for the UPCOMING gw's fixtures
3. Season-arc widgets when active: Life After Mark tracker,
   Generation War scoreboard, Gauntlet Watch banner

Existing nav/sections stay; recap archive gets a nav entry.

## 5. TALE OF THE TAPE (per upcoming fixture)

Card contents, reusing existing data files:

- rivalry W-L + current rivalry streak (h2h-grid.json)
- last meeting score
- 5-GW form strip (form-guide.json)
- luck scores (all-play.json)
- positional edge: each manager's best position FOR vs opponent's
  worst AGAINST (positional-strength.json)
- fixture tag/importance (schedule.json — build on the existing fields)
- named rivalry blurb + one lore hook when applicable (family derby,
  generation war, bridesmaid stakes, gauntlet leg N)
- a form-based win-probability line derived from the two managers'
  all-play win % over the last 5 GWs (label it "Form says", show as
  e.g. "61/39" — presentational, no heavy model)

## 6. TESTS

Unit-test every detector against crafted fixtures (including: gauntlet
detected in advance; freshness penalty demotes a repeat headline;
immutability — second build run does not modify an existing recap file;
lore entries for managers absent from managers.json cause no errors;
noah/lu/bridesmaid detectors keyed correctly off personKey).

Integration: run the full engine over the committed real season data
and assert structural invariants (every finished GW gets exactly one
recap, headline always present, no template placeholder left unfilled).

## 7. README ADDITION

Add a "Season rollover checklist" section to the README covering:
verify returning managers' personKeys are unchanged (especially muk —
the fetcher must not mint a fresh "marcus" key and orphan his history),
add carm/zach, set LEAGUE_ID, set CUP_ROUND_GWS, set the
lu-post-mark-era lore flag.

## Build order

lore file + schema validation → detectors (generic first, lore-driven
second) → selection → templates/rendering → archive plumbing → front
page + Tale of the Tape UI → tests throughout.

Propose the templates.json starter content for my review before
writing all variants.
