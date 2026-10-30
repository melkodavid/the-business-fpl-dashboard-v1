/**
 * The Business -- weekly predictions inbox (Google Apps Script).
 *
 * A static website can't store anything, so this tiny script is the shared
 * "ballot box": it lives in a Google Sheet, takes picks from the site, and
 * hands them back. Setup steps are in SETUP.md next to this file. It holds two
 * games side by side: the league's own head-to-heads, and real Premier League
 * results.
 *
 * Rules it enforces on the server, so nobody can tinker from their browser:
 *   - picks are only accepted before that gameweek's deadline (read live from
 *     the official Draft API, falling back to the classic FPL API);
 *   - other people's picks are NOT released until the deadline has passed, so
 *     nobody can copy anyone;
 *   - you can change your picks as often as you like until the deadline.
 *
 * Note: there are no passwords -- anyone can submit as any name before the
 * deadline. It's a friendly game, not a bank.
 */

var SHEET_NAME = "Predictions";
var HEADER = ["gw", "person", "fixture", "pick", "submittedAt"];
var MAX_FIXTURES = 20;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADER);
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// { "7": 1760695200000, ... } -- gameweek -> deadline (ms), cached for 10 minutes.
function deadlines_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get("deadlines");
  if (hit) return JSON.parse(hit);
  var urls = [
    "https://draft.premierleague.com/api/bootstrap-static",
    "https://fantasy.premierleague.com/api/bootstrap-static/"
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      var res = UrlFetchApp.fetch(urls[i], { muteHttpExceptions: true, headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.getResponseCode() !== 200) continue;
      var events = JSON.parse(res.getContentText()).events;
      events = events.data || events; // the Draft API nests the list under .data
      var out = {};
      events.forEach(function (e) { if (e.deadline_time) out[e.id] = new Date(e.deadline_time).getTime(); });
      cache.put("deadlines", JSON.stringify(out), 600);
      return out;
    } catch (err) { /* try the next source */ }
  }
  return null;
}

// Two games share the sheet: "league" (the head-to-heads, fixture "{homeId}-{awayId}")
// and "pl" (real Premier League matches, fixture "pl{fixtureId}").
function kindOf_(value) { return value === "pl" ? "pl" : "league"; }
function rowKind_(row) { return /^pl\d+$/.test(String(row[2])) ? "pl" : "league"; }

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var gw = Number(body.gw);
    var person = String(body.person || "");
    var picks = body.picks || {};
    var fixtures = Object.keys(picks);
    var kind = kindOf_(body.kind);
    var keyPattern = kind === "pl" ? /^pl\d+$/ : /^\d+-\d+$/;

    if (!gw || gw < 1 || gw > 60) return json_({ ok: false, error: "Bad gameweek." });
    if (!/^[a-z][a-z-]{1,30}$/.test(person)) return json_({ ok: false, error: "Bad name." });
    if (!fixtures.length || fixtures.length > MAX_FIXTURES) return json_({ ok: false, error: "Bad picks." });
    for (var i = 0; i < fixtures.length; i++) {
      if (!keyPattern.test(fixtures[i]) || ["H", "D", "A"].indexOf(picks[fixtures[i]]) === -1) {
        return json_({ ok: false, error: "Bad picks." });
      }
    }

    var deadlines = deadlines_();
    if (!deadlines || !deadlines[gw]) return json_({ ok: false, error: "Couldn't confirm the deadline -- try again in a minute." });
    if (Date.now() >= deadlines[gw]) return json_({ ok: false, error: "Predictions for this gameweek have closed." });

    var sh = sheet_();
    var rows = sh.getDataRange().getValues();
    for (var r = rows.length - 1; r >= 1; r--) {            // replace this person's earlier picks (in this game only)
      if (Number(rows[r][0]) === gw && rows[r][1] === person && rowKind_(rows[r]) === kind) sh.deleteRow(r + 1);
    }
    var now = new Date().toISOString();
    var out = fixtures.map(function (f) { return [gw, person, f, picks[f], now]; });
    sh.getRange(sh.getLastRow() + 1, 1, out.length, HEADER.length).setValues(out);
    return json_({ ok: true, saved: out.length });
  } catch (err) {
    return json_({ ok: false, error: "Something went wrong." });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Live scores relay. The official Draft API doesn't let web pages read it
// directly (no CORS headers), so the site's Live page asks this script instead.
// It returns one small, compact snapshot of the current gameweek -- the site
// does all the scoring (auto-subs, bonus, cup ties) itself. Everything is
// cached so a room full of people refreshing costs the Draft API one call a
// minute, not one each.
// ---------------------------------------------------------------------------
var DRAFT_API = "https://draft.premierleague.com/api";
var LEAGUE_ID = 628;

function draftGet_(path) {
  var res = UrlFetchApp.fetch(DRAFT_API + path, { muteHttpExceptions: true, headers: { "User-Agent": "Mozilla/5.0" } });
  if (res.getResponseCode() !== 200) throw new Error(path + " -> " + res.getResponseCode());
  return JSON.parse(res.getContentText());
}

function cached_(key, seconds, build) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  var value = build();
  var text = JSON.stringify(value);
  if (text.length < 95000) cache.put(key, text, seconds); // the cache refuses values over 100KB
  return value;
}

