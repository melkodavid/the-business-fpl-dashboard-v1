import { buildSeasonCards, buildCareerCards, cardsByManager } from "../lib/cardTiers.js";
import { seasonCardHtml, miniCardHtml, careerCardFrontHtml } from "../lib/cardRender.js";
import { RARITIES, prestigeRanks, TITLE_PRESTIGE } from "../lib/cardRarity.js";
import { getIdentity } from "../identity.js";
import { openIdentityPanel } from "../identitySwitcher.js";

// The "how rarity works" strip: one gem per tier with the prestige it takes.
function rarityGuideHtml() {
  const tiers = [...RARITIES].reverse();
  const items = tiers
    .map((r, i) => {
      const next = tiers[i + 1];
      const range = next ? `${r.min}–${next.min - 1}` : `${r.min}+`;
      const preview = UNLOCK_FX[r.id] ? `<button type="button" class="rarity-preview" data-preview="${r.id}" title="Preview the ${r.label} unlock animation">▶ Preview</button>` : "";
      return `<li class="rarity-guide-item rarity-${r.id}"><span class="tcg-gem" aria-hidden="true"></span><b>${r.label}</b><small>${range}</small>${preview}</li>`;
    })
    .join("");
  return `
    <div class="rarity-guide">
      <p class="rarity-guide-rule"><b>Prestige</b> = ${TITLE_PRESTIGE} per title + 1 per career win. Every win moves a card closer to the next rarity.</p>
      <ul class="rarity-guide-list">${items}</ul>
    </div>`;
}

// Mouse-follow tilt + glare. Delegated from the page root, so cards added later
// (the season grid re-renders) work with no extra wiring. Pointer devices only;
// skipped entirely under reduced-motion.
function attachTilt(root) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let active = null;
  const reset = (el) => {
    if (!el) return;
    el.style.removeProperty("--mx");
    el.style.removeProperty("--my");
    el.style.removeProperty("--rx");
    el.style.removeProperty("--ry");
    el.classList.remove("is-tilting");
  };
  root.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const card = e.target.closest(".tcg:not(.tcg-mini)");
    if (card !== active) {
      reset(active);
      active = card;
    }
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.classList.add("is-tilting");
    card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    card.style.setProperty("--rx", `${((px - 0.5) * 14).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${(-(py - 0.5) * 14).toFixed(2)}deg`);
  });
  root.addEventListener("pointerleave", () => {
    reset(active);
    active = null;
  });
}

// The first time a Celestial or Immortal card scrolls into view on this device,
// it spins in with a shockwave. Remembered per card+tier so it only ever plays
// once (and again if a card later climbs to the next tier).
const UNLOCK_KEY = "tbc-tier-unlocks";
const UNLOCK_COLOUR = { celestial: "#a8f0ff", immortal: "#ff9a2a" };
// Each tier arrives differently: Celestial through a black hole in deep space,
// Immortal erupting out of a firestorm (animations live in style.css).
const UNLOCK_FX = {
  celestial: `<i class="ux-vortex"></i><i class="ux-warp"></i><i class="ux-flash"></i><i class="ux-burst"></i><i class="tcg-shock"></i>`,
  immortal: `<i class="ux-heat"></i><i class="ux-fire"></i><i class="ux-fire two"></i><i class="ux-embers"></i><i class="ux-embers two"></i><i class="tcg-shock"></i>`,
};

function readSeenUnlocks() {
  try { return new Set(JSON.parse(localStorage.getItem(UNLOCK_KEY) ?? "[]")); } catch { return new Set(); }
}

// Turbulence filter that turns the Immortal flame columns into ragged, licking fire.
const FLAME_FILTER = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="ux-flame" x="-20%" y="-30%" width="140%" height="160%">
  <feTurbulence type="fractalNoise" baseFrequency="0.018 0.06" numOctaves="2" seed="3" result="n"><animate attributeName="baseFrequency" dur="1.3s" values="0.018 0.06;0.024 0.095;0.018 0.06" repeatCount="indefinite"/></feTurbulence>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="80" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Plays one tier's unlock on a card slot, then tidies up after itself. Calling it
// again mid-play restarts it (the replay button relies on that).
const unlockTimers = new WeakMap();
function startUnlock(slot, tier) {
  if (reducedMotion()) return;
  if (!document.getElementById("ux-flame")) document.body.insertAdjacentHTML("beforeend", FLAME_FILTER);
  clearTimeout(unlockTimers.get(slot));
  slot.querySelector(".tcg-unlock-fx")?.remove();
  slot.classList.remove("tcg-unlocking", "unlock-celestial", "unlock-immortal");
  void slot.offsetWidth; // let the browser see the reset so the animations restart
  const fx = document.createElement("div");
  fx.className = "tcg-unlock-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.style.setProperty("--sc", UNLOCK_COLOUR[tier]);
  fx.innerHTML = UNLOCK_FX[tier];
  slot.append(fx);
  slot.classList.add("tcg-unlocking", `unlock-${tier}`);
  unlockTimers.set(slot, setTimeout(() => { slot.classList.remove("tcg-unlocking", `unlock-${tier}`); fx.remove(); }, 3400));
}

