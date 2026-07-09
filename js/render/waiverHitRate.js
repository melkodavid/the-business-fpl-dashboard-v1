function pickupTable(rows, extraCol) {
  if (rows.length === 0) return '<p class="empty-state">None yet.</p>';
  const rowsHtml = rows
    .map(
      (p) => `
        <tr>
          <td class="text-left">${p.playerName}</td>
          <td class="text-left">${p.managerName}</td>
          <td>GW${p.acquiredGw}</td>
          <td>${p.gwsRostered}</td>
          <td>${p.pointsWhileRostered}</td>
          <td>${p.pointsPerGw.toFixed(2)}</td>
          ${extraCol ? `<td>${p.isHit ? "✅" : ""}</td>` : ""}
        </tr>`
    )
    .join("");
  return `
    <table>
      <thead>
        <tr>
          <th class="text-left">Player</th><th class="text-left">Manager</th><th>Acquired</th>
          <th>GWs Held</th><th>Total Pts</th><th>Pts/GW</th>${extraCol ? "<th>Hit</th>" : ""}
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

export function render(container, data) {
  const hitRateHtml = data.waiverHitRate.hitRateLeaderboard
    .map(
      (m) => `
        <tr>
          <td class="text-left">${m.managerName}</td>
          <td>${m.hits}/${m.totalPickups}</td>
          <td>${(m.hitRate * 100).toFixed(0)}%</td>
        </tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Waiver Wire Hit Rate</h2>
    <p class="section-subtitle">A pickup is a "hit" if it averaged 5+ points per gameweek while rostered.</p>
    <div class="card">
      <h3>Hit Rate by Manager</h3>
      <table>
        <thead><tr><th class="text-left">Manager</th><th>Hits</th><th>Rate</th></tr></thead>
        <tbody>${hitRateHtml}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Best Pickups</h3>
      ${pickupTable(data.waiverHitRate.bestPickups.slice(0, 10), true)}
    </div>
    <div class="card">
      <h3>Most Efficient Waivers <span style="font-weight:400;font-size:0.8rem;color:var(--text-muted);">(3+ GWs rostered)</span></h3>
      ${pickupTable(data.waiverHitRate.mostEfficient.slice(0, 10), true)}
    </div>
    <div class="card">
      <h3>Best One-Week Punts <span style="font-weight:400;font-size:0.8rem;color:var(--text-muted);">(&lt;3 GWs rostered)</span></h3>
      ${pickupTable(data.waiverHitRate.bestOneWeekPunts.slice(0, 10), true)}
    </div>
  `;
}
