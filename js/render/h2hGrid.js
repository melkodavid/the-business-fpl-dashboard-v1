function streakText(streak) {
  return streak ? `${streak.type}${streak.count}` : "—";
}

export function render(container, data, managers) {
  const cellByPair = new Map(data.h2hGrid.cells.map((c) => [`${c.managerId}:${c.opponentId}`, c]));
  const ids = managers.all.map((m) => m.id);

  const headerHtml = ids.map((id) => `<th>${managers.shortName(id)}</th>`).join("");
  const rowsHtml = ids
    .map((rowId) => {
      const cells = ids
        .map((colId) => {
          if (colId === rowId) return `<td>—</td>`;
          const cell = cellByPair.get(`${rowId}:${colId}`);
          if (!cell) return `<td class="empty-state">n/a</td>`;
          const title = `${cell.pointsFor}-${cell.pointsAgainst} pts, streak ${streakText(cell.streak)}`;
          return `<td title="${title}">${cell.wins}-${cell.losses}-${cell.draws}</td>`;
        })
        .join("");
      return `<tr><th class="text-left">${managers.shortName(rowId)}</th>${cells}</tr>`;
    })
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Head-to-Head Rivalry Grid</h2>
    <p class="section-subtitle">Row's all-time record (W-L-D) against column. Hover a cell for points and streak.</p>
    <div class="card">
      <table>
        <thead><tr><th class="text-left">vs</th>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
