export function render(container, data, managers) {
  const names = (ids) => ids.map((id) => managers.nameHtml(id)).join(", ");

  function hallOfFameTable(title, rows) {
    if (rows.length === 0) return `<div class="card"><h3>${title}</h3><p class="empty-state">No data yet.</p></div>`;
    const rowsHtml = rows
      .map((r) => `<tr><td class="text-left">${managers.nameHtml(r.managerId)}</td><td>${r.count}</td></tr>`)
      .join("");
    return `
      <div class="card">
        <h3>${title}</h3>
        <table>
          <thead><tr><th class="text-left">Manager</th><th>Wins</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  const hof = data.awards.hallOfFame;
  const hallOfFameHtml = `
    <div class="grid-cols two">
      ${hallOfFameTable("Top Score", hof.topScore)}
      ${hallOfFameTable("Mark of the Week", hof.markOfTheWeek)}
      ${hallOfFameTable("Biggest Blowout", hof.blowout)}
      ${hallOfFameTable("Worst Lineup of the Week", hof.worstLineup)}
    </div>`;

  const recapsHtml = [...data.awards.recaps]
    .reverse()
    .map((r) => {
      const fiftyNine = r.fiftyNineClubInstances.length
        ? `<p class="award-line">🎯 59 Club: ${r.fiftyNineClubInstances
            .map((i) => `${i.playerName} (${managers.nameHtml(i.managerId)})`)
            .join(", ")}</p>`
        : "";
      return `
        <div class="recap">
          <div class="gw-label">Gameweek ${r.gw}</div>
          <p class="award-line"><strong>Top Score:</strong> ${names(r.topScore.managerIds)} — ${r.topScore.score} pts</p>
          <p class="award-line"><strong>Mark of the Week:</strong> ${names(r.markOfTheWeek.managerIds)} — ${r.markOfTheWeek.score} pts</p>
          ${r.blowout ? `<p class="award-line"><strong>${r.blowout.title}</strong> (margin: ${r.blowout.margin})</p>` : ""}
          <p class="award-line"><strong>Worst Lineup of the Week:</strong> ${names(r.worstLineup.managerIds)} — ${r.worstLineup.benchPoints} bench pts</p>
          ${fiftyNine}
        </div>`;
    })
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Weekly Awards</h2>
    <p class="section-subtitle">Season Hall of Fame tallies, plus a recap of every completed gameweek (most recent first).</p>
    ${hallOfFameHtml}
    <div class="card">
      <h3>Gameweek Recaps</h3>
      ${recapsHtml || '<p class="empty-state">No completed gameweeks yet.</p>'}
    </div>
  `;
}