function live_() {
  return cached_("live", 50, function () {
    var game = draftGet_("/game");
    var gw = game.current_event;

    // who is in the league and this gameweek's head-to-heads (changes rarely)
    var league = cached_("league:" + gw, 900, function () {
      var d = draftGet_("/league/" + LEAGUE_ID + "/details");
      return {
        entries: d.league_entries.filter(function (x) { return x.entry_id; }).map(function (x) { return [x.id, x.entry_id]; }),
        matches: d.matches.filter(function (m) { return m.event === gw; }).map(function (m) { return [m.league_entry_1, m.league_entry_2]; })
      };
    });

    // everyone's 15 for the gameweek -- locked at the deadline, so cache longer
    var picks = cached_("picks:" + gw, 900, function () {
      var reqs = league.entries.map(function (x) {
        return { url: DRAFT_API + "/entry/" + x[1] + "/event/" + gw, muteHttpExceptions: true, headers: { "User-Agent": "Mozilla/5.0" } };
      });
      var out = {};
      UrlFetchApp.fetchAll(reqs).forEach(function (res, i) {
        if (res.getResponseCode() !== 200) return;
        out[league.entries[i][0]] = JSON.parse(res.getContentText()).picks.map(function (p) { return [p.element, p.position]; });
      });
      return out;
    });

    // player names / positions / clubs (all players, compact)
    var boot = cached_("players", 21600, function () {
      var b = draftGet_("/bootstrap-static");
      var el = {}, teams = {};
      b.elements.forEach(function (x) { el[x.id] = [x.web_name, x.element_type, x.team]; });
      b.teams.forEach(function (t) { teams[t.id] = t.short_name; });
      return { el: el, teams: teams };
    });

    var wanted = {};
    Object.keys(picks).forEach(function (k) { picks[k].forEach(function (p) { wanted[p[0]] = true; }); });

    var live = draftGet_("/event/" + gw + "/live");
    var players = {}, el = {};
    Object.keys(wanted).forEach(function (id) {
      players[id] = boot.el[id] || ["#" + id, 3, 0];
      var row = live.elements[id];
      el[id] = row ? [row.stats.total_points || 0, row.stats.minutes || 0, row.stats.bonus || 0] : [0, 0, 0];
    });
    var fixtures = (live.fixtures || []).map(function (f) {
      var stat = function (name) { return (f.stats || []).filter(function (s) { return s.s === name; })[0]; };
      var bps = stat("bps"), bonus = stat("bonus");
      var all = bps ? bps.h.concat(bps.a) : [];
      all.sort(function (x, y) { return y.value - x.value; });
      return {
        id: f.id, h: f.team_h, a: f.team_a, hs: f.team_h_score, as: f.team_a_score, k: f.kickoff_time,
        st: !!f.started, fin: !!(f.finished || f.finished_provisional),
        bon: !!(bonus && (bonus.h.length || bonus.a.length)),
        bps: all.slice(0, 8).map(function (x) { return [x.element, x.value]; })
      };
    });

    return { ok: true, gw: gw, finished: !!game.current_event_finished, fetchedAt: new Date().toISOString(),
      matches: league.matches, picks: picks, players: players, teams: boot.teams, el: el, fixtures: fixtures };
  });
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "picks";
  if (action === "live") {
    try { return json_(live_()); } catch (err) { return json_({ ok: false, error: "Live data unavailable (" + err.message + ")" }); }
  }
  var deadlines = deadlines_();
  if (!deadlines) return json_({ ok: false, error: "Couldn't confirm deadlines." });
  var rows = sheet_().getDataRange().getValues().slice(1);

  if (action === "status") {          // who has submitted for a gameweek (names only, never picks)
    var gw = Number(e.parameter.gw);
    var kind = kindOf_(e.parameter.kind);
    var seen = {};
    rows.forEach(function (r) { if (Number(r[0]) === gw && rowKind_(r) === kind) seen[r[1]] = true; });
    return json_({ ok: true, gw: gw, kind: kind, deadline: deadlines[gw] || null, submitted: Object.keys(seen) });
  }

  // everything from gameweeks whose deadline has passed
  var now = Date.now();
  var picks = [];
  rows.forEach(function (r) {
    var gw2 = Number(r[0]);
    if (deadlines[gw2] && now >= deadlines[gw2]) picks.push({ gw: gw2, person: r[1], fixture: String(r[2]), pick: r[3] });
  });
  return json_({ ok: true, picks: picks });
}
