export function render(container, data, managers) {
  const window = data.formGuide.rows[0]?.gwsIncluded ?? [];
  const rowsHtml = data.formGuide.rows
    .map((r, i) => `<tr><td>${i + 1}</td><td class="text-left">${managers.nameHtml(r.managerId)}</td><td>${r.formPoints}</td></tr>`)
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Form Guide</h2>
    <p class="section-subtitle">Rolling total over the last ${window.length || 5} completed gameweeks${window.length ? ` (GW${window[0]}–${window[window.length - 1]})` : ""}.</p>
    <div class="card">
      <table>
        <thead><tr><th>#</th><th class="text-left">Manager</th><th>Points</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
