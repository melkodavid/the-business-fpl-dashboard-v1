// Resolves a personKey (historical honors/tables are keyed by first name,
// not managerId, since those don't survive team-name changes or players who
// have since left the league) to a display name + star badges, falling back
// to whatever name text was recorded for that key when the person isn't one
// of this season's current managers.
function personDisplay(key, fallbackName, managers, titleCounts) {
  const current = managers.all.find((m) => m.personKey === key);
  const titles = titleCounts[key] ?? 0;
  const stars = titles ? ` <span class="title-stars" title="${titles} title${titles === 1 ? "" : "s"}">${"★".repeat(titles)}</span>` : "";
  const name = current?.playerName || fallbackName || key;
  return `${name}${stars}`;
}

export function render(container, data, managers) {
  const history = data.history;
  const seasons = history.seasons;
  const titleCounts = history.titleCounts;

  const honorsHtml = [...seasons]
    .reverse()
    .map((s) => {
      const champDisplay = s.championKey
        ? personDisplay(s.championKey, s.championDisplay ?? s.table?.find((r) => r.rank === 1)?.manager, managers, titleCounts)
        : '<span class="empty-state">Unknown</span>';
      return `<tr><td>${s.year}${s.isCurrent ? ' <span class="badge badge-w">Current</span>' : ""}</td><td class="text-left">${champDisplay}</td></tr>`;
    })
    .join("");

  const leaderboardHtml = history.leaderboard
    .map(
      (row, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="text-left">${personDisplay(row.managerKey, null, managers, titleCounts)}</td>
          <td>${row.top3}</td>
          <td>${row.seasons}</td>
          <td>${row.bestRank}</td>
          <td>${row.avgRank}</td>
        </tr>`
    )
    .join("");

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
          <thead><tr><th>#</th><th class="text-left">Manager</th><th title="Top-3 finishes">Top 3</th><th>Seasons</th><th>Best</th><th>Avg Rank</th></tr></thead>
          <tbody>${leaderboardHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; margin-bottom:0.75rem;">
        <h3 style="margin:0;">Season Standings</h3>
        <select id="history-year-select">${yearOptions}</select>
      </div>
      <div id="history-year-table"></div>
    </div>
  `;

  const select = container.querySelector("#history-year-select");
  const tableHost = container.querySelector("#history-year-table");

  function renderYear(year) {
    const season = seasons.find((s) => s.year === year);
    if (!season?.table) {
      tableHost.innerHTML = `<p class="empty-state">No full table on record for ${year} — champion was ${personDisplay(season?.championKey, season?.championDisplay, managers, titleCounts)}.</p>`;
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
}
