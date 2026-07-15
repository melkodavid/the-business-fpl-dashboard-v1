import { buildSeasonCards, buildCareerCards, cardsByManager } from "../lib/cardTiers.js";
import { seasonCardHtml, miniCardHtml, careerCardFrontHtml } from "../lib/cardRender.js";
import { getIdentity } from "../identity.js";
import { openIdentityPanel } from "../identitySwitcher.js";

function careerCardHtml(card, managers, seasonsByManager) {
  const binderCards = seasonsByManager.get(card.managerKey) ?? [];
  return `
    <div class="career-card-slot">
      ${careerCardFrontHtml(card, managers)}
      <button type="button" class="binder-toggle" data-binder-toggle="${card.managerKey}">
        ▾ Open Full Collection (${binderCards.length} season${binderCards.length === 1 ? "" : "s"})
      </button>
      <div class="binder-strip" data-binder="${card.managerKey}">
        ${binderCards.map((c) => miniCardHtml(c, managers)).join("")}
      </div>
    </div>`;
}

export function render(container, data, managers) {
  const history = data.history;
  const seasonCards = buildSeasonCards(history);
  const careerCards = buildCareerCards(history);
  const seasonsByManager = cardsByManager(seasonCards);
  const seasonYears = [...history.seasons].filter((s) => s.table).reverse();

  const yearOptions = seasonYears.map((s) => `<option value="${s.year}">${s.year}${s.isCurrent ? " (current)" : ""}</option>`).join("");

  container.innerHTML = `
    <div class="cards-theme">
      <div class="page-head">
        <span class="eyebrow">Season Wrapped &middot; Collectible Archive</span>
        <h2 class="page-title">Trading Cards</h2>
        <p class="page-sub">One card per manager, per season. Foil tier is earned by where the table left them.</p>
      </div>

      <div class="filter-row">
        <button type="button" class="filter-pill active" data-view="manager">All Managers</button>
        <button type="button" class="filter-pill" data-view="season">By Season</button>
        <select id="cards-season-select" hidden>${yearOptions}</select>
      </div>

      <div id="cards-identity-cta" class="cards-cta" hidden>
        <button type="button" id="cards-identity-cta-btn">Pick your identity to jump to your binder</button>
      </div>

      <div id="cards-grid" class="grid career-grid">
        ${careerCards.map((c) => careerCardHtml(c, managers, seasonsByManager)).join("")}
      </div>

      <div id="cards-season-grid" class="grid" hidden></div>
    </div>
  `;

  const root = container.querySelector(".cards-theme");
  const managerBtn = root.querySelector('[data-view="manager"]');
  const seasonBtn = root.querySelector('[data-view="season"]');
  const seasonSelect = root.querySelector("#cards-season-select");
  const careerGrid = root.querySelector("#cards-grid");
  const seasonGrid = root.querySelector("#cards-season-grid");
  const ctaBox = root.querySelector("#cards-identity-cta");

  function renderSeasonGrid(year) {
    const cardsForYear = seasonCards.filter((c) => c.year === year).sort((a, b) => a.rank - b.rank);
    seasonGrid.innerHTML = cardsForYear.map((c) => seasonCardHtml(c, managers)).join("");
  }

  managerBtn.addEventListener("click", () => {
    managerBtn.classList.add("active");
    seasonBtn.classList.remove("active");
    seasonSelect.hidden = true;
    careerGrid.hidden = false;
    seasonGrid.hidden = true;
  });

  seasonBtn.addEventListener("click", () => {
    seasonBtn.classList.add("active");
    managerBtn.classList.remove("active");
    seasonSelect.hidden = false;
    careerGrid.hidden = true;
    seasonGrid.hidden = false;
    renderSeasonGrid(seasonSelect.value);
  });

  seasonSelect.addEventListener("change", () => renderSeasonGrid(seasonSelect.value));
  if (yearOptions) seasonSelect.value = seasonYears[0]?.year;

  // Delegated click for the binder toggle -- one listener for every career
  // card rather than one per card.
  careerGrid.addEventListener("click", (e) => {
    const toggle = e.target.closest("[data-binder-toggle]");
    if (!toggle) return;
    const key = toggle.dataset.binderToggle;
    const strip = root.querySelector(`[data-binder="${key}"]`);
    const open = strip.classList.toggle("open");
    const count = strip.children.length;
    toggle.textContent = open ? "▴ Close Collection" : `▾ Open Full Collection (${count} season${count === 1 ? "" : "s"})`;
  });

  ctaBox.querySelector("#cards-identity-cta-btn").addEventListener("click", openIdentityPanel);

  function jumpToMyBinder() {
    const me = getIdentity();
    if (!me || !seasonsByManager.has(me)) {
      ctaBox.hidden = !me ? false : true;
      return;
    }
    ctaBox.hidden = true;
    const card = root.querySelector(`.card.tier-career[data-manager-key="${me}"]`);
    const strip = root.querySelector(`[data-binder="${me}"]`);
    const toggle = root.querySelector(`[data-binder-toggle="${me}"]`);
    if (strip && !strip.classList.contains("open")) {
      strip.classList.add("open");
      toggle.textContent = "▴ Close Collection";
    }
    card?.closest(".career-card-slot")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // No identity-change subscription needed here: app.js's own
  // onIdentityChange(draw) already fully re-invokes this render() on every
  // identity change (same as a route change), so jumpToMyBinder() below
  // covers both the initial render and any later identity switch.
  jumpToMyBinder();
}
