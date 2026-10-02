export function signed(n) {
  const rounded = Math.round(n * 10) / 10;
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

export function signedClass(n) {
  return n > 0 ? "pos" : n < 0 ? "neg" : "";
}

export function round1(n) {
  return Math.round(n * 10) / 10;
}

export function streakBadge(streak) {
  if (!streak) return "—";
  const cls = streak.type === "W" ? "badge-w" : streak.type === "L" ? "badge-l" : "badge-d";
  return `<span class="badge ${cls}">${streak.type}${streak.count}</span>`;
}

// Gold/silver/bronze medallion for the top 3, plain number chip otherwise.
export function rankChipHtml(rank) {
  const tier = rank >= 1 && rank <= 3 ? rank : "n";
  return `<span class="rank-chip rank-${tier}">${rank}</span>`;
}

// Luck as a tinted pill with a direction arrow, rather than bare coloured text.
export function luckPillHtml(luck) {
  const rounded = Math.round(luck * 10) / 10;
  const cls = rounded > 0 ? "luck-up" : rounded < 0 ? "luck-down" : "luck-flat";
  const arrow = rounded > 0 ? "▲" : rounded < 0 ? "▼" : "•";
  return `<span class="luck-pill ${cls}">${arrow} ${signed(luck)}</span>`;
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Attaches click-to-sort behavior to a table's headers with data-sort-key,
// re-rendering the table body via the supplied renderBody(sortedRows) callback.
export function makeSortable(table, rows, renderBody, defaultKey, defaultDesc = true) {
  let sortKey = defaultKey;
  let desc = defaultDesc;

  function render() {
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return desc ? -cmp : cmp;
    });
    renderBody(sorted);
  }

  table.querySelectorAll("th[data-sort-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sortKey;
      if (key === sortKey) desc = !desc;
      else { sortKey = key; desc = true; }
      render();
    });
  });

  render();
}
