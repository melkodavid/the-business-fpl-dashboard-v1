import { escapeHtml } from "../format.js";
import { getIdentity } from "../identity.js";

// Weekly predictions page, with two games on their own tabs:
//   - Head-to-heads: call Home / Draw / Away for each of the league's own
//     fixtures of the coming gameweek;
//   - Premier League: the same call on every real Premier League match.
// Both lock at the gameweek deadline. A free Google Sheet (see
// scripts/predictions/) is the shared ballot box, and the hourly data job turns
// the revealed picks into the running tables in data/predictions.json and
// data/pl-predictions.json.

const STORE = "business.predictions.v1";
const LABEL = { H: "Home", D: "Draw", A: "Away" };
let clockTimer = null;

const readStore = () => { try { return JSON.parse(localStorage.getItem(STORE)) ?? {}; } catch { return {}; } };
const writeStore = (v) => { try { localStorage.setItem(STORE, JSON.stringify(v)); } catch { /* private mode */ } };

function countdownText(ms) {
  if (ms <= 0) return "Locked";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s % 60}s` : `${m}m ${s % 60}s`;
}

function tableHtml(preds, managers, myId) {
  if (!preds.table.length) {
    return `<div class="card pr-empty"><p>No results yet. Once a week's picks are locked and the matches finish, the running table appears here.</p></div>`;
  }
  const rows = preds.table.map((r) => `
    <tr class="${r.managerId === myId ? "is-me" : ""}">
      <td>${r.rank}</td>
      <td class="text-left">${managers.clubHtml(r.managerId)}</td>
      <td><b>${r.correct}</b>/${r.played}</td>
      <td>${r.pct.toFixed(1)}%</td>
      <td>${r.weeks}</td>
      <td>${r.bestWeek}</td>
      <td>${r.streak}${r.bestStreak > r.streak ? ` <small class="pr-dim">(best ${r.bestStreak})</small>` : ""}</td>
      <td>${r.perfectWeeks || "–"}</td>
      <td>${r.boldCalls ? `${r.boldHits}/${r.boldCalls}` : "–"}</td>
    </tr>`).join("");
  return `
    <div class="card">
      <table>
        <thead><tr><th>#</th><th class="text-left">Manager</th><th>Correct</th><th>Accuracy</th><th>Weeks</th><th>Best week</th><th>Streak</th><th title="Every fixture right in a week">Perfect weeks</th><th title="Going against the crowd's favourite, and being right">Bold calls</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="pr-note">Bold call = picking against the clear crowd favourite on a fixture (needs at least 4 callers). The table is ranked by accuracy so that joining late doesn't hurt.</p>`;
}

function weekGridHtml(game, week, tableRows, managers, myId) {
  const people = tableRows.filter((r) => week.picks[r.personKey]);
  const head = people.map((r) => `<th class="${r.managerId === myId ? "is-me" : ""}" title="${escapeHtml(managers.name(r.managerId))}">${escapeHtml(managers.abbreviation(r.managerId))}</th>`).join("");
  const body = week.fixtures.map((f) => {
    const cells = people.map((r) => {
      const pick = week.picks[r.personKey][f.key];
      if (!pick) return `<td><span class="pr-chip none">–</span></td>`;
      const state = !f.result ? "pend" : pick === f.result ? "hit" : "miss";
      return `<td><span class="pr-chip ${state}" title="${escapeHtml(game.pickTitle(f, pick))}">${pick}</span></td>`;
    }).join("");
    const res = f.result ? `<span class="pr-res">${escapeHtml(game.resultText(f))}</span>` : `<span class="pr-res pend">TBC</span>`;
    return `<tr><td class="text-left pr-fx">${game.gridFixtureHtml(f)} ${res}</td>${cells}</tr>`;
  }).join("");
  const score = people.map((r) => {
    const w = r.byWeek[week.gw];
    return `<td><b>${w ? `${w.correct}/${w.total}` : "–"}</b></td>`;
  }).join("");
  return `
    <div class="card pr-scroll">
      <table class="pr-grid">
        <thead><tr><th class="text-left">Gameweek ${week.gw}</th>${head}</tr></thead>
        <tbody>${body}<tr class="pr-score"><td class="text-left">Score</td>${score}</tr></tbody>
      </table>
    </div>`;
}