function playTierUnlocks(root) {
  if (reducedMotion() || !("IntersectionObserver" in window)) return;
  const seen = readSeenUnlocks();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const slot = entry.target;
      const card = slot.querySelector(".tcg");
      const id = `${card.dataset.managerKey}:${card.dataset.rarity}`;
      observer.unobserve(slot);
      if (seen.has(id)) continue;
      seen.add(id);
      try { localStorage.setItem(UNLOCK_KEY, JSON.stringify([...seen])); } catch { /* private mode: it just plays again next visit */ }
      startUnlock(slot, card.dataset.rarity);
    }
  }, { threshold: 0.6 });
  root.querySelectorAll('.tcg[data-rarity="celestial"], .tcg[data-rarity="immortal"]').forEach((card) => observer.observe(card.closest(".career-card-slot")));
}

// "▶ Preview" on the rarity guide: nobody has reached these tiers yet, so show a
// stand-in card (the viewer's own, or the top of the ladder) lifted to the tier
// and play its unlock on demand. Looks real, changes nothing.
const PREVIEW_TITLES = { celestial: 7, immortal: 10 };

function openTierPreview(root, tier, baseCard, managers, total) {
  root.querySelector(".tier-preview")?.remove();
  const demo = { ...baseCard, titles: PREVIEW_TITLES[tier], w: Math.max(baseCard.w ?? 0, 60) };
  const overlay = document.createElement("div");
  overlay.className = "tier-preview";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", `${tier} card preview`);
  overlay.innerHTML = `
    <div class="tier-preview-stage"><div class="career-card-slot">${careerCardFrontHtml(demo, managers, { ladder: { rank: 1, total } })}</div></div>
    <p class="tier-preview-note">Preview only - nobody in the league has reached this tier yet.</p>
    <div class="tier-preview-bar">
      <button type="button" class="tier-preview-btn" data-act="replay">↻ Replay</button>
      <button type="button" class="tier-preview-btn" data-act="close">Close</button>
    </div>`;
  const slot = overlay.querySelector(".career-card-slot");
  const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  overlay.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "replay") startUnlock(slot, tier);
    else if (act === "close" || e.target === overlay) close();
  });
  document.addEventListener("keydown", onKey);
  root.append(overlay);
  startUnlock(slot, tier);
}

function careerCardHtml(card, managers, seasonsByManager, cardOpts) {
  const binderCards = seasonsByManager.get(card.managerKey) ?? [];
  return `
    <div class="career-card-slot">
      ${careerCardFrontHtml(card, managers, cardOpts)}
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

  // Each card's place on the prestige ladder is judged against the whole
  // all-time leaderboard, not just the current 12 -- a past champion who has
  // since left the league still counts.
  const ladder = prestigeRanks(careerCards);
  const reigningChampionKey = history.reigningChampionKey ?? null;
  const cardOpts = (card) => ({ isReigningChampion: card.managerKey === reigningChampionKey, ladder: ladder.get(card.managerKey) });

  const yearOptions = seasonYears.map((s) => `<option value="${s.year}">${s.year}${s.isCurrent ? " (current)" : ""}</option>`).join("");

  container.innerHTML = `
    <div class="cards-theme">
      <div class="page-head">
        <span class="eyebrow">Season Wrapped &middot; Collectible Archive</span>
        <h2 class="page-title">Trading Cards</h2>
        <p class="page-sub">The more you win, the rarer your card. Season cards are earned by where the table left each manager that year.</p>
      </div>
      ${rarityGuideHtml()}

      <div class="filter-row">
        <button type="button" class="filter-pill active" data-view="manager">All Managers</button>
        <button type="button" class="filter-pill" data-view="season">By Season</button>
        <select id="cards-season-select" hidden>${yearOptions}</select>
      </div>

      <div id="cards-identity-cta" class="cards-cta" hidden>
        <button type="button" id="cards-identity-cta-btn">Pick your identity to jump to your binder</button>
      </div>

      <div id="cards-grid" class="grid career-grid">
        ${careerCards.map((c) => careerCardHtml(c, managers, seasonsByManager, cardOpts(c))).join("")}
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
  attachTilt(root);
  playTierUnlocks(root);
  root.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-preview]");
    if (!btn) return;
    const base = careerCards.find((c) => c.managerKey === getIdentity()) ?? careerCards[0];
    openTierPreview(root, btn.dataset.preview, base, managers, careerCards.length);
  });

  function jumpToMyBinder() {
    const me = getIdentity();
    if (!me || !seasonsByManager.has(me)) {
      ctaBox.hidden = !me ? false : true;
      return;
    }
    ctaBox.hidden = true;
    const card = root.querySelector(`.tcg[data-manager-key="${me}"]`);
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
