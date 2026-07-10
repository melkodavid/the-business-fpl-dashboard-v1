import { escapeHtml } from "../format.js";

const PALETTE = [
  "#3b6fd6", "#e0653a", "#2fa86a", "#c94f9e", "#d6a13b", "#6f4fd6",
  "#3ba9c9", "#c94f4f", "#7ab53b", "#a34fc9", "#4f8ec9", "#c98f3b",
];

function buildScatter(scatter, managers) {
  const width = 720, height = 420;
  const margin = { top: 20, right: 20, bottom: 45, left: 55 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const xMax = Math.max(...scatter.map((d) => d.pickNumber), 1);
  const yMin = Math.min(0, ...scatter.map((d) => d.seasonPoints));
  const yMax = Math.max(...scatter.map((d) => d.seasonPoints), 1);

  const x = (v) => margin.left + (v / xMax) * innerW;
  const y = (v) => margin.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;

  const colorByManager = new Map(managers.all.map((m, i) => [m.id, PALETTE[i % PALETTE.length]]));

  const points = scatter
    .map((d) => {
      const color = colorByManager.get(d.managerId) ?? "#888";
      const stars = "★".repeat(managers.titles(d.managerId));
      return `<circle cx="${x(d.pickNumber).toFixed(1)}" cy="${y(d.seasonPoints).toFixed(1)}" r="4" fill="${color}" fill-opacity="0.8">
        <title>${escapeHtml(d.playerName)} — Pick #${d.pickNumber}, ${d.seasonPoints} pts (${escapeHtml(managers.name(d.managerId))}${stars ? " " + stars : ""})</title>
      </circle>`;
    })
    .join("");

  const yAxisTicks = 5;
  const ticksHtml = Array.from({ length: yAxisTicks + 1 }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / yAxisTicks;
    const yy = y(val);
    return `<line x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}" stroke="currentColor" stroke-opacity="0.08" />
            <text x="${margin.left - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="currentColor" opacity="0.6">${Math.round(val)}</text>`;
  }).join("");

  const legend = managers.all
    .map(
      (m, i) =>
        `<span style="display:inline-flex;align-items:center;gap:0.3rem;margin-right:0.75rem;font-size:0.75rem;">
          <span style="width:10px;height:10px;border-radius:50%;background:${PALETTE[i % PALETTE.length]};display:inline-block;"></span>
          ${managers.nameHtml(m.id)}
        </span>`
    )
    .join("");

  return `
    <div class="scatter-wrap">
      <svg viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${width}px; color:inherit;">
        ${ticksHtml}
        <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="currentColor" stroke-opacity="0.4" />
        <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="currentColor" stroke-opacity="0.4" />
        <text x="${width / 2}" y="${height - 8}" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.7">Overall pick number</text>
        <text x="14" y="${height / 2}" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.7" transform="rotate(-90 14 ${height / 2})">Season points</text>
        ${points}
      </svg>
      <div style="margin-top:0.5rem;">${legend}</div>
    </div>`;
}

export function render(container, data, managers) {
  const leaderboardHtml = data.draftGrades.leaderboard
    .map(
      (m, i) => `<tr><td>${i + 1}</td><td class="text-left">${managers.nameHtml(m.managerId)}</td><td>${m.draftTeamPoints}</td></tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Draft Grades — Pure Draft Team Tracker</h2>
    <p class="section-subtitle">Each manager's originally drafted squad, locked at draft completion and tracked independently of trades or waivers.</p>
    <div class="card">
      <h3>Draft Team Points</h3>
      <table>
        <thead><tr><th>#</th><th class="text-left">Manager</th><th>Points</th></tr></thead>
        <tbody>${leaderboardHtml}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Pick Number vs. Season Points</h3>
      ${buildScatter(data.draftGrades.scatter, managers)}
    </div>
  `;
}