function weeklyMatrixHtml(preds, managers, myId) {
  const gws = preds.weeks.map((w) => w.gw);
  if (gws.length < 2) return "";
  const rows = preds.table.map((r) => `
    <tr class="${r.managerId === myId ? "is-me" : ""}">
      <td class="text-left">${managers.clubHtml(r.managerId)}</td>
      ${gws.map((g) => { const w = r.byWeek[g]; return `<td>${w ? `${w.correct}/${w.total}` : "<span class='pr-dim'>–</span>"}</td>`; }).join("")}
    </tr>`).join("");
  return `
    <h3 class="pr-h3">Week by week</h3>
    <div class="card pr-scroll"><table><thead><tr><th class="text-left">Manager</th>${gws.map((g) => `<th>GW${g}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------------------------------------------------------------- the two games

const pickButton = (val, label, sub) => `<button type="button" class="pr-pick" data-pick="${val}" aria-pressed="false">${escapeHtml(label)}${sub != null ? `<small>${escapeHtml(sub)}</small>` : ""}</button>`;

function leagueGame(data, managers) {
  const { gw, deadline, fixtures, seasonComplete } = data.schedule;
  return {
    id: "league",
    gw,
    deadline,
    open: Boolean(gw && !seasonComplete && deadline && fixtures?.length),
    preds: data.predictions ?? { weeks: [], table: [] },
    storeKey: (person) => `${gw}:${person}`,
    subtitle: "Call every head-to-head before the deadline - Home, Draw or Away - and climb the running table. One point per correct call.",
    formNote: "Small figures are the model's win odds - just a guide.",
    fixturesHtml: () => fixtures.map((f) => {
      const o = f.odds;
      const pct = (v) => (v != null ? `${v}%` : null);
      return `
        <div class="pr-fixture" data-key="${f.homeManagerId}-${f.awayManagerId}">
          <div class="pr-team home">${managers.clubHtml(f.homeManagerId)}</div>
          <div class="pr-picks">${pickButton("H", "Home", pct(o?.homeWinPct))}${pickButton("D", "Draw", pct(o?.drawPct))}${pickButton("A", "Away", pct(o?.awayWinPct))}</div>
          <div class="pr-team away">${managers.clubHtml(f.awayManagerId)}</div>
        </div>`;
    }).join(""),
    gridFixtureHtml: (f) => `${managers.clubHtml(f.home)} <span class="pr-vs">v</span> ${managers.clubHtml(f.away)}`,
    resultText: (f) => (f.result === "D" ? "Draw" : `${LABEL[f.result]} win`),
    pickTitle: (f, pick) => LABEL[pick],
  };
}

function plGame(data) {
  const pl = data.plPredictions ?? { fixtures: [], weeks: [], table: [], teams: {} };
  const team = (id) => pl.teams?.[id] ?? { name: `Team ${id}`, short: "?" };
  const crest = (id) => {
    const t = team(id);
    return `<span class="pr-crest">${t.code != null ? `<img src="https://resources.premierleague.com/premierleague/badges/70/t${t.code}.png" alt="" loading="lazy" onerror="this.remove()">` : ""}</span>`;
  };
  const teamHtml = (id, side) => side === "home"
    ? `<span class="pr-pl-team"><span class="pr-pl-name">${escapeHtml(team(id).name)}</span>${crest(id)}</span>`
    : `<span class="pr-pl-team">${crest(id)}<span class="pr-pl-name">${escapeHtml(team(id).name)}</span></span>`;
  const dayOf = (iso) => (iso ? new Date(iso).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" }) : "Kick-off to be confirmed");
  const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "TBC");
  return {
    id: "pl",
    gw: pl.gw,
    deadline: pl.deadline,
    open: Boolean(pl.gw && pl.deadline && pl.fixtures?.length && !data.schedule.seasonComplete),
    preds: pl,
    storeKey: (person) => `pl:${pl.gw}:${person}`,
    subtitle: "Call every Premier League match of the gameweek - Home, Draw or Away. Picks lock at the FPL deadline. One point per correct call.",
    formNote: "",
    fixturesHtml: () => {
      let lastDay = null;
      return pl.fixtures.map((f) => {
        const day = dayOf(f.kickoff);
        const heading = day !== lastDay ? `<div class="pr-day">${escapeHtml(day)}</div>` : "";
        lastDay = day;
        return `${heading}
          <div class="pr-fixture pr-pl" data-key="${f.key}">
            <div class="pr-team home">${teamHtml(f.home, "home")}</div>
            <div class="pr-picks">${pickButton("H", team(f.home).short, "Home")}${pickButton("D", "Draw", timeOf(f.kickoff))}${pickButton("A", team(f.away).short, "Away")}</div>
            <div class="pr-team away">${teamHtml(f.away, "away")}</div>
          </div>`;
      }).join("");
    },
    gridFixtureHtml: (f) => `${escapeHtml(team(f.home).short)} <span class="pr-vs">v</span> ${escapeHtml(team(f.away).short)}`,
    resultText: (f) => (f.score ? `${f.score[0]}–${f.score[1]}` : f.result === "D" ? "Draw" : `${LABEL[f.result]} win`),
    pickTitle: (f, pick) => (pick === "D" ? "Draw" : team(pick === "H" ? f.home : f.away).name),
  };
}

// ---------------------------------------------------------------- page

const TABS = [
  { id: "league", label: "Head-to-heads" },
  { id: "pl", label: "Premier League" },
];

export function render(container, data, managers) {
  const store = readStore();
  let tab = TABS.some((t) => t.id === store.tab) ? store.tab : "league";

  container.innerHTML = `
    <div class="pr-page">
      <h2 class="section-title">Predictions</h2>
      <div class="pr-tabs" role="tablist">${TABS.map((t) => `<button type="button" role="tab" class="pr-tab" data-tab="${t.id}" aria-selected="${t.id === tab}">${t.label}</button>`).join("")}</div>
      <div id="pr-game"></div>
    </div>`;

  const body = container.querySelector("#pr-game");
  const show = () => {
    container.querySelectorAll(".pr-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    renderGame(body, tab === "pl" ? plGame(data) : leagueGame(data, managers), data, managers);
  };
  container.querySelector(".pr-tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".pr-tab");
    if (!b || b.dataset.tab === tab) return;
    tab = b.dataset.tab;
    const s = readStore(); s.tab = tab; writeStore(s);
    show();
  });
  show();
}

function renderGame(container, game, data, managers) {
  if (clockTimer) clearInterval(clockTimer);
  const endpoint = data.predictionsConfig?.endpoint ?? "";
  const { gw, deadline, preds } = game;
  const myId = managers.idForPersonKey(getIdentity());
  const people = [...managers.all].sort((a, b) => (a.playerName ?? "").localeCompare(b.playerName ?? ""));

  const openForPicks = Boolean(endpoint && game.open);
  const lockAt = deadline ? new Date(deadline).getTime() : 0;

  const pickCard = !endpoint
    ? `<div class="card pr-empty"><h3>Predictions aren't switched on yet</h3><p>One quick setup step is needed to store everyone's picks - see <code>scripts/predictions/SETUP.md</code> in the repo. The commissioner can do it in about five minutes.</p></div>`
    : !openForPicks
      ? `<div class="card pr-empty"><p>No gameweek is open for predictions right now. Check back when the next one is announced.</p></div>`
      : `
    <div class="card pr-form" id="pr-form">
      <div class="pr-form-top">
        <label class="pr-who">Who's predicting?
          <select id="pr-person"><option value="">Choose your name…</option>${people.map((m) => `<option value="${m.personKey}">${escapeHtml(m.playerName ?? m.name)}</option>`).join("")}</select>
        </label>
        <div class="pr-lock"><small>Gameweek ${gw} locks in</small><b id="pr-clock">…</b><span class="pr-dim">${escapeHtml(new Date(deadline).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }))}</span></div>
      </div>
      <p class="pr-status" id="pr-status"></p>
      <div class="pr-fixtures" id="pr-fixtures">${game.fixturesHtml()}</div>
      <div class="pr-actions"><button type="button" class="pr-submit" id="pr-submit" disabled>Lock in my picks</button><span class="pr-msg" id="pr-msg" role="status"></span></div>
      <p class="pr-note">You can change your picks as often as you like until the deadline. Everyone's picks are revealed once it passes. ${game.formNote}</p>
    </div>`;

  container.innerHTML = `
      <p class="section-subtitle">${game.subtitle}</p>
      ${pickCard}
      <h3 class="pr-h3">The table</h3>
      ${tableHtml(preds, managers, myId)}
      ${weeklyMatrixHtml(preds, managers, myId)}
      ${preds.weeks.length ? `
        <h3 class="pr-h3">Everyone's picks</h3>
        <div class="pr-weeks" id="pr-weeks">${[...preds.weeks].reverse().map((w, i) => `<button type="button" class="pr-wk${i === 0 ? " on" : ""}" data-gw="${w.gw}">GW${w.gw}</button>`).join("")}</div>
        <div id="pr-week-body"></div>` : ""}`;

  // ---- everyone's picks (revealed weeks) ----
  if (preds.weeks.length) {
    const body = container.querySelector("#pr-week-body");
    const show = (g) => { body.innerHTML = weekGridHtml(game, preds.weeks.find((w) => w.gw === g), preds.table, managers, myId); };
    show(preds.weeks.at(-1).gw);
    container.querySelector("#pr-weeks").addEventListener("click", (e) => {
      const b = e.target.closest(".pr-wk");
      if (!b) return;
      container.querySelectorAll(".pr-wk").forEach((x) => x.classList.toggle("on", x === b));
      show(Number(b.dataset.gw));
    });
  }

  if (!openForPicks) return;

  // ---- the pick form ----
  const personEl = container.querySelector("#pr-person");
  const statusEl = container.querySelector("#pr-status");
  const msgEl = container.querySelector("#pr-msg");
  const submitEl = container.querySelector("#pr-submit");
  const fixtureEls = [...container.querySelectorAll(".pr-fixture")];
  let submitted = new Set();
  let picks = {};

  const tick = () => {
    const left = lockAt - Date.now();
    container.querySelector("#pr-clock").textContent = countdownText(left);
    if (left <= 0) {
      clearInterval(clockTimer);
      submitEl.disabled = true;
      container.querySelector("#pr-form").classList.add("closed");
      msgEl.textContent = "Predictions are now locked. Everyone's picks appear below shortly.";
    }
  };
  tick();
  clockTimer = setInterval(tick, 1000);

  const paint = () => {
    fixtureEls.forEach((el) => el.querySelectorAll(".pr-pick").forEach((b) => b.setAttribute("aria-pressed", String(picks[el.dataset.key] === b.dataset.pick))));
    const done = fixtureEls.filter((el) => picks[el.dataset.key]).length;
    submitEl.disabled = !personEl.value || done === 0 || Date.now() >= lockAt;
    submitEl.textContent = done === fixtureEls.length ? (submitted.has(personEl.value) ? "Update my picks" : "Lock in my picks") : `Lock in ${done} of ${fixtureEls.length} picks`;
  };
  const paintStatus = () => {
    const names = [...submitted].map((k) => managers.all.find((m) => m.personKey === k)?.playerName?.split(" ")[0] ?? k);
    statusEl.innerHTML = names.length
      ? `<b>${names.length} of ${people.length}</b> locked in: ${escapeHtml(names.join(", "))}`
      : "Nobody has locked in yet - be the first.";
  };

  const loadMine = (keepPicks = false) => {
    const store = readStore();
    if (!keepPicks) picks = { ...(store[game.storeKey(personEl.value)] ?? {}) };
    msgEl.textContent = personEl.value && submitted.has(personEl.value) && !Object.keys(picks).length
      ? "You've already locked in on another device - picking again will replace those." : "";
    paint();
  };

  const start = (getIdentity() && people.some((m) => m.personKey === getIdentity()) ? getIdentity() : readStore().lastPerson) ?? "";
  if (people.some((m) => m.personKey === start)) personEl.value = start;
  loadMine();

  personEl.addEventListener("change", () => {
    const store = readStore(); store.lastPerson = personEl.value; writeStore(store);
    loadMine();
  });
  container.querySelector("#pr-fixtures").addEventListener("click", (e) => {
    const b = e.target.closest(".pr-pick");
    if (!b || Date.now() >= lockAt) return;
    const key = b.closest(".pr-fixture").dataset.key;
    picks[key] = picks[key] === b.dataset.pick ? undefined : b.dataset.pick;
    if (!picks[key]) delete picks[key];
    paint();
  });

  submitEl.addEventListener("click", async () => {
    const person = personEl.value;
    submitEl.disabled = true;
    msgEl.className = "pr-msg";
    msgEl.textContent = "Saving…";
    try {
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ gw, person, picks, kind: game.id }) });
      const body = await res.json();
      // an older copy of the Apps Script only knows head-to-head fixture keys
      if (!body.ok && game.id === "pl" && body.error === "Bad picks.") throw new Error("The league's Apps Script needs its Premier League update - see scripts/predictions/SETUP.md.");
      if (!body.ok) throw new Error(body.error || "Couldn't save.");
      const store = readStore(); store[game.storeKey(person)] = { ...picks }; store.lastPerson = person; writeStore(store);
      submitted.add(person);
      paintStatus();
      msgEl.className = "pr-msg ok";
      msgEl.textContent = `Locked in ${body.saved} pick${body.saved === 1 ? "" : "s"}. You can change them until the deadline.`;
    } catch (err) {
      msgEl.className = "pr-msg bad";
      msgEl.textContent = err.message === "Failed to fetch" ? "Couldn't reach the prediction box - check your connection and try again." : err.message;
    }
    paint();
  });

  // who's already locked in (names only -- the sheet never reveals picks early)
  fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}action=status&gw=${gw}&kind=${game.id}`, { cache: "no-store" })
    .then((r) => r.json())
    .then((body) => {
      if (!body.ok) return;
      // an older Apps Script doesn't split the two games; don't show league names on the Premier League tab
      if (game.id === "pl" && body.kind !== "pl") { statusEl.textContent = ""; return; }
      submitted = new Set(body.submitted); paintStatus(); loadMine(true);
    })
    .catch(() => { statusEl.textContent = ""; });
}
