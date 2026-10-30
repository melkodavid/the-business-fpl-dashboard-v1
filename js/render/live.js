// "Live" -- the matchday scoreboard. Pulls a compact snapshot of the current
// gameweek through the league's Apps Script relay (the Draft API can't be read
// from a web page directly) once a minute, scores it in the browser (auto-subs,
// provisional bonus, cup tie-breakers -- see lib/liveScoring.js) and lays out:
//   1. the Premier League fixtures strip,
//   2. the six league head-to-heads,
//   3. this gameweek's Grassroots Cup ties,
//   4. the league table as it would stand if the scores held.
// Every match card opens into both line-ups. Styles: css/style.css, .lv-*.
import { escapeHtml } from "../format.js";
import { getIdentity } from "../identity.js";
import { computeLive, liveTable, cupTieLive } from "../lib/liveScoring.js";

const REFRESH_MS = 60 * 1000;
// The page's look (css/style.css, .lv-<theme>). A container can ask for another
// with data-lv-theme -- the theme sampler in design-samples/ does.
const DEFAULT_THEME = "lv-house";
const themeOf = (el) => el?.dataset?.lvTheme ?? DEFAULT_THEME;
let pollTimer = null;
let tickTimer = null;
const open = new Set(); // match cards the viewer has expanded, kept across refreshes
let clicksBound = false;
let currentLoad = null;
let currentRedraw = null;
let viewMode = "current"; // or "preview": next gameweek before its deadline

const ROUND_NAME = { round1: "Round 1", round2: "Quarter-finals", round3: "Semi-finals", round4: "The Final" };
const clean = (n) => (n ?? "").replace(/\s*\*+$/, "").trim();

