import { signed, signedClass, escapeHtml } from "../format.js";

function playerList(players) {
  return players.map((p) => `${escapeHtml(p.playerName)} (${signed(p.points)})`).join(", ") || "—";
}

// Loose "here's what followed" context, not a claim the trade caused it --
// see nextSamePositionPickup() in scripts/stats/tradeLedger.js.
function positionRippleHtml(given) {
  const withRipple = given.filter((p) => p.positionRipple);
  if (!withRipple.length) return "";
  const items = withRipple
    .map((p) => {
      const r = p.positionRipple;
      return `${escapeHtml(p.playerName)} out &rarr; next ${escapeHtml(r.position)} pickup was ${escapeHtml(r.playerName)} (GW${r.acquiredGw}, ${r.points} pts in ${r.gwsStarted} started GW${r.gwsStarted === 1 ? "" : "s"})`;
    })
    .join("; ");
  return `<div class="trade-ripple">${items}</div>`;
}

// Rough counterfactual, not a precise account of what really would have
// happened -- see resultImpactForSide() in scripts/stats/tradeLedger.js.
function resultImpactHtml(managerId, impacts, managers) {
  if (!impacts?.length) return "";
  const lines = impacts
    .map(
      (i) =>
        `GW${i.gw}: actually ${i.actualResult} (${i.actualScore}-${i.opponentScore}) vs. ${managers.nameHtml(i.opponentId)} &mdash; would've been ${i.counterfactualResult} (${i.counterfactualScore}-${i.opponentScore}) keeping the original players`
    )
    .join("<br>");
  return `<div class="trade-impact">${lines}</div>`;
}

export function render(container, data, managers) {
  const logHtml = [...data.tradeLedger.log]
    .reverse()
    .map((trade) => {
      const sidesHtml = trade.sides
        .map(
          (s) => `
          <div style="margin-bottom:0.4rem;">
            <strong>${managers.nameHtml(s.managerId)}</strong> receives [${playerList(s.received)}]
            for [${playerList(s.given)}] — Net: <span class="${signedClass(s.netValue)}">${signed(s.netValue)}</span>
            ${positionRippleHtml(s.given)}
            ${resultImpactHtml(s.managerId, s.resultImpact, managers)}
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
          <td class="text-left">${managers.nameHtml(m.managerId)}</td>
          <td class="${signedClass(m.netTradeValue)}">${signed(m.netTradeValue)}</td>
        </tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Trade Ledger</h2>
    <p class="section-subtitle">Every trade's per-player point contributions, and each manager's season-long net trade value. The position-ripple and result-impact notes below are rough, for-fun estimates (see the trade for details), not precise accounting.</p>
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
