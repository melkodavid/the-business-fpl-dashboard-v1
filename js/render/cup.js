const ROUND_LABELS = {
  round1: "Round 1",
  round2: "Quarterfinal",
  round3: "Semifinal",
  round4: "Final",
};

function matchHtml(match, managers) {
  if (!match) return "";
  const hasResult = match.scoreA !== undefined;
  const aWinner = hasResult && match.winnerId === match.managerAId;
  const bWinner = hasResult && match.winnerId === match.managerBId;
  const tiebreakNote = match.tiebreaker
    ? `<div style="font-size:0.7rem;color:var(--text-muted);">Tiebreaker: ${match.tiebreaker}</div>`
    : "";

  return `
    <div class="bracket-match">
      <div class="side ${aWinner ? "winner" : ""}">
        <span>${managers.name(match.managerAId)}</span>
        <span>${hasResult ? match.scoreA : ""}</span>
      </div>
      <div class="side ${bWinner ? "winner" : ""}">
        <span>${managers.name(match.managerBId)}</span>
        <span>${hasResult ? match.scoreB : ""}</span>
      </div>
      ${tiebreakNote}
    </div>`;
}

function roundColumn(key, roundData, managers) {
  if (!roundData || !roundData.draw) {
    return `<div class="bracket-round"><h4>${ROUND_LABELS[key]}</h4><p class="empty-state">Not yet drawn.</p></div>`;
  }
  const matches = roundData.results ?? roundData.draw;
  const matchesHtml = matches.map((m) => matchHtml(m, managers)).join("");
  const gwLabel = roundData.gws.length > 1 ? `GW${roundData.gws[0]}-${roundData.gws[1]}` : `GW${roundData.gws[0]}`;
  return `<div class="bracket-round"><h4>${ROUND_LABELS[key]} · ${gwLabel}</h4>${matchesHtml}</div>`;
}

export function render(container, data, managers) {
  const cup = data.cup;

  if (cup.status === "pending") {
    container.innerHTML = `
      <h2 class="section-title">FA Cup</h2>
      <div class="card"><p class="empty-state">${cup.reason}</p></div>
    `;
    return;
  }

  const seedsHtml = cup.seeds
    .map((s) => `<tr><td>${s.seed}</td><td class="text-left">${managers.name(s.managerId)}</td></tr>`)
    .join("");

  const championHtml =
    cup.status === "complete"
      ? `<div class="card"><h3>🏆 Champion: ${managers.name(cup.champion)}</h3></div>`
      : "";

  container.innerHTML = `
    <h2 class="section-title">FA Cup</h2>
    <p class="section-subtitle">12-team knockout, seeded from the standings snapshot after GW${cup.seedingSnapshotGw}. Pairings are randomly drawn each round.</p>
    ${championHtml}
    <div class="card">
      <div class="bracket">
        ${roundColumn("round1", cup.rounds.round1, managers)}
        ${roundColumn("round2", cup.rounds.round2, managers)}
        ${roundColumn("round3", cup.rounds.round3, managers)}
        ${roundColumn("round4", cup.rounds.round4, managers)}
      </div>
    </div>
    <div class="card">
      <h3>Seeding (top 4 = Round 1 bye)</h3>
      <table>
        <thead><tr><th>Seed</th><th class="text-left">Manager</th></tr></thead>
        <tbody>${seedsHtml}</tbody>
      </table>
    </div>
  `;
}
