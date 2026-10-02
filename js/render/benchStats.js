import { escapeHtml, rankChipHtml } from "../format.js";

function scoringChipsHtml(scoring) {
  if (!scoring?.length) return `<span class="bench-chip bench-chip-muted">appearance points only</span>`;
  return scoring
    .map((s) => `<span class="bench-chip ${s.points < 0 ? "bench-chip-neg" : ""}">${escapeHtml(s.text)} <b>${s.points > 0 ? "+" : ""}${s.points}</b></span>`)
    .join("");
}

function benchWeekHtml(week, rank, managers) {
  const playersHtml = week.players
    .map(
      (p) => `
        <li class="bench-player">
          <span class="bench-player-main">
            <span class="bench-pos pos-${escapeHtml((p.position ?? "").toLowerCase())}">${escapeHtml(p.position ?? "")}</span>
            <span class="bench-player-name">${escapeHtml(p.playerName ?? "Unknown")}</span>
            <span class="bench-player-pts">${p.points} pts</span>
          </span>
          <span class="bench-chips">${scoringChipsHtml(p.scoring)}</span>
        </li>`
    )
    .join("");

  const resultWord = { W: "Won", L: "Lost", D: "Drew" }[week.result];
  const resultHtml = week.result
    ? `<span class="bench-result bench-result-${week.result}">${resultWord} ${week.ownScore}&ndash;${week.opponentScore} vs ${managers.clubHtml(week.opponentId)}</span>`
    : "";
  const costHtml = week.couldHaveWon
    ? `<span class="bench-cost" title="The best possible lineup from this squad would have beaten their opponent">Cost them the win</span>`
    : "";

  return `
    <article class="bench-week">
      <header class="bench-week-head">
        <div class="bench-week-who">${rankChipHtml(rank)}<div><strong>${managers.clubHtml(week.managerId)}</strong><span class="bench-week-gw">GW${week.gw}</span></div></div>
        <div class="bench-week-total"><strong>${week.benchPoints}</strong><span>pts on the bench</span></div>
      </header>
      <div class="bench-week-meta">${resultHtml}${costHtml}</div>
      <ul class="bench-players">${playersHtml}</ul>
    </article>`;
}

export function render(container, data, managers) {
  const sorted = [...data.benchStats.perManager].sort((a, b) => b.benchPointsWasted - a.benchPointsWasted);
  const rowsHtml = sorted
    .map(
      (m) => `
        <tr>
          <td class="text-left">${managers.clubHtml(m.managerId)}</td>
          <td>${m.benchPointsWasted}</td>
          <td>${m.couldHaveWonCount}</td>
          <td>${m.eligibleLossesOrDraws}</td>
        </tr>`
    )
    .join("");

  const weeks = data.benchStats.topBenchWeeks ?? [];
  const weeksHtml = weeks.length
    ? `<div class="bench-weeks">${weeks.map((w, i) => benchWeekHtml(w, i + 1, managers)).join("")}</div>`
    : `<p class="empty-state">No points left on a bench yet.</p>`;

  container.innerHTML = `
    <h2 class="section-title">Bench Stats</h2>
    <p class="section-subtitle">Points left on the bench, and how often the optimal starting XI would have flipped a loss or draw into a win.</p>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th class="text-left">Manager</th>
            <th>Bench Points Wasted</th>
            <th title="Losses/draws where the optimal XI would have won">Could Have Won</th>
            <th title="Losses or draws checked">Eligible GWs</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    <h3 class="bench-weeks-title">Biggest Bench Blunders</h3>
    <p class="section-subtitle">The ten single weeks with the most points sitting on a bench &mdash; who was left out, what they scored, and how they got it.</p>
    ${weeksHtml}
  `;
}
