export function render(container, data) {
  const sorted = [...data.benchStats.perManager].sort((a, b) => b.benchPointsWasted - a.benchPointsWasted);
  const rowsHtml = sorted
    .map(
      (m) => `
        <tr>
          <td class="text-left">${m.managerName}</td>
          <td>${m.benchPointsWasted}</td>
          <td>${m.couldHaveWonCount}</td>
          <td>${m.eligibleLossesOrDraws}</td>
        </tr>`
    )
    .join("");

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
  `;
}
