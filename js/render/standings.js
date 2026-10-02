import { streakBadge, rankChipHtml, luckPillHtml } from "../format.js";
import { getIdentity } from "../identity.js";
import { luckExplainerHtml } from "../lib/luckExplainer.js";

const PODIUM_LABEL = { 1: "Leader", 2: "2nd", 3: "3rd" };

// Top three as a visual podium (1st raised in the middle). Skipped before any
// gameweek has been played, when "top three" would just be alphabetical noise.
function podiumHtml(rows, managers, myId) {
  const top = rows.slice(0, 3);
  if (top.length < 3 || top.every((r) => r.played === 0)) return "";
  const visualOrder = [top[1], top[0], top[2]];
  const places = visualOrder
    .map((r) => {
      // Use the table's own rank so tied teams share a place (two "2nd"s)
      // instead of the podium inventing a tiebreak the table doesn't have.
      const place = Math.min(Math.max(r.rank, 1), 3);
      return `
        <div class="podium-place place-${place} ${r.managerId === myId ? "is-me" : ""}">
          <div class="podium-medal">${PODIUM_LABEL[place]}</div>
          <div class="podium-avatar">${managers.avatarHtml(r.managerId)}</div>
          <div class="podium-name">${managers.clubHtml(r.managerId, { sub: true })}</div>
          <div class="podium-pts"><strong>${r.total}</strong> pts</div>
          <div class="podium-record">${r.won}-${r.drawn}-${r.lost} &middot; ${r.pointsFor} PF</div>
        </div>`;
    })
    .join("");
  return `<div class="podium">${places}</div>`;
}

export function render(container, data, managers) {
  const luckByManager = new Map(data.allPlay.standings.map((s) => [s.managerId, s.luckScore]));
  const myId = managers.idForPersonKey(getIdentity());

  const rowsHtml = data.standings.rows
    .map((r) => {
      const luck = luckByManager.get(r.managerId) ?? 0;
      return `
        <tr class="${r.managerId === myId ? "is-me" : ""}">
          <td>${rankChipHtml(r.rank)}</td>
          <td class="text-left">${managers.clubHtml(r.managerId, { sub: true })}</td>
          <td>${r.played}</td>
          <td>${r.won}</td>
          <td>${r.drawn}</td>
          <td>${r.lost}</td>
          <td>${r.pointsFor}</td>
          <td>${r.pointsAgainst}</td>
          <td><strong>${r.total}</strong></td>
          <td>${streakBadge(r.streak)}</td>
          <td>${luckPillHtml(luck)}</td>
        </tr>`;
    })
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Standings</h2>
    <p class="section-subtitle">League table with points for/against, current streak, and luck score (see "How is Luck calculated?" below the table).</p>
    ${podiumHtml(data.standings.rows, managers, myId)}
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
    ${luckExplainerHtml(data, managers, myId)}
  `;
}
