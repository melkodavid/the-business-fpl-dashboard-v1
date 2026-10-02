import { escapeHtml, signed, signedClass, round1 } from "../format.js";
import { getIdentity } from "../identity.js";

const PALETTE = [
  "#3b6fd6", "#e0653a", "#2fa86a", "#c94f9e", "#d6a13b", "#6f4fd6",
  "#3ba9c9", "#c94f4f", "#7ab53b", "#a34fc9", "#4f8ec9", "#c98f3b",
];

function colorMap(managers) {
  return new Map(managers.all.map((m, i) => [m.id, PALETTE[i % PALETTE.length]]));
}

// ---------------------------------------------------------------------------
// Pick Number vs. Season Points scatter, with team filter chips
// ---------------------------------------------------------------------------
function buildScatter(scatter, managers) {
  const width = 720, height = 420;
  const margin = { top: 20, right: 20, bottom: 45, left: 55 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xMax = Math.max(...scatter.map((d) => d.pickNumber), 1);
  const yMin = Math.min(0, ...scatter.map((d) => d.seasonPoints));
  const yMax = Math.max(...scatter.map((d) => d.seasonPoints), 1);

  const x = (v) => margin.left + (v / xMax) * innerW;
  const y = (v) => margin.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const colors = colorMap(managers);

  const points = scatter
    .map((d) => {
      const color = colors.get(d.managerId) ?? "#888";
      const stars = "★".repeat(managers.titles(d.managerId));
      return `<circle class="scatter-dot" data-mgr="${d.managerId}" cx="${x(d.pickNumber).toFixed(1)}" cy="${y(d.seasonPoints).toFixed(1)}" r="4.5" fill="${color}" fill-opacity="0.85">
        <title>${escapeHtml(d.playerName)} — Pick #${d.pickNumber}, ${d.seasonPoints} pts (${escapeHtml(managers.name(d.managerId))}${stars ? " " + stars : ""})</title>
      </circle>`;
    })
    .join("");

  const yAxisTicks = 5;
  const ticksHtml = Array.from({ length: yAxisTicks + 1 }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / yAxisTicks;
    const yy = y(val);
    return `<line x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}" stroke="currentColor" stroke-opacity="0.08" />
            <text x="${margin.left - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">${Math.round(val)}</text>`;
  }).join("");

  const chips = managers.all
    .map(
      (m) => `
        <button type="button" class="team-chip is-on" data-mgr="${m.id}" aria-pressed="true">
          <span class="team-chip-dot" style="background:${colors.get(m.id)}"></span>${managers.clubHtml(m.id)}
        </button>`
    )
    .join("");

  return `
    <div class="scatter-wrap">
      <div class="scatter-filters" role="group" aria-label="Show or hide teams">
        <button type="button" class="chip-action" data-action="all">All</button>
        <button type="button" class="chip-action" data-action="none">None</button>
        ${chips}
      </div>
      <p class="scatter-hint" id="scatter-hint">Tip: click a team to show only their picks, then click more teams to add them.</p>
      <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px; color:inherit;">
        ${ticksHtml}
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="currentColor" stroke-opacity="0.4" />
        <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="currentColor" stroke-opacity="0.4" />
        <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.7">Overall pick number</text>
        <text x="14" y="${height / 2}" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.7" transform="rotate(-90 14 ${height / 2})">Season points</text>
        ${points}
      </svg>
    </div>`;
}

function wireScatter(container, managers) {
  const allIds = managers.all.map((m) => m.id);
  let visible = new Set(allIds);
  const hint = container.querySelector("#scatter-hint");

  const apply = () => {
    container.querySelectorAll(".scatter-dot").forEach((c) => {
      c.classList.toggle("is-hidden", !visible.has(Number(c.dataset.mgr)));
    });
    container.querySelectorAll(".team-chip").forEach((b) => {
      const on = visible.has(Number(b.dataset.mgr));
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (hint) {
      hint.textContent =
        visible.size === allIds.length
          ? "Tip: click a team to show only their picks, then click more teams to add them."
          : `Showing ${visible.size} of ${allIds.length} teams.`;
    }
  };

  container.querySelectorAll(".team-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.mgr);
      if (visible.size === allIds.length) visible = new Set([id]);
      else if (visible.has(id)) visible.delete(id);
      else visible.add(id);
      apply();
    });
  });
  container.querySelectorAll(".chip-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      visible = btn.dataset.action === "all" ? new Set(allIds) : new Set();
      apply();
    });
  });
}

