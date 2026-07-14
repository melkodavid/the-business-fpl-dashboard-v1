import { buildRecapCard } from "./recapSection.js";

// Season Story archive: every published recap, most recent first. Each GW's
// full JSON is only fetched on demand (there could be a full season's worth
// of files) rather than upfront in loadAllData.
async function fetchRecap(gw) {
  const res = await fetch(`data/recaps/gw${gw}.json`);
  if (!res.ok) throw new Error(`Failed to load data/recaps/gw${gw}.json: ${res.status}`);
  return res.json();
}

export async function render(container, data) {
  const gws = (data.recapsIndex?.recaps ?? []).map((r) => r.gw).sort((a, b) => b - a);

  container.innerHTML = `
    <h2 class="section-title">Season Story</h2>
    <p class="section-subtitle">Every published gameweek recap, most recent first.</p>
    <div class="card"><p>Loading recaps…</p></div>
  `;

  if (gws.length === 0) {
    container.querySelector(".card").innerHTML = "<p>No recaps published yet.</p>";
    return;
  }

  const recaps = await Promise.all(gws.map(fetchRecap));
  const cardsHtml = recaps.map((r) => buildRecapCard(r)).join("");

  const cardWrapper = container.querySelector(".card");
  cardWrapper.outerHTML = `<div class="recap-archive">${cardsHtml}</div>`;
}
