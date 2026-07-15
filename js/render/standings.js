import { signed, signedClass, streakBadge } from "../format.js";
import { getIdentity } from "../identity.js";

export function render(container, data, managers) {
  const luckByManager = new Map(data.allPlay.standings.map((s) => [s.managerId, s.luckScore]));
  const myId = managers.idForPersonKey(getIdentity());

  const rowsHtml = data.standings.rows
    .map((r) => {
      const luck = luckByManager.get(r.managerId) ?? 0;
      return `
        <tr class="${r.managerId === myId ? "is-me" : ""}">
          <td>${r.rank}</td>
          <td class="text-left">${managers.nameHtml(r.managerId)}</td>
          <td>${r.played}</td>
          <td>${r.won}</td>
          <td>${r.drawn}</td>
          <td>${r.lost}</td>
          <td>${r.pointsFor}</td>
          <td>${r.pointsAgainst}</td>
          <td><strong>${r.total}</strong></td>
          <td>${streakBadge(r.streak)}</td>
          <td class="${signedClass(luck)}">${signed(luck)}</td>
        </tr>`;
    })
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Standings</h2>
    <p class="section-subtitle">League table with points for/against, current streak, and luck-adjusted score.</p>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>#</th><th class="text-left">Manager</th><th>P</th><th>W</th><th>D</th><th>L</th>
            <th>PF</th><th>PA</th><th>Pts</th><th>Streak</th><th title="Actual wins minus expected wins from all-play">Luck</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
