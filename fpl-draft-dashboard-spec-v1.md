# FPL Draft League Dashboard — V1 Feature Spec

**League size:** 12 managers
**Data source:** FPL Draft API (league details, standings, H2H results, draft choices, waiver/trade transactions, player gameweek stats)
**Waiver format:** Priority-based (rolling), not FAAB
**Architecture (fixed, not up for debate here):** Static site on GitHub Pages. Scheduled GitHub Action pulls from the Draft API, computes stats, writes JSON files the frontend reads.

**Config needed at implementation time:**
- `LEAGUE_ID` — Draft league ID (added later)
- `CUP_ROUND_GWS` — the gameweek(s) assigned to each cup round (Round 1: single GW, Round 2 & 3: two-GW aggregate pairs, Round 4: single GW) — see Cup section for target GWs and the blank/DGW-avoidance check needed before locking these in

---

## 1. Core Standings (enhanced)

Standard league table, but every row also carries:
- **Points For / Points Against** (not just W-D-L record)
- **Current streak** (e.g. W3, L2)

Source: Draft API standings endpoint directly, no computation needed beyond streak tracking.

---

## 2. All-Play Luck-Adjusted Standings

**Definition:** For each completed GW, compare a manager's score against *all 11 other managers'* scores that week (not just their actual H2H opponent). Count how many of those 11 they would have beaten (a tie counts as 0.5).

- **All-Play Win % per GW** = (opponents beaten that week, ties = 0.5) / 11
- **Expected Wins (season)** = sum of All-Play Win % across all completed GWs
- **Luck Score** = Actual Wins − Expected Wins (positive = benefiting from schedule luck, negative = unlucky)

Display: a separate "All-Play Standings" table sorted by Expected Wins, plus a Luck Score column on the main table.

---

## 3. Head-to-Head Rivalry Grid

12×12 grid, one cell per manager pair, showing:
- All-time W-L record between the two
- Total Points For / Against in matches between them
- Current streak in that specific matchup

Source: Draft API H2H results, aggregated across the season.

---

## 4. Weekly Awards

Computed per completed GW:

