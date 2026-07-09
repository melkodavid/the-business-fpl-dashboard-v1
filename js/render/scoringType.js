import { makeSortable } from "../format.js";

export function render(container, data) {
  container.innerHTML = `
    <h2 class="section-title">Points by Scoring Type</h2>
    <p class="section-subtitle">Starting-XI points broken down by source. Click a column header to sort.</p>
    <div class="card">
      <table id="scoring-table">
        <thead>
          <tr>
            <th class="text-left" data-sort-key="managerName">Manager</th>
            <th data-sort-key="goals">Goals</th>
            <th data-sort-key="assists">Assists</th>
            <th data-sort-key="cleanSheets">Clean Sheets</th>
            <th data-sort-key="defensiveContribution">Def. Contribution</th>
            <th data-sort-key="bonus">Bonus</th>
            <th data-sort-key="cardsLost">Discipline</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const tbody = container.querySelector("tbody");
  const table = container.querySelector("#scoring-table");
  makeSortable(table, data.scoringType.perManager, (rows) => {
    tbody.innerHTML = rows
      .map(
        (m) => `
          <tr>
            <td class="text-left">${m.managerName}</td>
            <td>${m.goals}</td><td>${m.assists}</td><td>${m.cleanSheets}</td>
            <td>${m.defensiveContribution}</td><td>${m.bonus}</td>
            <td class="${m.cardsLost < 0 ? "neg" : ""}">${m.cardsLost}</td>
          </tr>`
      )
      .join("");
  }, "goals");
}
