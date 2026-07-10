import { signed, signedClass } from "../format.js";

function formBoxes(results) {
  return results
    .map((r) => {
      const cls = r.result === "W" ? "win" : r.result === "L" ? "loss" : "draw";
      return `<span class="form-box ${cls}" title="GW${r.gw}: ${r.result} (${r.points} pts)">${r.result}</span>`;
    })
    .join("");
}

export function render(container, data, managers) {
  const { rows, leagueAvgPoints } = data.formGuide;
  const window = rows[0]?.gwsIncluded ?? [];

  const rowsHtml = rows
    .map(
      (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="text-left">${managers.nameHtml(r.managerId)}</td>
          <td class="text-left"><div class="form-strip">${formBoxes(r.results)}</div></td>
          <td>${r.avgPoints}</td>
          <td class="${signedClass(r.diffFromLeagueAvg)}">${signed(r.diffFromLeagueAvg)}</td>
        </tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Form Guide</h2>
    <p class="section-subtitle">Win/draw/loss over the last ${window.length || 5} completed gameweeks${window.length ? ` (GW${window[0]}–${window[window.length - 1]})` : ""}, and average points against the league's own average over that span (${leagueAvgPoints} pts/GW).</p>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th class="text-left">Manager</th>
            <th class="text-left">Form</th>
            <th title="Average points per gameweek over the window">Avg Pts</th>
            <th title="Average points vs. the league-wide average over the same gameweeks">+/- League</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
