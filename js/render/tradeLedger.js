import { signed, signedClass, escapeHtml, luckPillHtml } from "../format.js";

const rec = (r) => `${r.w}-${r.d}-${r.l}`;

const signedWord = (n, one, many) => `${n > 0 ? "+" : "−"}${Math.abs(n)} ${Math.abs(n) === 1 ? one : many}`;

// "▲ +1 win · +3 pts" / "▼ −1 pt" (a loss that would have been a draw) / "no change"
function scorecardImpactHtml(s) {
  if (s.winsDelta === 0 && s.pointsDelta === 0) return `<span class="luck-pill luck-flat">no change</span>`;
  const direction = s.pointsDelta !== 0 ? s.pointsDelta : s.winsDelta;
  const cls = direction > 0 ? "luck-up" : "luck-down";
  const arrow = direction > 0 ? "▲" : "▼";
  const pts = signedWord(s.pointsDelta, "pt", "pts");
  const text = s.winsDelta !== 0 ? `${signedWord(s.winsDelta, "win", "wins")} · ${pts}` : pts;
  return `<span class="luck-pill ${cls}">${arrow} ${text}</span>`;
}

// ---------------------------------------------------------------------------
// Scorecard: one row per manager -- trade count, net trade points, and what
// their record would be had they never traded.
// ---------------------------------------------------------------------------
function scorecardHtml(data, managers) {
  const netByManager = new Map(data.tradeLedger.leaderboard.map((m) => [m.managerId, m.netTradeValue]));
  const rows = data.tradeLedger.seasonImpact
    .map((s) => {
      const net = netByManager.get(s.managerId) ?? 0;
      return `
        <tr>
          <td class="text-left">${managers.nameHtml(s.managerId)}</td>
          <td>${s.tradeCount}</td>
          <td class="${signedClass(net)}">${signed(net)}</td>
          <td>${rec(s.actual)}</td>
          <td class="trade-without">${s.tradeCount ? rec(s.withoutTrades) : "—"}</td>
          <td>${s.tradeCount ? scorecardImpactHtml(s) : "—"}</td>
        </tr>`;
    })
    .join("");

  return `
    <div class="card">
      <h3>Trade Scorecard</h3>
      <p class="section-subtitle">"Without trades" re-plays every week as if the manager had kept the players they traded away (and never received the ones they got). A <span class="pos">▲</span> means the trades won them wins/points (league points: 3 for a win, 1 for a draw); a <span class="neg">▼</span> means they'd have been better off standing pat.</p>
      <table>
        <thead>
          <tr>
            <th class="text-left">Manager</th>
            <th>Trades</th>
            <th title="Points the traded-for players scored minus the traded-away players">Net trade pts</th>
            <th title="Actual W-D-L">Record</th>
            <th title="W-D-L if none of their trades had happened">Without trades</th>
            <th title="Wins and league points gained or lost because of trades">Trade impact</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// The specific weeks a manager's trades changed a result.
function flippedWeeksHtml(data, managers) {
  const withFlips = data.tradeLedger.seasonImpact.filter((s) => s.flips.length);
  if (!withFlips.length) return "";

  const blocks = withFlips
    .map((s) => {
      const lines = s.flips
        .map((f) => {
          const word = { W: "won", L: "lost", D: "drawn" };
          const verb = f.actualResult === "W" ? "won" : f.actualResult === "L" ? "lost" : "drew";
          const improved = f.counterfactualResult === "W" || (f.counterfactualResult === "D" && f.actualResult === "L");
          return `
            <li class="${improved ? "flip-would-improve" : "flip-would-worsen"}">
              <span class="flip-gw">GW${f.gw}</span>
              <span>${verb} ${f.actualScore}&ndash;${f.opponentScore} vs ${managers.nameHtml(f.opponentId)} &rarr; without trades would have ${word[f.counterfactualResult]} ${f.counterfactualScore}&ndash;${f.opponentScore}</span>
            </li>`;
        })
        .join("");
      return `<div class="flip-block"><strong>${managers.nameHtml(s.managerId)}</strong><ul class="flip-list">${lines}</ul></div>`;
    })
    .join("");

  return `
    <div class="card">
      <h3>Results the Trades Changed</h3>
      <p class="section-subtitle">Every week where a manager's result would have been different had they never traded. <span class="neg">Red</span> weeks are results trades cost them; <span class="pos">green</span> weeks are results trades won them.</p>
      ${blocks}
    </div>`;
}

// ---------------------------------------------------------------------------
// History: one compact row per trade, click to open the detail.
// ---------------------------------------------------------------------------
function playerChips(players) {
  if (!players.length) return `<span class="trade-none">—</span>`;
  return players
    .map((p) => `<span class="trade-player">${escapeHtml(p.playerName ?? "Unknown")} <b class="${signedClass(p.points)}">${signed(p.points)}</b></span>`)
    .join("");
}

// Loose "here's what followed", not a claim the trade caused it -- see
// nextSamePositionPickups() in scripts/stats/tradeLedger.js.
function rippleHtml(given) {
  const withRipple = given.filter((p) => p.positionRipple);
  if (!withRipple.length) return "";
  const items = withRipple
    .map((p) => {
      const r = p.positionRipple;
      return `<li>${escapeHtml(p.playerName)} out &rarr; next ${escapeHtml(r.position)} pickup: <strong>${escapeHtml(r.playerName)}</strong> (GW${r.acquiredGw}, ${r.points} pts in ${r.gwsStarted} started GW${r.gwsStarted === 1 ? "" : "s"})</li>`;
    })
    .join("");
  return `<div class="trade-ripple"><span class="trade-label">What came next</span><ul>${items}</ul></div>`;
}

function impactHtml(impacts, managers) {
  if (!impacts?.length) return "";
  const lines = impacts
    .map(
      (i) =>
        `<li>GW${i.gw}: actually ${i.actualResult} (${i.actualScore}&ndash;${i.opponentScore}) vs ${managers.nameHtml(i.opponentId)} &mdash; would've been ${i.counterfactualResult} (${i.counterfactualScore}&ndash;${i.opponentScore}) keeping the original players</li>`
    )
    .join("");
  return `<div class="trade-impact"><ul>${lines}</ul></div>`;
}

