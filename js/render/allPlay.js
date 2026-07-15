import { signed, signedClass, round1 } from "../format.js";
import { getIdentity } from "../identity.js";

export function render(container, data, managers) {
  const myId = managers.idForPersonKey(getIdentity());
  const rowsHtml = data.allPlay.standings
    .map(
      (s, i) => `
        <tr class="${s.managerId === myId ? "is-me" : ""}">
          <td>${i + 1}</td>
          <td class="text-left">${managers.nameHtml(s.managerId)}</td>
          <td>${s.actualWins}</td>
          <td>${round1(s.expectedWins)}</td>
          <td class="${signedClass(s.luckScore)}">${signed(s.luckScore)}</td>
        </tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">All-Play Standings</h2>
    <p class="section-subtitle">Each manager's score compared against all 11 others every gameweek — sorted by Expected Wins.</p>
    <div class="card">
      <table>
        <thead>
          <tr><th>#</th><th class="text-left">Manager</th><th>Actual Wins</th><th>Expected Wins</th><th>Luck Score</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
