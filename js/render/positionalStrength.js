// Two five-column blocks (GK/DEF/MID/FWD/Top): what each manager scored, then
// what opponents scored against them. The `pos-for` / `pos-against` classes
// tint and divide the blocks so it's obvious which numbers belong to which.
export function render(container, data, managers) {
  const rowsHtml = data.positionalStrength.perManager
    .map(
      (m) => `
        <tr>
          <td class="text-left">${managers.nameHtml(m.managerId)}</td>
          <td class="pos-for block-start">${m.for.GK}</td><td class="pos-for">${m.for.DEF}</td><td class="pos-for">${m.for.MID}</td><td class="pos-for">${m.for.FWD}</td>
          <td class="pos-for"><strong>${m.topForPosition}</strong></td>
          <td class="pos-against block-start">${m.against.GK}</td><td class="pos-against">${m.against.DEF}</td><td class="pos-against">${m.against.MID}</td><td class="pos-against">${m.against.FWD}</td>
          <td class="pos-against"><strong>${m.topAgainstPosition}</strong></td>
        </tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Positional Strength</h2>
    <p class="section-subtitle">Starting-XI points by position. <strong class="pos-key-for">For</strong> is what each manager's own players scored; <strong class="pos-key-against">Against</strong> is what their opponents' players scored against them. "Top" is the position with the most points in that block.</p>
    <div class="card">
      <table class="positional-table">
        <thead>
          <tr>
            <th class="text-left" rowspan="2">Manager</th>
            <th colspan="5" class="pos-group pos-for block-start">For &mdash; points scored</th>
            <th colspan="5" class="pos-group pos-against block-start">Against &mdash; points conceded</th>
          </tr>
          <tr>
            <th class="pos-for block-start">GK</th><th class="pos-for">DEF</th><th class="pos-for">MID</th><th class="pos-for">FWD</th><th class="pos-for">Top</th>
            <th class="pos-against block-start">GK</th><th class="pos-against">DEF</th><th class="pos-against">MID</th><th class="pos-against">FWD</th><th class="pos-against">Top</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