function tradeItemHtml(trade, managers) {
  const swings = trade.sides.reduce((n, s) => n + (s.resultImpact?.length ?? 0), 0);
  const parties = trade.sides.map((s) => managers.nameHtml(s.managerId)).join(' <span class="trade-swap">&#8644;</span> ');
  const nets = trade.sides.map((s) => `<span class="trade-net">${luckPillHtml(s.netValue)}</span>`).join("");

  const sidesHtml = trade.sides
    .map(
      (s) => `
        <div class="trade-side">
          <div class="trade-side-head"><strong>${managers.nameHtml(s.managerId)}</strong>${luckPillHtml(s.netValue)}</div>
          <div class="trade-row"><span class="trade-label">Got</span><span class="trade-chips">${playerChips(s.received)}</span></div>
          <div class="trade-row"><span class="trade-label">Gave up</span><span class="trade-chips">${playerChips(s.given)}</span></div>
          ${rippleHtml(s.given)}
          ${impactHtml(s.resultImpact, managers)}
        </div>`
    )
    .join("");

  return `
    <details class="trade-item">
      <summary>
        <span class="trade-gw">GW${trade.gw}</span>
        <span class="trade-parties">${parties}</span>
        <span class="trade-nets">${nets}</span>
        ${swings ? `<span class="trade-flag" title="This trade alone would have changed a result">changed ${swings} result${swings === 1 ? "" : "s"}</span>` : ""}
        <span class="trade-id">#${trade.tradeId}</span>
      </summary>
      <div class="trade-body">${sidesHtml}</div>
    </details>`;
}

export function render(container, data, managers) {
  const history = [...data.tradeLedger.log].reverse().map((t) => tradeItemHtml(t, managers)).join("");

  container.innerHTML = `
    <h2 class="section-title">Trade Ledger</h2>
    <p class="section-subtitle">Every trade's per-player point contributions, and what each manager's season would look like without them. The "what came next" and result-impact notes are rough, for-fun estimates, not precise accounting.</p>
    ${scorecardHtml(data, managers)}
    ${flippedWeeksHtml(data, managers)}
    <div class="card">
      <h3>Trade History</h3>
      <p class="section-subtitle">Newest first &mdash; click a trade to open it.</p>
      <div class="trade-list">${history || '<p class="empty-state">No trades yet.</p>'}</div>
    </div>
  `;
}
