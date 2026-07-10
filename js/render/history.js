import { makeSortable } from "../format.js";

function starsHtml(count) {
  if (!count) return "";
  return ` <span class="title-stars" title="${count} title${count === 1 ? "" : "s"}">${"★".repeat(count)}</span>`;
}

// Resolves a personKey (historical honors/tables are keyed by first name,
// not managerId, since those don't survive team-name changes or players who
// have since left the league) to a display name + star badges, falling back
// to whatever name text was recorded for that key when the person isn't one
// of this season's current managers. Pass an explicit `starsOverride` to show
// the star count as it stood at a specific point in history (e.g. the
// champions list shows 1 star for a first title, 2 for a second) rather than
// the person's current all-time total.
function personDisplay(key, fallbackName, managers, titleCounts, starsOverride) {
  const current = managers.all.find((m) => m.personKey === key);
  const titles = starsOverride ?? titleCounts[key] ?? 0;
  const name = current?.playerName || fallbackName || key;
  return `${name}${starsHtml(titles)}`;
}

export function render(container, data, managers) {
  const history = data.history;
  const seasons = history.seasons;
  const titleCounts = history.titleCounts;

  const honorsHtml = [...seasons]
    .reverse()
    .map((s) => {
      const champDisplay = s.championKey
        ? personDisplay(
            s.championKey,
            s.championDisplay ?? s.table?.find((r) => r.rank === 1)?.manager,
            managers,
            titleCounts,
            s.championTitleNumber
          )
        : '<span class="empty-state">Unknown</span>';
      return `<tr><td>${s.year}${s.isCurrent ? ' <span class="badge badge-w">Current</span>' : ""}</td><td class="text-left">${champDisplay}</td></tr>`;
    })
    .join("");

  const leaderboardHtml = history.leaderboard
    .map(
      (row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="text-left">${personDisplay(row.managerKey, row.displayName, managers, titleCounts)}</td>
          <td title="Top-4 finishes">${row.top4}</td>
          <td title="Bottom-3 finishes">${row.bottom3}</td>
          <td>${row.seasons}</td>
          <td>${row.bestRank}</td>
          <td>${row.avgRank}</td>
        </tr>`
    )
    .join("");

  const lastPlaceHtml = history.mostLastPlace.length
    ? history.mostLastPlace
        .map(
          (row) => `
          <tr>
            <td class="text-left">${personDisplay(row.managerKey, row.displayName, managers, titleCounts)}</td>
            <td>${row.lastPlace}</td>
          </tr>`
        )
        .join("")
    : '<tr><td colspan="2" class="empty-state">No last-place finishes on record.</td></tr>';

  const yearOptions = [...seasons]
    .reverse()
    .map((s) => `<option value="${s.year}">${s.year}${s.isCurrent ? " (current)" : ""}</option>`)
    .join("");

  container.innerHTML = `
    <h2 class="section-title">League History</h2>
    <p class="section-subtitle">Every season on record, tracked by the real people behind the teams — team names change every year, championships don't.</p>

    <div class="grid-cols two">
      <div class="card">
        <h3>Champions</h3>
        <table>
          <thead><tr><th>Season</th><th class="text-left">Champion</th></tr></thead>
          <tbody>${honorsHtml}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>All-Time Leaderboard</h3>
        <table>
          <thead><tr><th>#</th><th class="text-left">Manager</th><th>Top 4</th><th>Bot 3</th><th>Seasons</th><th>Best</th><th>Avg Rank</th></tr></thead>
          <tbody>${leaderboardHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h3>Most Last-Place Finishes</h3>
      <table>
        <thead><tr><th class="text-left">Manager</th><th>Last-Place Finishes</th></tr></thead>
        <tbody>${lastPlaceHtml}</tbody>
      </table>
    </div>

    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:0.75rem;">
        <h3 style="margin:0;">Season Standings</h3>
        <select id="history-year-select">${yearOptions}</select>
      </div>
      <div id="history-year-table"></div>
    </div>

    <div class="card">
      <h3>All-Time Table</h3>
      <p class="section-subtitle">Every person's combined record, added up across every season they've played — click a column to sort.</p>
      <table id="history-all-time-table">
        <thead>
          <tr>
            <th class="text-left" data-sort-key="managerDisplay">Manager</th>
            <th data-sort-key="seasons">Seasons</th>
            <th data-sort-key="w">W</th>
            <th data-sort-key="d">D</th>
            <th data-sort-key="l">L</th>
            <th data-sort-key="pointsFor">+</th>
            <th data-sort-key="points">Pts</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const select = container.querySelector("#history-year-select");
  const tableHost = container.querySelector("#history-year-table");

  function renderYear(year) {
    const season = seasons.find((s) => s.year === year);
    if (!season?.table) {
      tableHost.innerHTML = `<p class="empty-state">No full table on record for ${year} — champion was ${personDisplay(season?.championKey, season?.championDisplay, managers, titleCounts, season?.championTitleNumber)}.</p>`;
      return;
    }
    const rowsHtml = season.table
      .map(
        (r) => `
          <tr>
            <td>${r.rank}</td>
            <td class="text-left">${r.team ?? ""}</td>
            <td class="text-left">${personDisplay(r.managerKey, r.manager, managers, titleCounts)}</td>
            <td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.plus}</td><td><strong>${r.pts}</strong></td>
          </tr>`
      )
      .join("");
    tableHost.innerHTML = `
      <table>
        <thead><tr><th>#</th><th class="text-left">Team</th><th class="text-left">Manager</th><th>W</th><th>D</th><th>L</th><th>+</th><th>Pts</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }

  select.addEventListener("change", () => renderYear(select.value));
  renderYear(seasons[seasons.length - 1].year);

  // Combined career table, one row per person, sortable.
  const allTimeRows = history.allTimeTable.map((r) => ({
    ...r,
    managerDisplay: (managers.all.find((m) => m.personKey === r.managerKey)?.playerName || r.displayName || r.managerKey || ""),
  }));
  const allTimeTable = container.querySelector("#history-all-time-table");
  const allTimeBody = allTimeTable.querySelector("tbody");
  makeSortable(
    allTimeTable,
    allTimeRows,
    (rows) => {
      allTimeBody.innerHTML = rows
        .map(
          (r) => `
          <tr>
            <td class="text-left">${personDisplay(r.managerKey, r.displayName, managers, titleCounts)}</td>
            <td>${r.seasons}</td>
            <td>${r.w}</td><td>${r.d}</td><td>${r.l}</td><td>${r.pointsFor}</td><td><strong>${r.points}</strong></td>
          </tr>`
        )
        .join("");
    },
    "points",
    true
  );
}
