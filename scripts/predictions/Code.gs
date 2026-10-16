/**
 * The Business -- weekly predictions inbox (Google Apps Script).
 *
 * A static website can't store anything, so this tiny script is the shared
 * "ballot box": it lives in a Google Sheet, takes picks from the site, and
 * hands them back. Setup steps are in SETUP.md next to this file.
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

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var gw = Number(body.gw);
    var person = String(body.person || "");
    var picks = body.picks || {};
    var fixtures = Object.keys(picks);

    if (!gw || gw < 1 || gw > 60) return json_({ ok: false, error: "Bad gameweek." });
    if (!/^[a-z][a-z-]{1,30}$/.test(person)) return json_({ ok: false, error: "Bad name." });
    if (!fixtures.length || fixtures.length > MAX_FIXTURES) return json_({ ok: false, error: "Bad picks." });
    for (var i = 0; i < fixtures.length; i++) {
      if (!/^\d+-\d+$/.test(fixtures[i]) || ["H", "D", "A"].indexOf(picks[fixtures[i]]) === -1) {
        return json_({ ok: false, error: "Bad picks." });
      }
    }

    var deadlines = deadlines_();
    if (!deadlines || !deadlines[gw]) return json_({ ok: false, error: "Couldn't confirm the deadline -- try again in a minute." });
    if (Date.now() >= deadlines[gw]) return json_({ ok: false, error: "Predictions for this gameweek have closed." });

    var sh = sheet_();
    var rows = sh.getDataRange().getValues();
    for (var r = rows.length - 1; r >= 1; r--) {            // replace this person's earlier picks
      if (Number(rows[r][0]) === gw && rows[r][1] === person) sh.deleteRow(r + 1);
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

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "picks";
  var deadlines = deadlines_();
  if (!deadlines) return json_({ ok: false, error: "Couldn't confirm deadlines." });
  var rows = sheet_().getDataRange().getValues().slice(1);

  if (action === "status") {          // who has submitted for a gameweek (names only, never picks)
    var gw = Number(e.parameter.gw);
    var seen = {};
    rows.forEach(function (r) { if (Number(r[0]) === gw) seen[r[1]] = true; });
    return json_({ ok: true, gw: gw, deadline: deadlines[gw] || null, submitted: Object.keys(seen) });
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
