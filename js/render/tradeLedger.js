import { signed, signedClass } from "../format.js";

function playerList(players) {
  return players.map((p) => `${p.playerName} (${signed(p.points)})`).join(", ") || "—";
}

export function render(container, data, managers) {
  const logHtml = [...data.tradeLedger.log]
    .reverse()
    .map((trade) => {
      const sidesHtml = trade.sides
        .map(
          (s) => `
          <div style="margin-bottom:0.4rem;">
            <strong>${managers.name(s.managerId)}</strong> receives [${playerList(s.received)}]
            for [${playerList(s.given)}] — Net: <span class="${signedClass(s.netValue)}">${signed(s.netValue)}</span>
          </div>`
        )
        .join("");
      return `<div class="recap"><div class="gw-label">Trade #${trade.tradeId} — GW${trade.gw}</div>${sidesHtml}</div>`;
    })
    .join("");

  const leaderboardHtml = data.tradeLedger.leaderboard
    .map(
      (m) => `
        <tr>
          <td class="text-left">${m.managerName}</td>
          <td class="${signedClass(m.netTradeValue)}">${signed(m.netTradeValue)}</td>
        </tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Trade Ledger</h2>
    <p class="section-subtitle">Every trade's per-player point contributions, and each manager's season-long net trade value.</p>
    <div class="card">
      <h3>Net Trade Value</h3>
      <table>
        <thead><tr><th class="text-left">Manager</th><th>Net Value</th></tr></thead>
        <tbody>${leaderboardHtml}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Trade History</h3>
      ${logHtml || '<p class="empty-state">No trades yet.</p>'}
    </div>
  `;
}
