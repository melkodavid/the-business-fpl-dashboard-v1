// Shared trading-card DOM-string builders. Used by the Cards page (full
// trading cards with a season binder attached) and the landing page's "who's
// watching?" picker (compact member tiles, click-to-select) -- kept here so
// neither duplicates the other's markup.
//
// Rarity is earned by winning (see cardRarity.js): the more titles and match
// wins a manager has, the rarer and more elaborate their card gets.
import { escapeHtml } from "../format.js";
import { rarityFor, seedHue } from "./cardRarity.js";

// Season-card tiers (where a manager finished that year) -- separate from the
// career rarity ladder above.
export const TIER_LABEL = {
  legendary: "Champion",
  rare: "Top 4",
  common: "Mid-Table",
  spoon: "Wooden Spoon",
};

function initialsOf(name) {
  return (name ?? "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

const ordinal = (n) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`;
};

export function personFor(managerKey, displayName, managers) {
  const current = managers.all.find((m) => m.personKey === managerKey);
  return {
    personKey: managerKey,
    name: current?.playerName ?? displayName ?? managerKey,
    color: current?.color ?? "#5a6472",
    abbreviation: current?.abbreviation ?? initialsOf(current?.playerName ?? displayName),
    theme: managers.themeForPersonKey?.(managerKey) ?? null,
  };
}

// theme.avatarIcon (see data/league-lore.json) replaces the abbreviation
// outright with the theme icon -- for a manager whose running joke *is*
// their identity, rather than a badge layered on top of it. Otherwise, same
// assets/managers/{personKey}.jpg convention as the small site-wide avatar
// (js/data.js) -- falls back to the abbreviation if no photo file exists.
export function avatarHtml(person) {
  if (person.theme?.avatarIcon) {
    return `<span class="avatar avatar-theme-icon" style="background:${person.color}" title="${escapeHtml(person.theme.label)}">${person.theme.icon}</span>`;
  }
  const photoSrc = person.personKey ? `assets/managers/${person.personKey}.jpg` : null;
  const photoTag = photoSrc ? `<img class="avatar-photo" src="${photoSrc}" alt="" onerror="this.remove()">` : "";
  return `<span class="avatar" style="background:${person.color}">${person.abbreviation}${photoTag}</span>`;
}

export function winRate(w, d, l) {
  const played = w + d + l;
  return played > 0 ? Math.round((w / played) * 100) : 0;
}

// The picture window of a trading card: full-bleed photo (initials/icon
// behind it as the fallback), tinted with the manager's own colour.
function artHtml(person) {
  if (person.theme?.avatarIcon) {
    return `<div class="tcg-art-fill tcg-art-icon" style="--mc:${person.color}" title="${escapeHtml(person.theme.label)}">${person.theme.icon}</div>`;
  }
  const photoSrc = person.personKey ? `assets/managers/${person.personKey}.jpg` : null;
  const photoTag = photoSrc ? `<img class="tcg-photo" src="${photoSrc}" alt="" loading="lazy" onerror="this.remove()">` : "";
  return `<div class="tcg-art-fill" style="--mc:${person.color}"><span class="tcg-initials">${escapeHtml(person.abbreviation)}</span>${photoTag}</div>`;
}

// Belt, flag mast and corner badge are the league's running-joke decorations
// (see data/league-lore.json `theme`). The corner badge is skipped when the
// avatar already IS the icon, or a flag mast already carries it -- it sits
// large enough on a photo to cover real faces, so it isn't worth doing twice.
function decorationsFor(person) {
  const theme = person.theme;
  const showCornerBadge = theme && !theme.avatarIcon && !theme.flag;
  return {
    flag: theme?.flag ? `<span class="card-flag-mast" aria-hidden="true">${theme.icon}</span>` : "",
    corner: showCornerBadge ? `<span class="tcg-theme-badge" title="${escapeHtml(theme.label)}">${theme.icon}</span>` : "",
  };
}

// Special ribbon text for the top tiers -- the "eccentric" part: the more
// you win, the more the card shouts about it.
const RIBBON = { mythic: "Hall of Fame", legendary: "Legend" };

// ---------------------------------------------------------------------------
// Career card -- the headline trading card on the Cards tab.
// ---------------------------------------------------------------------------
export function careerCardFrontHtml(card, managers, { isReigningChampion = false, ladder = null } = {}) {
  const person = personFor(card.managerKey, card.displayName, managers);
  const rarity = rarityFor(card);
  const { flag, corner } = decorationsFor(person);
  const showCrown = rarity.id === "legendary" || rarity.id === "mythic";
  const ribbon = isReigningChampion ? "Reigning Champion" : RIBBON[rarity.id];

  const stat = (num, label) => `<div><span class="stat-num">${num}</span><span class="stat-label">${label}</span></div>`;
  const climb = rarity.next
    ? `<div class="tcg-climb" title="${rarity.next.needed} more prestige reaches ${rarity.next.label}">
         <span class="tcg-climb-text">Next: <b>${rarity.next.label}</b> &middot; ${rarity.next.needed} to go</span>
         <span class="tcg-climb-bar"><i style="width:${Math.round(rarity.progress * 100)}%"></i></span>
       </div>`
    : `<div class="tcg-climb tcg-climb-max"><span class="tcg-climb-text">Peak rarity reached</span></div>`;

  return `
    <div class="tcg rarity-${rarity.id}" data-manager-key="${card.managerKey}" data-rarity="${rarity.id}" style="--seed:${seedHue(card.managerKey)}deg">
      ${flag}
      ${showCrown ? `<span class="tcg-crown" aria-hidden="true">👑</span>` : ""}
      <div class="tcg-face">
        <div class="tcg-foil"></div>
        <div class="tcg-stars"></div>
        <div class="tcg-glare"></div>
        <header class="tcg-top">
          <div class="tcg-name-wrap">
            <span class="tcg-name">${escapeHtml(person.name)}</span>
            ${isReigningChampion ? beltIconHtml(26) : ""}
          </div>
          <div class="tcg-prestige"><b>${rarity.prestige}</b><small>Prestige</small></div>
        </header>
        <div class="tcg-art">
          ${artHtml(person)}
          ${ribbon ? `<span class="tcg-ribbon">${ribbon}</span>` : ""}
          <span class="tcg-best" title="Best finish in any season">Best ${ordinal(card.bestRank)}</span>
          ${corner}
        </div>
        <div class="tcg-type">
          <span class="tcg-type-titles">${card.titles ? `${"★".repeat(Math.min(card.titles, 8))} ${card.titles} Title${card.titles === 1 ? "" : "s"}` : "No titles yet"}</span>
          <span>${card.seasons} season${card.seasons === 1 ? "" : "s"}</span>
        </div>
        <div class="tcg-stats">
          ${stat(`${card.w}-${card.d}-${card.l}`, "W-D-L")}
          ${stat(`${card.winPct}%`, "Win Rate")}
          ${stat(card.top4, "Top-4s")}
          ${stat(card.pointsFor.toLocaleString(), "Pts For")}
          ${stat(card.points, "League Pts")}
          ${stat(card.avgRank, "Avg Rank")}
        </div>
        ${climb}
        <footer class="tcg-foot">
          <span class="tcg-gem" aria-hidden="true"></span>
          <span class="tcg-rarity-name">${rarity.label}</span>
          <span class="tcg-blurb">${rarity.blurb}</span>
          ${ladder ? `<span class="tcg-serial" title="Place on the prestige ladder">${String(ladder.rank).padStart(2, "0")}/${String(ladder.total).padStart(2, "0")}</span>` : ""}
        </footer>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Season card (one per manager per season; tier = where they finished).
// ---------------------------------------------------------------------------
const SEASON_RARITY = { legendary: "legendary", rare: "rare", common: "common", spoon: "spoon" };

export function seasonCardHtml(card, managers) {
  const person = personFor(card.managerKey, card.manager, managers);
  const tierLabel = TIER_LABEL[card.tier];
  const stat = (num, label) => `<div><span class="stat-num">${num}</span><span class="stat-label">${label}</span></div>`;
  return `
    <div class="tcg rarity-${SEASON_RARITY[card.tier]}" data-manager-key="${card.managerKey}" style="--seed:${seedHue(card.managerKey)}deg">
      <div class="tcg-face">
        <div class="tcg-foil"></div>
        <div class="tcg-stars"></div>
        <div class="tcg-glare"></div>
        <header class="tcg-top">
          <div class="tcg-name-wrap"><span class="tcg-name">${escapeHtml(person.name)}</span></div>
          <div class="tcg-prestige"><b>${card.rank}</b><small>Rank</small></div>
        </header>
        <div class="tcg-art">
          ${artHtml(person)}
          ${card.tier === "legendary" ? `<span class="tcg-ribbon">Champion</span>` : ""}
        </div>
        <div class="tcg-type">
          <span class="tcg-type-titles">${escapeHtml(card.team ?? "")}</span>
          <span>${card.year}${card.isCurrent ? " &middot; live" : ""}</span>
        </div>
        <div class="tcg-stats">
          ${stat(`${card.w}-${card.d}-${card.l}`, "W-D-L")}
          ${stat(`${winRate(card.w, card.d, card.l)}%`, "Win Rate")}
          ${stat(card.pts, "League Pts")}
        </div>
        <footer class="tcg-foot">
          <span class="tcg-gem" aria-hidden="true"></span>
          <span class="tcg-rarity-name">${tierLabel}</span>
          <span class="tcg-blurb">${card.plus} pts for</span>
        </footer>
      </div>
    </div>`;
}

// Small binder-strip card: just the season, the picture, and the result.
export function miniCardHtml(card, managers) {
  const person = personFor(card.managerKey, card.manager, managers);
  return `
    <div class="tcg tcg-mini rarity-${SEASON_RARITY[card.tier]}" style="--seed:${seedHue(card.managerKey)}deg">
      <div class="tcg-face">
        <div class="tcg-foil"></div>
        <div class="tcg-glare"></div>
        <header class="tcg-top"><span class="tcg-name">${card.year}</span><div class="tcg-prestige"><b>${card.rank}</b></div></header>
        <div class="tcg-art">${artHtml(person)}</div>
        <footer class="tcg-foot"><span class="tcg-gem" aria-hidden="true"></span><span class="tcg-rarity-name">${card.pts} pts</span></footer>
      </div>
    </div>`;
}

// Small inline SVG strap-buckle-strap championship belt -- no external
// asset, safe to stamp out more than once per page (no gradient <defs> ids
// to collide). Used both on the reigning champion's picker tile and the
// Home page's champion spotlight.
export function beltIconHtml(size = 32) {
  const h = Math.round(size * 0.4);
  return `
    <svg class="belt-icon" width="${size}" height="${h}" viewBox="0 0 100 40" aria-hidden="true">
      <rect x="0" y="15" width="34" height="10" rx="3" fill="#d9a53c" />
      <rect x="66" y="15" width="34" height="10" rx="3" fill="#d9a53c" />
      <rect x="28" y="4" width="44" height="32" rx="7" fill="#c9922e" stroke="#f7e2a4" stroke-width="1.5" />
      <rect x="34" y="10" width="32" height="20" rx="4" fill="#8a5c14" />
      <text x="50" y="25" text-anchor="middle" font-size="16" font-weight="700" fill="#f7e2a4">★</text>
    </svg>`;
}

// Compact roster-picker tile -- landing page only. Deliberately not built on
// the trading-card shell: just enough to identify and pick someone. Its frame
// follows the same rarity ladder as the full cards, so a manager's tile and
// card always agree.
export function memberTileHtml(card, managers, { isReigningChampion = false } = {}) {
  const person = personFor(card.managerKey, card.displayName, managers);
  const theme = person.theme;
  const showCornerBadge = theme && !theme.avatarIcon && !theme.flag;
  const rarity = rarityFor(card);
  const showCrown = rarity.id === "legendary" || rarity.id === "mythic";

  return `
    <div class="member-tile tier-${rarity.id}" data-manager-key="${card.managerKey}" data-rarity="${rarity.id}">
      ${theme?.flag ? `<span class="card-flag-mast" aria-hidden="true">${theme.icon}</span>` : ""}
      ${showCrown ? `<span class="crown-badge" aria-hidden="true">👑</span>` : ""}
      <div class="member-tile-inner">
        <div class="sheen"></div>
        <div class="member-photo">
          ${avatarHtml(person)}
          ${showCornerBadge ? `<span class="card-theme-badge" title="${escapeHtml(theme.label)}">${theme.icon}</span>` : ""}
        </div>
        <div class="member-info">
          <div class="member-name-row">
            <span class="member-name">${escapeHtml(person.name)}</span>
            ${isReigningChampion ? beltIconHtml(26) : ""}
          </div>
          <div class="member-meta">
            <span class="member-rarity">${rarity.label}</span> &middot; ${card.seasons} season${card.seasons === 1 ? "" : "s"}${card.titles ? ` &middot; <span class="member-stars" title="${card.titles} title${card.titles === 1 ? "" : "s"}">${"★".repeat(card.titles)}</span>` : ""}
          </div>
          <div class="member-record">
            <span class="stat-num">${card.w}-${card.d}-${card.l}</span> &middot; <span class="stat-num">${card.winPct}%</span> win
          </div>
        </div>
      </div>
    </div>`;
}
