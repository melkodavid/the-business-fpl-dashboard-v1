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