function kickoffText(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

function agoText(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
}

// ---------------------------------------------------------------------------
// pieces
// ---------------------------------------------------------------------------
// The Premier League's real games, grouped by day. Each one notes how many of
// the league's starting XIs have a player in it (and how many are yours), so
// you can see which kick-offs actually matter to the scoreboard above.
function plSection(payload, myId) {
  const starters = new Map(); // teamId -> { all, mine }
  for (const [managerId, picks] of Object.entries(payload.picks)) {
    for (const [element, position] of picks) {
      if (position > 11) continue;
      const team = payload.players[element]?.[2];
      const c = starters.get(team) ?? { all: 0, mine: 0 };
      c.all++;
      if (Number(managerId) === myId) c.mine++;
      starters.set(team, c);
    }
  }
  const involved = (f) => {
    const h = starters.get(f.h) ?? { all: 0, mine: 0 }, a = starters.get(f.a) ?? { all: 0, mine: 0 };
    const all = h.all + a.all, mine = h.mine + a.mine;
    return all ? `${all} of our starters${mine ? ` · <b>${mine} yours</b>` : ""}` : "None of our starters";
  };
  const card = (f) => {
    const state = f.fin ? "FT" : f.st ? "Live" : new Date(f.k).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `
      <div class="lv-plm ${f.fin ? "is-ft" : f.st ? "is-live" : ""}">
        <span class="lv-plm-t">${payload.teams[f.h] ?? "?"}</span>
        <b class="lv-plm-s">${f.st ? `${f.hs ?? 0} - ${f.as ?? 0}` : "v"}</b>
        <span class="lv-plm-t">${payload.teams[f.a] ?? "?"}</span>
        <small class="lv-plm-st">${state}</small>
        <small class="lv-plm-who">${involved(f)}</small>
      </div>`;
  };
  const byDay = new Map();
  for (const f of [...payload.fixtures].sort((x, y) => (x.k ?? "").localeCompare(y.k ?? ""))) {
    const day = f.k ? new Date(f.k).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" }) : "Date to be confirmed";
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(f);
  }
  return [...byDay].map(([day, list]) => `<h4 class="lv-day">${day}</h4><div class="lv-pl-grid">${list.map(card).join("")}</div>`).join("");
}

function progressHtml(m) {
  if (!m?.hasPicks) return `<span class="lv-prog">No line-up</span>`;
  return `<span class="lv-prog" title="${m.done} played · ${m.playing} playing now · ${m.toPlay} still to play">
    <i class="p-done">✓${m.done}</i>${m.playing ? `<i class="p-live">●${m.playing}</i>` : ""}${m.toPlay ? `<i class="p-yet">◷${m.toPlay}</i>` : ""}</span>`;
}

function playerRow(p, { benched = false } = {}) {
  const status = p.state === "live" ? "Playing now" : p.dnp ? "Didn't play" : p.state === "yet" ? `Kicks off ${kickoffText(p.kickoff)}` : p.state === "blank" ? "No game" : `${p.minutes}'`;
  const cls = ["lv-pl", `st-${p.dnp ? "dnp" : p.state}`, p.subIn ? "sub-in" : "", benched ? "benched" : ""].join(" ");
  return `<li class="${cls}" title="${escapeHtml(status)}">
    <span class="lv-pos lv-pos-${p.pos}">${p.pos}</span>
    <span class="lv-nm">${escapeHtml(p.name)}${p.subIn ? ` <em class="lv-tag">↑ sub</em>` : ""}<small>${p.team} · ${escapeHtml(status)}</small></span>
    <span class="lv-pt">${p.state === "yet" && !p.minutes ? "–" : p.points}${p.bonus ? `<sup title="Provisional bonus">+${p.bonus}</sup>` : ""}</span>
  </li>`;
}

function lineupHtml(m, managers, preview) {
  if (!m?.hasPicks) return `<div class="lv-lineup"><p class="lv-empty">Line-up not available yet.</p></div>`;
  const bench = m.bench.filter((p) => !p.usedAsSub);
  return `
    <div class="lv-lineup">
      <h4>${managers.clubHtml(m.managerId)}</h4>
      ${preview ? `<p class="lv-bench-h">Predicted XI</p>` : ""}
      <ol class="lv-xi">${m.xi.map((p) => playerRow(p)).join("")}</ol>
      <p class="lv-bench-h">Bench${preview ? "" : ` · ${m.benchPoints} pts`}</p>
      <ol class="lv-xi lv-bench">${bench.map((p) => playerRow(p)).join("")}${m.subbedOff.map((p) => playerRow(p, { benched: true })).join("")}</ol>
    </div>`;
}

function matchCard({ key, homeId, awayId, home, away, winPct, cup = null }, managers, myId, preview = false) {
  const hp = home?.points ?? 0, ap = away?.points ?? 0;
  const homeScore = cup ? cup.scoreA : hp;
  const awayScore = cup ? cup.scoreB : ap;
  const lead = homeScore > awayScore ? "home" : awayScore > homeScore ? "away" : "level";
  const isMine = homeId === myId || awayId === myId;
  const isOpen = open.has(key);
  const anyPlayed = Boolean(home?.started || away?.started);
  const allDone = home && away && !home.toPlay && !home.playing && !away.toPlay && !away.playing;
  const cupNote = cup && anyPlayed
    ? `<p class="lv-cupnote">${cup.leaderId ? `${allDone ? "Through" : "Going through"}: <b>${escapeHtml(clean(managers.name(cup.leaderId)))}</b>` : ""}${cup.by === "bench" ? " · level, ahead on bench points" : cup.by === "seed" ? " · level on points and bench, higher seed goes through" : ""}${cup.twoLegs ? " · aggregate over both gameweeks" : ""}</p>`
    : "";
  return `
    <article class="lv-match${cup ? " is-cup" : ""}${isMine ? " is-you" : ""}${isOpen ? " is-open" : ""}" data-key="${key}">
      <button type="button" class="lv-sum" aria-expanded="${isOpen}">
        <div class="lv-side lv-home${lead === "home" ? " lead" : ""}">${managers.clubHtml(homeId)}${progressHtml(home)}</div>
        <div class="lv-score">
          <span class="lv-state">${allDone && anyPlayed ? "Full time" : anyPlayed ? "Live" : "Not started"}</span>
          <div class="lv-nums"><b>${anyPlayed ? homeScore : "-"}</b><i>–</i><b>${anyPlayed ? awayScore : "-"}</b></div>
          ${allDone ? "" : `<small>proj ${home?.projected ?? "–"}–${away?.projected ?? "–"}</small>`}
        </div>
        <div class="lv-side lv-away${lead === "away" ? " lead" : ""}">${managers.clubHtml(awayId)}${progressHtml(away)}</div>
        ${!cup && !allDone ? `<div class="lv-odds" title="${anyPlayed ? "Live" : "Pre-match"} win chance"><i style="width:${winPct}%"></i><span>${winPct}%</span><span>${100 - winPct}%</span></div>` : ""}
        <span class="lv-chev" aria-hidden="true">▾</span>
      </button>
      ${cupNote}
      <div class="lv-detail"${isOpen ? "" : " hidden"}>${lineupHtml(home, managers, preview)}${lineupHtml(away, managers, preview)}</div>
    </article>`;
}

function tableHtml(rows, managers, myId) {
  const body = rows.map((r) => {
    const move = r.move > 0 ? `<i class="lv-up">▲${r.move}</i>` : r.move < 0 ? `<i class="lv-down">▼${-r.move}</i>` : `<i class="lv-same">–</i>`;
    const res = r.result;
    return `<tr class="${r.managerId === myId ? "is-you" : ""}">
      <td>${r.liveRank} ${move}</td>
      <td class="text-left">${managers.clubHtml(r.managerId)}</td>
      <td>${res ? `<span class="lv-res lv-res-${res}">${res}</span>` : ""}</td>
      <td class="lv-pf">${r.livePointsFor}</td>
      <td><b>${r.liveTotal}</b></td>
    </tr>`;
  }).join("");
  return `<div class="card lv-table"><table>
    <thead><tr><th>Pos</th><th class="text-left">Club</th><th>This GW</th><th class="lv-pf">Pts for</th><th>Pts</th></tr></thead>
    <tbody>${body}</tbody></table></div>`;
}

// Cup ties being played in this gameweek, or (before kick-off) the next ones.
function cupSection(data, live, managers, myId, preview) {
  const rounds = data.cup?.rounds ?? {};
  const entry = Object.entries(rounds).find(([, r]) => (r.gws ?? []).includes(live.gw) && r.draw?.length);
  if (!entry) {
    const next = Object.entries(rounds).find(([, r]) => (r.gws ?? [])[0] > live.gw);
    return next ? `<p class="lv-quiet">No cup games this gameweek. ${ROUND_NAME[next[0]]} starts in GW${next[1].gws[0]}.</p>` : "";
  }
  const [key, round] = entry;
  const seeds = new Map((data.cup.seeds ?? []).map((s) => [s.managerId, s.seed]));
  const ties = round.draw.filter((t) => t.managerAId && t.managerBId).map((t) => cupTieLive(t, live.managers, { legs: round.legs ?? {}, liveGw: live.gw, seeds }));
  const legNote = round.gws.length > 1 ? ` · leg ${round.gws.indexOf(live.gw) + 1} of ${round.gws.length}` : "";
  return `
    <p class="lv-sub">${ROUND_NAME[key] ?? key} · GW${round.gws.join(" + GW")}${legNote}</p>
    <div class="lv-grid">${ties.map((t) => matchCard({ key: `cup-${t.matchId}`, homeId: t.managerAId, awayId: t.managerBId, home: t.a, away: t.b, cup: t }, managers, myId, preview)).join("")}</div>`;
}

// ---------------------------------------------------------------------------
// page
// ---------------------------------------------------------------------------
function epMap(data, gw) {
  const ep = new Map();
  if (data.schedule?.lineupsMeta?.gw !== gw) return ep;
  for (const l of Object.values(data.schedule.lineups ?? {})) for (const p of [...(l.xi ?? []), ...(l.bench ?? [])]) ep.set(p.id, p.ep ?? 2);
  return ep;
}

// The next gameweek as a blank scoreboard: Premier League fixtures from the
// build, the head-to-heads and cup ties, and each side's predicted XI (the real
// line-ups only exist once the deadline locks them).
function previewPayload(data) {
  const s = data.schedule;
  if (!s?.gw || !s.plFixtures?.length || s.lineupsMeta?.gw !== s.gw) return null;
  const picks = {}, players = {}, el = {};
  for (const [id, l] of Object.entries(s.lineups ?? {})) {
    const xi = [...(l.xi ?? [])].sort((a, b) => a.type - b.type);
    picks[id] = [...xi, ...(l.bench ?? [])].map((p, i) => {
      players[p.id] = [p.name, p.type, p.teamId ?? 0];
      el[p.id] = [0, 0, 0];
      return [p.id, i + 1];
    });
  }
  return {
    gw: s.gw, finished: false, preview: true, fetchedAt: new Date().toISOString(),
    matches: s.fixtures.map((f) => [f.homeManagerId, f.awayManagerId]),
    picks, players, el, teams: s.teams ?? {},
    fixtures: s.plFixtures.map((f) => ({ ...f, hs: null, as: null, st: false, fin: false, bon: false, bps: [] })),
  };
}

function draw(root, data, managers, current) {
  const myId = managers.idForPersonKey(getIdentity());
  const nextGw = data.schedule?.gw > current.gw ? data.schedule.gw : null;
  const previewable = nextGw ? previewPayload(data) : null;
  const preview = viewMode === "preview" && Boolean(previewable);
  const payload = preview ? previewable : current;
  const live = computeLive(payload, { ep: epMap(data, payload.gw), sigma: data.schedule?.oddsMeta?.sigma });
  const includesGw = (data.meta?.finishedThroughGw ?? 0) >= payload.gw;
  const isLive = live.anyStarted && !payload.finished;
  const upcomingGw = preview ? null : nextGw;

  const matches = live.matches.map((m) => ({ ...m, key: `lg-${m.homeId}-${m.awayId}` }));
  matches.sort((x, y) => Number(y.homeId === myId || y.awayId === myId) - Number(x.homeId === myId || x.awayId === myId));

  const headline = preview ? "Preview" : isLive ? "Live" : payload.finished ? "Final" : live.anyStarted ? "Live" : "Kicks off soon";
  const firstKick = [...payload.fixtures].map((f) => f.k).filter(Boolean).sort()[0];
  const toggle = previewable
    ? `<div class="lv-mode" role="group" aria-label="Which gameweek">
        <button type="button" data-mode="current" aria-pressed="${!preview}">GW${current.gw} ${current.finished ? "Final" : "Live"}</button>
        <button type="button" data-mode="preview" aria-pressed="${preview}">GW${nextGw} Preview</button>
      </div>`
    : "";
  const banner = upcomingGw && data.schedule.deadline
    ? `<p class="lv-banner">Next up: <b>Gameweek ${upcomingGw}</b> - line-ups lock ${kickoffText(data.schedule.deadline)}. Live scoring starts at the first kick-off.</p>`
    : "";

  root.innerHTML = `
    <div class="lv ${themeOf(root)}">
      <header class="lv-head">
        <div class="lv-title">${isLive ? `<span class="lv-dot" aria-hidden="true"></span>` : ""}<h2>Gameweek ${payload.gw} <em>${headline}</em></h2></div>
        ${preview
          ? `<p class="lv-status">First kick-off ${kickoffText(firstKick)} · line-ups lock ${kickoffText(data.schedule.deadline)}</p>`
          : `<p class="lv-status"><span class="lv-long">${live.fixturesDone} of ${live.fixturesTotal} Premier League games finished</span><span class="lv-short">${live.fixturesDone}/${live.fixturesTotal} PL games done</span> · updated <span id="lv-ago">${agoText(payload.fetchedAt)}</span>
          <button type="button" class="lv-refresh" id="lv-refresh" title="Refresh now">↻</button></p>`}
      </header>
      ${toggle}
      ${banner}
      <nav class="lv-jump"><a href="#live" data-jump="lv-league">League</a><a href="#live" data-jump="lv-cup">Cup</a><a href="#live" data-jump="lv-pl"><span class="lv-long">Premier League</span><span class="lv-short">Prem</span></a><a href="#live" data-jump="lv-table">Table</a></nav>
      <section id="lv-league"><h3 class="lv-h3">The league</h3>
        <div class="lv-grid">${matches.map((m) => matchCard(m, managers, myId, preview)).join("")}</div>
      </section>
      <section id="lv-cup"><h3 class="lv-h3">🏆 The Grassroots Cup</h3>${cupSection(data, live, managers, myId, preview)}</section>
      <section id="lv-pl"><h3 class="lv-h3">Premier League</h3>${plSection(payload, myId)}</section>
      <section id="lv-table"><h3 class="lv-h3">Live table</h3>
        <p class="lv-sub">${preview ? `Current standings. Results appear here once GW${payload.gw} kicks off.` : includesGw ? "Final standings after this gameweek." : "The table if every score stays as it is now."}</p>
        ${tableHtml(liveTable(data.standings?.rows ?? [], live.matches, { includesGw }), managers, myId)}
      </section>
      <p class="lv-foot">${preview ? "Preview: the line-ups shown are each team's predicted best XI from the official FPL expected points; the real ones lock at the deadline. " : ""}Scores include provisional bonus (<sup>+n</sup>) and automatic subs, and refresh every minute. Official totals are confirmed by the Draft site after the gameweek.</p>
    </div>`;
}

function errorHtml(msg, theme = DEFAULT_THEME) {
  return `<div class="lv ${theme}"><h2 class="section-title">Live scores</h2><div class="card lv-error"><p>${msg}</p></div></div>`;
}

export function render(container, data, managers) {
  clearInterval(pollTimer);
  clearInterval(tickTimer);
  const endpoint = data.predictionsConfig?.endpoint;
  if (!endpoint) {
    container.innerHTML = errorHtml("Live scores need the league's Apps Script relay - see scripts/predictions/SETUP.md.");
    return;
  }
  container.innerHTML = `<div class="lv ${themeOf(container)}"><h2 class="section-title">Live scores</h2><div class="card lv-loading"><p>Fetching the latest scores…</p></div></div>`;
  let payload = null;

  async function load() {
    if (!document.body.contains(container) || location.hash.replace("#", "") !== "live") {
      clearInterval(pollTimer); clearInterval(tickTimer); return;
    }
    try {
      const res = await fetch(`${endpoint}?action=live&t=${Date.now()}`);
      const next = await res.json();
      if (!next.ok) throw new Error(next.error || "No data");
      // an older copy of the Apps Script ignores ?action=live and answers with predictions
      if (!Array.isArray(next.fixtures) || !next.picks || Array.isArray(next.picks)) throw new Error("the league's Apps Script needs its live-scores update - see scripts/predictions/SETUP.md");
      payload = next;
      redraw();
    } catch (err) {
      if (!payload) container.innerHTML = errorHtml(`Couldn't reach the live scores right now (${escapeHtml(err.message)}). Trying again in a minute.`);
    }
  }

  function redraw() {
    if (!payload) return;
    const y = window.scrollY;
    draw(container, data, managers, payload);
    window.scrollTo(0, y);
  }

  currentLoad = load;
  currentRedraw = redraw;
  // `container` is the app's shared page root, so bind this once per session.
  if (!clicksBound) {
    clicksBound = true;
    container.addEventListener("click", (e) => {
      if (!e.target.closest(".lv")) return;
      const jump = e.target.closest("[data-jump]");
      if (jump) { e.preventDefault(); document.getElementById(jump.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (e.target.closest("#lv-refresh")) { currentLoad?.(); return; }
      const mode = e.target.closest("[data-mode]");
      if (mode) { viewMode = mode.dataset.mode; currentRedraw?.(); return; }
      const sum = e.target.closest(".lv-sum");
      if (!sum) return;
      const card = sum.closest(".lv-match");
      const key = card.dataset.key;
      const nowOpen = !open.has(key);
      nowOpen ? open.add(key) : open.delete(key);
      card.classList.toggle("is-open", nowOpen);
      sum.setAttribute("aria-expanded", String(nowOpen));
      card.querySelector(".lv-detail").hidden = !nowOpen;
    });
  }

  load();
  pollTimer = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  tickTimer = setInterval(() => { const el = document.getElementById("lv-ago"); if (el && payload) el.textContent = agoText(payload.fetchedAt); }, 5000);
}