// ---------------------------------------------------------------------------
// Preseason projection leaderboard (unchanged)
// ---------------------------------------------------------------------------
function projectedPointsCardHtml(projected, managers) {
  if (!projected?.leaderboard?.length) return "";
  const rows = projected.leaderboard
    .map(
      (m, i) => `<tr><td>${i + 1}</td><td class="text-left">${managers.clubHtml(m.managerId)}</td><td>${m.projectedPoints}</td></tr>`
    )
    .join("");
  const sourceLine = projected.source
    ? `<p class="section-subtitle">Source: ${escapeHtml(projected.source)}${projected.pulledAt ? ` (pulled ${escapeHtml(projected.pulledAt)})` : ""}. A third-party preseason estimate, not official FPL data — just something to argue about in the group chat until real points start coming in.</p>`
    : "";
  return `
    <div class="card">
      <h3>Projected Points (Preseason)</h3>
      ${sourceLine}
      <table>
        <thead><tr><th>#</th><th class="text-left">Manager</th><th>Projected Pts</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------------------------------------------------------------------------
// Projected vs Actual (whole league) + each team's individual draft
// ---------------------------------------------------------------------------
function paceFactor(projected) {
  const played = projected?.gwsPlayed ?? 0;
  const length = projected?.seasonLengthGws || 38;
  return played / length;
}

function posTagHtml(position) {
  return `<span class="pos-tag pos-${escapeHtml((position ?? "").toLowerCase())}">${escapeHtml(position ?? "")}</span>`;
}

function diffCell(n) {
  return `<td class="${signedClass(n)}">${signed(n)}</td>`;
}

function leagueTableHtml(data, managers, selectedId) {
  const factor = paceFactor(data.projectedPoints);
  const projectedById = new Map((data.projectedPoints?.leaderboard ?? []).map((m) => [m.managerId, m.projectedPoints]));

  const rows = data.draftGrades.leaderboard
    .map((m) => {
      const season = projectedById.get(m.managerId) ?? 0;
      const pace = round1(season * factor);
      const actual = m.draftTeamPoints;
      return `
        <tr class="draft-team-row ${m.managerId === selectedId ? "is-selected" : ""}" data-mgr="${m.managerId}" tabindex="0">
          <td class="text-left">${managers.clubHtml(m.managerId)}</td>
          <td>${season}</td>
          <td>${pace}</td>
          <td><strong>${actual}</strong></td>
          ${diffCell(round1(actual - pace))}
        </tr>`;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>
          <th class="text-left">Team</th>
          <th title="Full-season preseason projection for the drafted squad">Season projection</th>
          <th title="Season projection scaled to the gameweeks played so far">Pace so far</th>
          <th title="Points the drafted squad has actually scored this season">Actual</th>
          <th title="Actual minus pace">vs pace</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function teamDraftHtml(data, managers, managerId) {
  if (managerId == null) return "";
  const factor = paceFactor(data.projectedPoints);
  const projectedByPick = new Map((data.projectedPoints?.perPick ?? []).map((p) => [p.pickNumber, p.projectedPoints]));
  const picks = data.draftGrades.scatter.filter((p) => p.managerId === managerId).sort((a, b) => a.pickNumber - b.pickNumber);

  let totalSeason = 0, totalPace = 0, totalActual = 0;
  const rows = picks
    .map((p) => {
      const season = projectedByPick.get(p.pickNumber) ?? 0;
      const pace = round1(season * factor);
      totalSeason += season;
      totalPace += pace;
      totalActual += p.seasonPoints;
      return `
        <tr>
          <td class="text-left"><span class="pick-no">#${p.pickNumber}</span> <span class="pick-round">R${p.round}</span></td>
          <td class="text-left"><strong>${escapeHtml(p.playerName ?? "")}</strong></td>
          <td>${posTagHtml(p.position)}</td>
          <td class="text-left">${escapeHtml(p.clubName ?? "")}</td>
          <td>${round1(season)}</td>
          <td>${pace}</td>
          <td><strong>${p.seasonPoints}</strong></td>
          ${diffCell(round1(p.seasonPoints - pace))}
        </tr>`;
    })
    .join("");

  const diff = round1(totalActual - totalPace);
  return `
    <div class="draft-team-head">
      <div class="draft-team-title">${managers.avatarHtml(managerId)}<strong>${managers.clubHtml(managerId)}</strong></div>
      <div class="draft-team-stats">
        <span><b>${totalActual}</b> actual pts</span>
        <span><b>${round1(totalPace)}</b> pace</span>
        <span class="${signedClass(diff)}"><b>${signed(diff)}</b> vs pace</span>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="text-left">Pick</th><th class="text-left">Player</th><th>Pos</th><th class="text-left">Club</th>
          <th title="Full-season preseason projection">Projected</th><th title="Projection scaled to gameweeks played">Pace</th>
          <th>Actual</th><th title="Actual minus pace">vs pace</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td class="text-left" colspan="4"><strong>Total</strong></td>
          <td><strong>${round1(totalSeason)}</strong></td><td><strong>${round1(totalPace)}</strong></td>
          <td><strong>${totalActual}</strong></td>${diffCell(diff)}
        </tr>
      </tfoot>
    </table>`;
}

function projectedVsActualSection(data, managers, selectedId) {
  const options = [...managers.all]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => `<option value="${m.id}" ${m.id === selectedId ? "selected" : ""}>${escapeHtml(m.name)}</option>`)
    .join("");
  const played = data.projectedPoints?.gwsPlayed ?? 0;

  return `
    <div class="card">
      <h3>Projected vs. Actual — Whole League</h3>
      <p class="section-subtitle">Projections are full-season totals, so "pace" scales them to the ${played} gameweek${played === 1 ? "" : "s"} played so far for a fair comparison. Pick a team below (or click a row) to see its draft.</p>
      <div id="draft-league-table">${leagueTableHtml(data, managers, selectedId)}</div>
    </div>
    <div class="card">
      <h3>Team Draft Explorer</h3>
      <label class="draft-team-picker">Team
        <select id="draft-team-select">${options}</select>
      </label>
      <div id="draft-team-panel">${teamDraftHtml(data, managers, selectedId)}</div>
    </div>`;
}

function wireExplorer(container, data, managers, initialId) {
  let selectedId = initialId;
  const select = container.querySelector("#draft-team-select");
  const panel = container.querySelector("#draft-team-panel");
  const leagueWrap = container.querySelector("#draft-league-table");

  const choose = (id) => {
    selectedId = id;
    if (select) select.value = String(id);
    panel.innerHTML = teamDraftHtml(data, managers, id);
    leagueWrap.querySelectorAll(".draft-team-row").forEach((r) => r.classList.toggle("is-selected", Number(r.dataset.mgr) === id));
  };

  select?.addEventListener("change", () => choose(Number(select.value)));
  leagueWrap.addEventListener("click", (e) => {
    const row = e.target.closest(".draft-team-row");
    if (row) choose(Number(row.dataset.mgr));
  });
  leagueWrap.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const row = e.target.closest(".draft-team-row");
    if (row) {
      e.preventDefault();
      choose(Number(row.dataset.mgr));
    }
  });
  return () => selectedId;
}

export function render(container, data, managers) {
  const leaderboardHtml = data.draftGrades.leaderboard
    .map(
      (m, i) => `<tr><td>${i + 1}</td><td class="text-left">${managers.clubHtml(m.managerId)}</td><td>${m.draftTeamPoints}</td></tr>`
    )
    .join("");

  // Default the explorer to the viewer's own team, else the current draft-points leader.
  const myId = managers.idForPersonKey(getIdentity());
  const selectedId = myId ?? data.draftGrades.leaderboard[0]?.managerId ?? managers.all[0]?.id ?? null;

  container.innerHTML = `
    <h2 class="section-title">Draft Grades — Pure Draft Team Tracker</h2>
    <p class="section-subtitle">Each manager's originally drafted squad, locked at draft completion and tracked independently of trades or waivers.</p>
    ${projectedPointsCardHtml(data.projectedPoints, managers)}
    <div class="card">
      <h3>Draft Team Points</h3>
      <table>
        <thead><tr><th>#</th><th class="text-left">Manager</th><th>Points</th></tr></thead>
        <tbody>${leaderboardHtml}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Pick Number vs. Season Points</h3>
      ${buildScatter(data.draftGrades.scatter, managers)}
    </div>
    ${projectedVsActualSection(data, managers, selectedId)}
  `;

  wireScatter(container, managers);
  wireExplorer(container, data, managers, selectedId);
}
