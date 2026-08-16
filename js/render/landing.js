import { initPassNetwork } from "../lib/passNetwork.js";
import { memberTileHtml, beltIconHtml, avatarHtml, personFor } from "../lib/cardRender.js";
import { buildCareerCards } from "../lib/cardTiers.js";
import { getIdentity, setIdentity } from "../identity.js";

const SELECT_ANIMATION_MS = 420;

// A manager who hasn't joined the real league yet (see
// data/upcoming-managers.json) -- no stats to show, just a distinct "not
// started yet" tile so they still have something to click ahead of their
// first season. Same member-tile shell as everyone else so the grid doesn't
// mix two different card shapes; uses the same data-manager-key attribute
// as a real member tile, so the existing click handler needs no
// special-casing for it.
function rookieTileHtml(person) {
  const photoSrc = person.personKey ? `assets/managers/${person.personKey}.jpg` : null;
  const photoTag = photoSrc ? `<img class="avatar-photo" src="${photoSrc}" alt="" onerror="this.remove()">` : "";
  return `
    <div class="member-tile tier-untitled" data-manager-key="${person.personKey}">
      <div class="member-tile-inner">
        <div class="sheen"></div>
        <div class="member-photo">
          <span class="avatar" style="background:${person.color}">${person.abbreviation}${photoTag}</span>
        </div>
        <div class="member-info">
          <div class="member-name-row"><span class="member-name">${person.displayName}</span></div>
          <div class="member-meta">Rookie &middot; First season coming up</div>
        </div>
      </div>
    </div>`;
}

// Home page spotlight for whoever won the most recent decided season (see
// history.reigningChampionKey) -- separate from the crown/tier system,
// which is about total titles held, not who's currently on top.
function championSpotlightHtml(card, managers) {
  const person = personFor(card.managerKey, card.displayName, managers);
  return `
    <div class="champion-spotlight">
      <div class="champion-photo">${avatarHtml(person)}</div>
      <div class="champion-info">
        <span class="champion-eyebrow">Reigning Champion</span>
        <span class="champion-name">${person.name}</span>
        <span class="champion-titles">${"★".repeat(card.titles)} ${card.titles} Title${card.titles === 1 ? "" : "s"}</span>
      </div>
      ${beltIconHtml(60)}
    </div>`;
}

export function render(container, data, managers) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const me = getIdentity();

  // Only the 12 current managers belong as "who's viewing" choices --
  // buildCareerCards() also returns departed/historical managers from the
  // all-time leaderboard, which don't make sense as login-style options.
  // Already sorted titles desc, then avg rank asc, then win% desc (see
  // scripts/stats/history.js's leaderboard) -- no extra sort needed here.
  const careerCards = buildCareerCards(data.history).filter((c) => managers.all.some((m) => m.personKey === c.managerKey));
  const maxTitles = careerCards.reduce((max, c) => Math.max(max, c.titles), 0);
  const reigningChampionKey = data.history?.reigningChampionKey ?? null;
  const reigningChampionCard = careerCards.find((c) => c.managerKey === reigningChampionKey) ?? null;

  const cardsHtml = careerCards
    .map((card) => {
      const isYou = card.managerKey === me;
      const isReigningChampion = card.managerKey === reigningChampionKey;
      return `
        <div class="career-card-slot picker-slot">
          <button type="button" class="picker-card-btn ${isYou ? "is-you" : ""}" data-manager-key="${card.managerKey}">
            ${memberTileHtml(card, managers, { maxTitles, isReigningChampion })}
            <span class="picker-card-cta">${isYou ? "Continue as You →" : "Play as this manager →"}</span>
          </button>
        </div>`;
    })
    .join("");

  // Real league members (post-draft, or new joiners with no completed
  // season yet) have no career-leaderboard row until their first season's
  // standings exist -- give them the same "Rookie" treatment as an explicit
  // upcoming-managers.json entry so they still have a card to pick.
  const careerKeys = new Set(careerCards.map((c) => c.managerKey));
  const newRealManagers = managers.all
    .filter((m) => !careerKeys.has(m.personKey))
    .map((m) => ({
      personKey: m.personKey,
      displayName: m.playerName ?? m.name,
      color: m.color ?? "#5a6472",
      abbreviation: m.abbreviation ?? m.shortName ?? "???",
    }));

  const rookiesHtml = [...newRealManagers, ...(data.upcomingManagers?.upcoming ?? [])]
    .map((person) => {
      const isYou = person.personKey === me;
      return `
        <div class="career-card-slot picker-slot">
          <button type="button" class="picker-card-btn ${isYou ? "is-you" : ""}" data-manager-key="${person.personKey}">
            ${rookieTileHtml(person)}
            <span class="picker-card-cta">${isYou ? "Continue as You →" : "Play as this manager →"}</span>
          </button>
        </div>`;
    })
    .join("");

  container.innerHTML = `
    <div class="schedule-luxury landing-hero">
      <div class="hero-block">
        <div class="giant-mark" aria-hidden="true">X</div>
        <div class="hero-content">
          <span class="eyebrow">Who's Watching?</span>
          <span class="title-line-2">The Business</span>
          <span class="est-line">Est. 2017 · Tenth Anniversary Season</span>
          <div class="hero-rule"><span></span><span class="dot"></span><span></span></div>
        </div>
        <canvas id="landingPassNetwork" class="sl-pass-canvas"></canvas>
      </div>
    </div>

    <div class="cards-theme">
      ${reigningChampionCard ? championSpotlightHtml(reigningChampionCard, managers) : ""}
      <div class="grid career-grid picker-grid" id="landing-picker-grid">
        ${cardsHtml}
        ${rookiesHtml}
      </div>
    </div>
  `;

  const heroBlock = container.querySelector(".landing-hero .hero-block");
  const canvas = container.querySelector("#landingPassNetwork");
  if (canvas && heroBlock) initPassNetwork(canvas, heroBlock);

  const grid = container.querySelector("#landing-picker-grid");
  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".picker-card-btn");
    if (!btn) return;

    const key = btn.dataset.managerKey;

    function navigate() {
      // Order matters: location.hash updates synchronously (the hashchange
      // *event* fires later, async), so setting it first means that by the
      // time setIdentity()'s synchronous dispatch triggers app.js's
      // onIdentityChange(draw), currentRoute() already resolves to
      // "my-season" and getIdentity() already returns the new key -- one
      // clean render straight to the personalized page. Reversing this order
      // would re-render the landing page itself first (a visible flash)
      // before the async hashchange catches up.
      location.hash = "#my-season";
      setIdentity(key);
    }

    if (reduceMotion) {
      navigate();
      return;
    }

    btn.classList.add("selecting");
    grid.querySelectorAll(".picker-card-btn").forEach((other) => {
      if (other !== btn) other.classList.add("dimmed");
    });
    setTimeout(navigate, SELECT_ANIMATION_MS);
  });
}
