export function render(container, data) {
  const rowsHtml = data.positionalStrength.perManager
    .map(
      (m) => `
        <tr>
          <td class="text-left">${m.managerName}</td>
          <td>${m.for.GK}</td><td>${m.for.DEF}</td><td>${m.for.MID}</td><td>${m.for.FWD}</td>
          <td><strong>${m.topForPosition}</strong></td>
          <td>${m.against.GK}</td><td>${m.against.DEF}</td><td>${m.against.MID}</td><td>${m.against.FWD}</td>
          <td><strong>${m.topAgainstPosition}</strong></td>
        </tr>`
    )
    .join("");

  container.innerHTML = `
    <h2 class="section-title">Positional Strength</h2>
    <p class="section-subtitle">Starting-XI points by position — your own scoring breakdown, and what opponents have scored against you.</p>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th class="text-left">Manager</th>
            <th colspan="5">For</th>
            <th colspan="5">Against</th>
          </tr>
          <tr>
            <th class="text-left"></th>
            <th>GK</th><th>DEF</th><th>MID</th><th>FWD</th><th>Top</th>
            <th>GK</th><th>DEF</th><th>MID</th><th>FWD</th><th>Top</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}
