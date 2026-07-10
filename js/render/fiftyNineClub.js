export function render(container, data, managers) {
  const totalsHtml = data.fiftyNineClub.seasonTotals
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((s) => `<tr><td class="text-left">${managers.nameHtml(s.managerId)}</td><td>${s.count}</td></tr>`)
    .join("");

  const instancesHtml = [...data.fiftyNineClub.instances]
    .reverse()
    .map(
      (i) => `<tr><td>${i.gw}</td><td class="text-left">${managers.nameHtml(i.managerId)}</td><td class="text-left">${i.playerName}</td></tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">The 59 Club</h2>
    <p class="section-subtitle">A starter subbed off at exactly 59 minutes — one short of the second appearance point. Checked per fixture, so double-gameweek players can trigger it twice.</p>
    <div class="grid-cols two">
      <div class="card">
        <h3>Season Totals</h3>
        <table>
          <thead><tr><th class="text-left">Manager</th><th>Count</th></tr></thead>
          <tbody>${totalsHtml || '<tr><td colspan="2" class="empty-state">None yet.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="card">
        <h3>Every Instance</h3>
        <table>
          <thead><tr><th>GW</th><th class="text-left">Manager</th><th class="text-left">Player</th></tr></thead>
          <tbody>${instancesHtml || '<tr><td colspan="3" class="empty-state">None yet.</td></tr>'}</tbody>
        </table>
      </div>
    </div>
  `;
}
