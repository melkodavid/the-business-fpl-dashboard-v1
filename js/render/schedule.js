function statusInfo(fixture) {
  if (fixture.finished) return { label: "FT", cls: "status-ft" };
  if (fixture.started) return { label: "LIVE", cls: "status-live" };
  return { label: "Not Started", cls: "status-scheduled" };
}

function fixtureCard(f, managers) {
  const status = statusInfo(f);
  const homeColor = managers.color(f.homeManagerId) ?? "#5a6472";
  const awayColor = managers.color(f.awayManagerId) ?? "#5a6472";

  return `
    <div class="fixture-card">
      <div class="fixture-tag">${f.tag}</div>
      <div class="fixture-body">
        <div class="fixture-side">
          ${managers.avatarHtml(f.homeManagerId)}
          <span class="fixture-abbr" style="background:${homeColor}">${managers.abbreviation(f.homeManagerId)}</span>
          <span class="fixture-name">${managers.nameHtml(f.homeManagerId)}</span>
          <span class="fixture-rank">#${f.homeRank}</span>
        </div>
        <div class="fixture-score">
          <span class="${f.finished || f.started ? "" : "score-pending"}">${f.started || f.finished ? f.homePoints : "–"}</span>
          <span class="fixture-score-sep">:</span>
          <span class="${f.finished || f.started ? "" : "score-pending"}">${f.started || f.finished ? f.awayPoints : "–"}</span>
        </div>
        <div class="fixture-side away">
          <span class="fixture-rank">#${f.awayRank}</span>
          <span class="fixture-name">${managers.nameHtml(f.awayManagerId)}</span>
          <span class="fixture-abbr" style="background:${awayColor}">${managers.abbreviation(f.awayManagerId)}</span>
          ${managers.avatarHtml(f.awayManagerId)}
        </div>
      </div>
      <div class="fixture-status ${status.cls}">${status.label}</div>
    </div>`;
}

export function render(container, data, managers) {
  const { gw, seasonComplete, fixtures } = data.schedule;

  const banner = seasonComplete
    ? `<p class="section-subtitle">The season's played out — here's how the final gameweek (GW${gw}) landed. Check back once next season's fixtures are live.</p>`
    : `<p class="section-subtitle">Gameweek ${gw}'s fixtures, ranked by matchup importance — title six-pointers and bottom-of-the-table battles float to the top.</p>`;

  const cardsHtml = fixtures.map((f) => fixtureCard(f, managers)).join("");

  container.innerHTML = `
    <h2 class="section-title">${seasonComplete ? "Final Day Recap" : "This Week's Schedule"}</h2>
    ${banner}
    <div class="fixture-list">
      ${cardsHtml || '<p class="empty-state">No fixtures to show.</p>'}
    </div>
  `;
}