| Award | Definition |
|---|---|
| Top Score | Highest total points that GW |
| Mark of the Week | Lowest total points that GW |
| "[Winner] took [Loser] behind the bushes" | Biggest margin of victory in a H2H match that GW — manager names inserted dynamically into the title each week |
| Worst Lineup of the Week | Most bench points scored that GW (a manager's own starting XI vs. bench decision quality) |

Display as a running "Hall of Fame" (season tally of who's won each award most) plus a per-GW recap view.

---

## 5. Positional Strength

**For (offense):** For each manager, sum total points scored by their **starting** players only (bench excluded), broken out by position: GK, DEF, MID, FWD. "Highest scoring position" = whichever position contributed the most total points across the season for that manager.

**Against:** For each manager, sum the points scored by **opposing managers' starting players**, by position, across every H2H match that manager has played. "Highest scoring against" = the position that has produced the most points for opponents facing this manager — e.g. "defenders have scored the most points against me all season."

Display: per-manager breakdown table (For and Against side by side), plus league-wide leaderboards ("best DEF corps," "most tortured by MIDs," etc.).

Bench players are excluded from both sides of this stat.

---

## 6. Points by Scoring Type

Per manager, per season, summed across all their **starting** players' gameweek stats only (bench excluded):

- Points from **goals scored**
- Points from **assists**
- Points from **clean sheets**
- Points from **defensive contribution**
- Points from **bonus**
- Points **lost** from yellow cards / red cards — shown as a separate "discipline" leaderboard (who's bled the most points to cards)

Leaderboards: most points from goals, most from assists, most from clean sheets, most from defensive contribution, worst discipline record.

---

## 7. 59th-Minute Sub Tracker

**Definition:** A player whose minutes played in a **single fixture** equal exactly 59 — one minute short of the threshold for the second appearance point.

**Implementation note:** must be checked **per fixture**, not on a gameweek's summed minutes total — a double-gameweek player has two fixture entries that week, and aggregating first would either falsely flag them or hide a genuine 59 buried in the combined total.

**Display:** hidden/uncelebrated by default — surfaces as a rare "achievement unlocked" callout only when it actually happens, not a standing leaderboard.

---

## 8. Bench Stats

**Most Points Left on the Bench**
- Sum of points scored by all non-starting players, per GW and season total, per manager.
- Season leaderboard: most bench points wasted overall.
- Feeds the weekly Worst Lineup of the Week award (§4).

**"Could Have Won" Counter**
- For each of a manager's losses (or draws), recompute their **best possible starting XI** score that GW from their actual full roster (starters + bench), respecting valid Draft formation rules (1 GK, valid DEF/MID/FWD combination totaling 10 outfield players).
- If that optimal score would have beaten the actual opponent's score that GW, count it as a "could have won."
- **Scope note:** this is a simplified win/loss counter, not a full points-delta version (i.e. it doesn't calculate *how many points* the bad selection cost, just whether it flipped the result). The fuller point-delta version is a bigger lift (needs the same formation-validity solver) and is parked for v2 — see Parking Lot.

---

## 9. Draft Grades — Pure Draft Team Tracker

**Concept:** Track each manager's originally drafted squad as a fixed, locked snapshot — completely independent of trades, waivers, or drops for the rest of the season.

**Definition:**
- At draft completion, lock in each manager's original drafted player list. This list never changes.
- **Draft Team Points** = sum of total season points scored by every player on that original list — regardless of whether they're still on the manager's actual roster, get traded away, dropped, or picked up by someone else entirely on waivers. This is a "phantom roster" that tracks pure draft evaluation, nothing else.
- Confirmed: if a player drafted by Manager A is later traded/dropped and scores big points on Manager B's real roster, those points still count toward **Manager A's** Draft Team Points, since it's the original draft list being tracked, not current ownership.

**Display:**
- **Draft Team Points Leaderboard** (headline stat) — managers ranked by total points from their locked original draft.
- **Scatter Chart** (supporting visual) — every drafted player's overall pick number (x-axis) vs. their season points (y-axis), color-coded by drafting manager. Surfaces value picks (bottom-right cluster) and busts (top-left) at a glance.

---

## 10. Trade Ledger

**Definition:**
- For every trade, for **every individual player** involved: points scored by that specific player from the trade's effective GW through season end (or until they leave the roster again, whichever comes first).
- Per-player breakdown is shown in the trade history log, e.g.:

  *Trade #12 (GW14): Manager A receives [Player X: +38 pts, Player Y: +12 pts] for Manager B receives [Player Z: +21 pts]*

- **Net Trade Value per manager per trade** = sum of their received players' points − sum of their given-up players' points (summed here, even though the log shows individual player contributions).

**Display:**
- **Trade History Log** — sortable, full per-player breakdown per trade.
- **Net Trade Value Leaderboard** — season-long, one summed number per manager across all their trades.

---

## 11. Waiver Wire Hit Rate

**Definition:**
- **Points while rostered** = total points scored by a FA pickup while on the acquiring manager's roster, from acquisition GW onward — includes weeks the player was benched, not just started.
- **Hit threshold** = 5+ points per gameweek average.
- **Hit Rate per manager** = hits / total FA pickups.

**Leaderboards:**
- **Best Waiver Pickups** — sorted by raw total points scored while rostered.
- **Most Efficient Waivers** — sorted by points per gameweek rostered (total points while rostered ÷ gameweeks rostered). **Minimum 3 gameweeks rostered** to qualify, to avoid one-week flukes dominating the list.
- **Best One-Week Punts** — separate leaderboard for pickups rostered **fewer than 3 gameweeks**, sorted by points/gameweek rostered — houses the explosive short-hold pickups excluded from the efficiency list above.

---

## 12. Form Guide

**Definition:** Rolling total points over the manager's **last 5 completed gameweeks**.

Display: a "Who's Hot / Who's Not" mini-table updated weekly, sortable.

---

## FA Cup Ruleset

**Format:** 12-team single-elimination knockout, spread across the season rather than run consecutively at the end. Top 4 seeds get a Round 1 bye.

**Schedule (target gameweeks):**
- **Round 1** — GW9 (single gameweek), seeds 5–12 (8 teams), 4 matches
- **Round 2** (quarterfinal) — GW18–19 (two-gameweek aggregate), the 4 Round 1 winners join the 4 bye seeds, 4 matches
- **Round 3** (semifinal) — GW27–28 (two-gameweek aggregate), 4 matches → 2
- **Round 4** (final) — GW36 (single gameweek), 1 match

These target GWs give a roughly even ~9-gameweek spacing across the season. **Before locking in `CUP_ROUND_GWS`, verify none of these gameweeks land on a known blank or double gameweek** for any manager who could still be alive in the cup at that stage — if one does, shift that round's GW(s) to the nearest suitable week that avoids it. This needs a manual check against the season's official fixture list once it's published; it isn't something the automation can reliably determine on its own ahead of time.

**Seeding:** League standings snapshot taken at the end of the gameweek immediately before Round 1 (i.e. end of GW8). Seeds 1–4 = byes; seeds 5–12 = Round 1 field. Seeds are retained afterward only as tiebreaker fallback (see below) — they don't determine matchups.

**Round pairings:** Random draw each round, not a fixed bracket. Once Round 1 winners are known, they're thrown into a random draw together with the 4 bye seeds for Round 2, and the same random-draw approach carries through Round 3. No protections against repeat matchups or seed avoidance — the draw is fully random for simplicity.

**Match resolution:**
- Rounds 1 and 4 (single gameweek): standard H2H gameweek score.
- Rounds 2 and 3 (two-gameweek aggregate): sum of each manager's H2H scores across both assigned gameweeks.

**Tiebreaker (scores/aggregate exactly level):**
1. Higher total bench points (combined across both legs, for the two-gameweek rounds) that round advances
2. If still level, higher original seed (from the Round 1 seeding snapshot) advances

**No lineup set:** Use whatever final score the Draft API returns for that manager/gameweek — the API's own autosub logic already handles missing/incomplete lineups.

---

## Future Ideas — Parking Lot (not v1)

- **Consolation bracket** for Round 1 cup losers — flagged as a real option to revisit, not built for v1
- **Optimal Lineup Delta (full point-delta version)** — beyond the v1 "Could Have Won" win/loss counter, a fuller version that calculates exactly how many points a bad lineup decision cost per GW, not just whether it flipped a result
- **Best/Worst Captain Choice** — captain's points vs. the best possible captain choice from that manager's own squad that week (needs the same formation/optimal-XI solver as the above)
- **Consistency/Volatility Score** — standard deviation of weekly points per manager
- **Trade Activity Leaderboard** — most active traders by volume
- **Longest Win/Loss Streaks** — season-long streak tracking beyond the "current streak" shown on the main table
- **FAAB-specific stats** — not applicable now (league uses waiver priority), but worth a note in case the league ever switches formats
