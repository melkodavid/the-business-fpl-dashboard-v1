// "Latest recap" block for the front page: headline styled large, secondaries
// below. Shared between the This Week landing page and the Season Story
// archive (which reuses buildRecapCard per past GW).
export function buildRecapCard(recap, { large } = {}) {
  if (!recap || !recap.headline) return "";

  const headlineTag = large ? "h2" : "p";
  const secondariesHtml = recap.secondaries
    .map((s) => `<li>${s.text}</li>`)
    .join("");

  return `
    <div class="recap-card ${large ? "recap-card-large" : ""}">
      <span class="recap-gw">GW${recap.gw}</span>
      <${headlineTag} class="recap-headline">${recap.headline.text}</${headlineTag}>
      ${secondariesHtml ? `<ul class="recap-secondaries">${secondariesHtml}</ul>` : ""}
    </div>`;
}
