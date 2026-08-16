// Shared trading-card DOM-string builders. Used by the Cards page (full
// cards with a season binder attached) and the landing page's "who's
// watching?" picker (the same card fronts, no binder, click-to-select
// instead of click-to-expand) -- kept here so neither duplicates the other's
// markup.
import { escapeHtml } from "../format.js";
export const TIER_LABEL = {
  legendary: "Champion",
  rare: "Top 4",
  common: "Mid-Table",
  spoon: "Wooden Spoon",
};

function initialsOf(name) {
  return (name ?? "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

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

export function seasonCardHtml(card, managers) {
  const person = personFor(card.managerKey, card.manager, managers);
  const tierLabel = TIER_LABEL[card.tier];
  return `
    <div class="card tier-${card.tier}">
      <div class="card-inner">
        <div class="sheen"></div>
        <div class="card-photo">
          <div class="rank-badge">${card.rank}</div>
          <span class="tier-tag">${tierLabel}</span>
          ${avatarHtml(person)}
          ${card.tier === "legendary" ? '<span class="title-star">★</span>' : ""}
        </div>
        <div class="card-body">
          <div class="card-name">${person.name}</div>
          <div class="card-team">${card.team ?? ""}</div>
          <div class="card-season">${card.year}${card.isCurrent ? " · Current" : ""} · ${tierLabel}</div>
          <div class="stat-line">
            <div><span class="stat-num">${card.w}-${card.d}-${card.l}</span><span class="stat-label">W-D-L</span></div>
            <div><span class="stat-num">${card.plus}</span><span class="stat-label">Pts For</span></div>
            <div><span class="stat-num">${card.pts}</span><span class="stat-label">League Pts</span></div>
            <div><span class="stat-num">${winRate(card.w, card.d, card.l)}%</span><span class="stat-label">Win Rate</span></div>
          </div>
        </div>
      </div>
    </div>`;
}

export function miniCardHtml(card, managers) {
  const person = personFor(card.managerKey, card.manager, managers);
  return `
    <div class="card-mini tier-${card.tier}">
      <div class="card-inner">
        <div class="sheen"></div>
        <div class="card-photo">
          <div class="rank-badge">${card.rank}</div>
          ${avatarHtml(person)}
        </div>
        <div class="card-body">
          <div class="card-season">${card.year}</div>
          <div class="stat-line"><div><span class="stat-num">${card.pts} pts</span></div></div>
        </div>
      </div>
    </div>`;
}

// Shared shell for a career/all-time card -- photo/badge/avatar/name/team/
// titles, with `statsHtml` as the only part that varies between the full
// breakdown (Cards tab) and the condensed highlight (landing page picker).
// No surrounding .career-card-slot wrapper and no binder chrome -- cards.js
// wraps this with a binder-toggle + binder-strip; the landing page wraps it
// with a plain select-to-continue button instead.
//
// Rarity/glow here is titles won (see titleTier), layered on top of the
// tier-career holo-shift shimmer every all-time card already has: untitled
// dials that shimmer back to near nothing (never won = least special by
// design), titled/elder/legendary escalate it, and legendary (the current
// title leader) adds a crown + the strongest pulsing glow. isReigningChampion
// is a separate signal (who won most recently, not who's won the most) and
// gets its own championship-belt badge next to their name.
function careerCardShellHtml(card, managers, statsHtml, { maxTitles = 0, isReigningChampion = false } = {}) {
  const person = personFor(card.managerKey, card.displayName, managers);
  const theme = person.theme;
  // Skip the corner badge when the avatar itself already *is* the theme icon
  // (e.g. ostap) -- showing it twice on one card would be redundant.
  const showCornerBadge = theme && !theme.avatarIcon;
  const tier = titleTier(card.titles, maxTitles);
  return `
    <div class="card tier-career title-${tier}" data-manager-key="${card.managerKey}">
      ${theme?.flag ? `<span class="card-flag-mast" aria-hidden="true">${theme.icon}</span>` : ""}
      ${tier === "legendary" ? `<span class="crown-badge" aria-hidden="true">👑</span>` : ""}
      <div class="card-inner">
        <div class="sheen"></div>
        <div class="card-photo">
          <div class="rank-badge">#${card.bestRank}</div>
          <span class="tier-tag">All-Time</span>
          ${avatarHtml(person)}
          ${showCornerBadge ? `<span class="card-theme-badge" title="${escapeHtml(theme.label)}">${theme.icon}</span>` : ""}
        </div>
        <div class="career-body">
          <div class="card-name-row">
            <span class="card-name">${person.name}</span>
            ${isReigningChampion ? beltIconHtml(24) : ""}
          </div>
          <div class="card-team">${card.seasons} season${card.seasons === 1 ? "" : "s"} in The Business</div>
          ${card.titles ? `<div class="career-titles">${"★ ".repeat(card.titles).trim()} &nbsp;${card.titles} Title${card.titles === 1 ? "" : "s"}</div>` : ""}
          ${statsHtml}
        </div>
      </div>
    </div>`;
}

// Full 6-stat breakdown -- the Cards tab, where the whole point is to dig
// into someone's career numbers.
export function careerCardFrontHtml(card, managers, opts) {
  // Labels dropped their redundant "Career" prefix (the whole section is
  // already understood to be career stats) -- shorter labels plus the grid
  // CSS below (2 columns instead of 3, content-sized not forced-equal) is
  // what actually stops these from wrapping at a trading card's width.
  const statsHtml = `
    <div class="career-stat-grid">
      <div><span class="stat-num">${card.w}-${card.d}-${card.l}</span><span class="stat-label">W-D-L</span></div>
      <div><span class="stat-num">${card.winPct}%</span><span class="stat-label">Win Rate</span></div>
      <div><span class="stat-num">${card.top4}</span><span class="stat-label">Top-4s</span></div>
      <div><span class="stat-num">${card.pointsFor.toLocaleString()}</span><span class="stat-label">Pts For</span></div>
      <div><span class="stat-num">${card.points}</span><span class="stat-label">League Pts</span></div>
      <div><span class="stat-num">${card.avgRank}</span><span class="stat-label">Avg Rank</span></div>
    </div>`;
  return careerCardShellHtml(card, managers, statsHtml, opts);
}

// Rarity here is titles won, not season performance: legendary = whoever
// currently holds the most titles of anyone in the league (crown-worthy),
// elder = multiple titles but not the record holder, titled = exactly one,
// untitled = none yet and plainest by design.
export function titleTier(titles, maxTitles) {
  if (titles > 0 && titles === maxTitles) return "legendary";
  if (titles >= 2) return "elder";
  if (titles === 1) return "titled";
  return "untitled";
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
// the trading-card shell: no fixed tall aspect ratio, no rank-badge/tier-tag
// chrome, just enough to identify and pick someone, sized to its own
// content instead of a card shape meant for a full stat breakdown.
export function memberTileHtml(card, managers, { maxTitles = 0, isReigningChampion = false } = {}) {
  const person = personFor(card.managerKey, card.displayName, managers);
  const theme = person.theme;
  const showCornerBadge = theme && !theme.avatarIcon;
  const tier = titleTier(card.titles, maxTitles);

  return `
    <div class="member-tile tier-${tier}" data-manager-key="${card.managerKey}">
      ${theme?.flag ? `<span class="card-flag-mast" aria-hidden="true">${theme.icon}</span>` : ""}
      ${tier === "legendary" ? `<span class="crown-badge" aria-hidden="true">👑</span>` : ""}
      <div class="member-tile-inner">
        <div class="sheen"></div>
        <div class="member-photo">
          ${avatarHtml(person)}
          ${showCornerBadge ? `<span class="card-theme-badge" title="${escapeHtml(theme.label)}">${theme.icon}</span>` : ""}
        </div>
        <div class="member-info">
          <div class="member-name-row">
            <span class="member-name">${person.name}</span>
            ${isReigningChampion ? beltIconHtml(26) : ""}
          </div>
          <div class="member-meta">
            ${card.seasons} season${card.seasons === 1 ? "" : "s"}${card.titles ? ` &middot; ${"★".repeat(card.titles)} ${card.titles} Title${card.titles === 1 ? "" : "s"}` : ""}
          </div>
          <div class="member-record">
            <span class="stat-num">${card.w}-${card.d}-${card.l}</span> &middot; <span class="stat-num">${card.winPct}%</span> win
          </div>
        </div>
      </div>
    </div>`;
}
