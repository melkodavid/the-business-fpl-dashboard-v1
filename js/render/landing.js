import { initPassNetwork } from "../lib/passNetwork.js";
import { careerCardFrontHtml } from "../lib/cardRender.js";
import { buildCareerCards } from "../lib/cardTiers.js";
import { getIdentity, setIdentity } from "../identity.js";

const SELECT_ANIMATION_MS = 420;

// A manager who hasn't joined the real league yet (see
// data/upcoming-managers.json) -- no stats to show, just a distinct "not
// started yet" card so they still have something to click ahead of their
// first season. Uses the same data-manager-key attribute as a real career
// card, so the existing click handler needs no special-casing for it.
function rookieCardHtml(person) {
  const photoSrc = person.personKey ? `assets/managers/${person.personKey}.jpg` : null;
  const photoTag = photoSrc ? `<img class="avatar-photo" src="${photoSrc}" alt="" onerror="this.remove()">` : "";
  return `
    <div class="card tier-rookie">
      <div class="card-inner">
        <div class="sheen"></div>
        <div class="card-photo">
          <span class="tier-tag">Rookie</span>
          <span class="avatar" style="background:${person.color}">${person.abbreviation}${photoTag}</span>
        </div>
        <div class="career-body">
          <div class="card-name">${person.displayName}</div>
          <div class="card-team">First season coming up</div>
        </div>
      </div>
    </div>`;
}

function generalViewTileHtml() {
  return `
    <div class="card tier-common general-view-card">
      <div class="card-inner">
        <div class="sheen"></div>
        <div class="card-photo general-view-icon">⚽</div>
        <div class="career-body">
          <div class="card-name">General View</div>
          <div class="card-team">See everything, for everyone</div>
        </div>
      </div>
    </div>`;
}

export function render(container, data, managers) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const me = getIdentity();

  // Only the 12 current managers belong as "who's viewing" choices --
  // buildCareerCards() also returns departed/historical managers from the
  // all-time leaderboard, which don't make sense as login-style options.
  const careerCards = buildCareerCards(data.history).filter((c) => managers.all.some((m) => m.personKey === c.managerKey));
  careerCards.sort((a, b) => {
    const nameA = managers.all.find((m) => m.personKey === a.managerKey)?.playerName ?? a.displayName ?? "";
    const nameB = managers.all.find((m) => m.personKey === b.managerKey)?.playerName ?? b.displayName ?? "";
    return nameA.localeCompare(nameB);
  });

  const cardsHtml = careerCards
    .map((card) => {
      const isYou = card.managerKey === me;
      return `
        <div class="career-card-slot picker-slot">
          <button type="button" class="picker-card-btn ${isYou ? "is-you" : ""}" data-manager-key="${card.managerKey}">
            ${careerCardFrontHtml(card, managers)}
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
            ${rookieCardHtml(person)}
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
      <div class="grid career-grid picker-grid" id="landing-picker-grid">
        ${cardsHtml}
        ${rookiesHtml}
        <div class="career-card-slot picker-slot">
          <button type="button" class="picker-card-btn" data-general-view>
            ${generalViewTileHtml()}
          </button>
        </div>
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

    if (btn.dataset.generalView !== undefined) {
      location.hash = "#schedule";
      return;
    }

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
