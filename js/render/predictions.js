import { escapeHtml } from "../format.js";
import { getIdentity } from "../identity.js";

// Weekly predictions page. Everyone calls Home / Draw / Away for each fixture of
// the coming gameweek before its deadline; a free Google Sheet (see
// scripts/predictions/) is the shared ballot box, and the hourly data job turns
// the revealed picks into the running table in data/predictions.json.

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

function weekGridHtml(week, tableRows, managers, myId) {
  const people = tableRows.filter((r) => week.picks[r.personKey]);
  const head = people.map((r) => `<th class="${r.managerId === myId ? "is-me" : ""}" title="${escapeHtml(managers.name(r.managerId))}">${escapeHtml(managers.abbreviation(r.managerId))}</th>`).join("");
  const body = week.fixtures.map((f) => {
    const cells = people.map((r) => {
      const pick = week.picks[r.personKey][f.key];
      if (!pick) return `<td><span class="pr-chip none">–</span></td>`;
      const state = !f.result ? "pend" : pick === f.result ? "hit" : "miss";
      return `<td><span class="pr-chip ${state}" title="${LABEL[pick]}">${pick}</span></td>`;
    }).join("");
    const res = f.result ? `<span class="pr-res">${f.result === "D" ? "Draw" : `${LABEL[f.result]} win`}</span>` : `<span class="pr-res pend">TBC</span>`;
    return `<tr><td class="text-left pr-fx">${managers.clubHtml(f.home)} <span class="pr-vs">v</span> ${managers.clubHtml(f.away)} ${res}</td>${cells}</tr>`;
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

export function render(container, data, managers) {
  if (clockTimer) clearInterval(clockTimer);
  const endpoint = data.predictionsConfig?.endpoint ?? "";
  const preds = data.predictions ?? { enabled: false, weeks: [], table: [] };
  const { gw, deadline, fixtures, seasonComplete } = data.schedule;
  const myId = managers.idForPersonKey(getIdentity());
  const people = [...managers.all].sort((a, b) => (a.playerName ?? "").localeCompare(b.playerName ?? ""));

  const openForPicks = Boolean(endpoint && gw && !seasonComplete && deadline && fixtures?.length);
  const lockAt = deadline ? new Date(deadline).getTime() : 0;

  const pickCard = !endpoint
    ? `<div class="card pr-empty"><h3>Predictions aren't switched on yet</h3><p>One quick setup step is needed to store everyone's picks — see <code>scripts/predictions/SETUP.md</code> in the repo. The commissioner can do it in about five minutes.</p></div>`
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
      <div class="pr-fixtures" id="pr-fixtures">
        ${fixtures.map((f) => {
          const key = `${f.homeManagerId}-${f.awayManagerId}`;
          const o = f.odds;
          const btn = (val, pct) => `<button type="button" class="pr-pick" data-pick="${val}" aria-pressed="false">${LABEL[val]}${pct != null ? `<small>${pct}%</small>` : ""}</button>`;
          return `
          <div class="pr-fixture" data-key="${key}">
            <div class="pr-team home">${managers.clubHtml(f.homeManagerId)}</div>
            <div class="pr-picks">${btn("H", o?.homeWinPct)}${btn("D", o?.drawPct)}${btn("A", o?.awayWinPct)}</div>
            <div class="pr-team away">${managers.clubHtml(f.awayManagerId)}</div>
          </div>`;
        }).join("")}
      </div>
      <div class="pr-actions"><button type="button" class="pr-submit" id="pr-submit" disabled>Lock in my picks</button><span class="pr-msg" id="pr-msg" role="status"></span></div>
      <p class="pr-note">You can change your picks as often as you like until the deadline. Everyone's picks are revealed once it passes. Small figures are the model's win odds — just a guide.</p>
    </div>`;

  container.innerHTML = `
    <div class="pr-page">
      <h2 class="section-title">Predictions</h2>
      <p class="section-subtitle">Call every result before the deadline — Home, Draw or Away — and climb the running table. One point per correct call.</p>
      ${pickCard}
      <h3 class="pr-h3">The table</h3>
      ${tableHtml(preds, managers, myId)}
      ${weeklyMatrixHtml(preds, managers, myId)}
      ${preds.weeks.length ? `
        <h3 class="pr-h3">Everyone's picks</h3>
        <div class="pr-weeks" id="pr-weeks">${[...preds.weeks].reverse().map((w, i) => `<button type="button" class="pr-wk${i === 0 ? " on" : ""}" data-gw="${w.gw}">GW${w.gw}</button>`).join("")}</div>
        <div id="pr-week-body"></div>` : ""}
    </div>`;

  // ---- everyone's picks (revealed weeks) ----
  if (preds.weeks.length) {
    const body = container.querySelector("#pr-week-body");
    const show = (g) => { body.innerHTML = weekGridHtml(preds.weeks.find((w) => w.gw === g), preds.table, managers, myId); };
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
      : "Nobody has locked in yet — be the first.";
  };

  const loadMine = (keepPicks = false) => {
    const store = readStore();
    if (!keepPicks) picks = { ...(store[`${gw}:${personEl.value}`] ?? {}) };
    msgEl.textContent = personEl.value && submitted.has(personEl.value) && !Object.keys(picks).length
      ? "You've already locked in on another device — picking again will replace those." : "";
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
      const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ gw, person, picks }) });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error || "Couldn't save.");
      const store = readStore(); store[`${gw}:${person}`] = { ...picks }; store.lastPerson = person; writeStore(store);
      submitted.add(person);
      paintStatus();
      msgEl.className = "pr-msg ok";
      msgEl.textContent = `Locked in ${body.saved} pick${body.saved === 1 ? "" : "s"}. You can change them until the deadline.`;
    } catch (err) {
      msgEl.className = "pr-msg bad";
      msgEl.textContent = err.message === "Failed to fetch" ? "Couldn't reach the prediction box — check your connection and try again." : err.message;
    }
    paint();
  });

  // who's already locked in (names only -- the sheet never reveals picks early)
  fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}action=status&gw=${gw}`, { cache: "no-store" })
    .then((r) => r.json())
    .then((body) => { if (body.ok) { submitted = new Set(body.submitted); paintStatus(); loadMine(true); } })
    .catch(() => { statusEl.textContent = ""; });
}
