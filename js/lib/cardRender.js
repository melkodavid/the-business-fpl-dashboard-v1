// Shared trading-card DOM-string builders. Used by the Cards page (full
// cards with a season binder attached) and the landing page's "who's
// watching?" picker (the same card fronts, no binder, click-to-select
// instead of click-to-expand) -- kept here so neither duplicates the other's
// markup.
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
    name: current?.playerName ?? displayName ?? managerKey,
    color: current?.color ?? "#5a6472",
    abbreviation: current?.abbreviation ?? initialsOf(current?.playerName ?? displayName),
  };
}

export function avatarHtml(person) {
  return `<span class="avatar" style="background:${person.color}">${person.abbreviation}</span>`;
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

// Just the card face -- photo/badge/avatar/name/team/titles/stat-grid, no
// surrounding .career-card-slot wrapper and no binder chrome. cards.js wraps
// this with a binder-toggle + binder-strip; the landing page wraps it with a
// plain select-to-continue button instead.
export function careerCardFrontHtml(card, managers) {
  const person = personFor(card.managerKey, card.displayName, managers);
  return `
    <div class="card tier-career" data-manager-key="${card.managerKey}">
      <div class="card-inner">
        <div class="sheen"></div>
        <div class="card-photo">
          <div class="rank-badge">#${card.bestRank}</div>
          <span class="tier-tag">All-Time</span>
          ${avatarHtml(person)}
        </div>
        <div class="career-body">
          <div class="card-name">${person.name}</div>
          <div class="card-team">${card.seasons} season${card.seasons === 1 ? "" : "s"} in The Business</div>
          ${card.titles ? `<div class="career-titles">${"★ ".repeat(card.titles).trim()} &nbsp;${card.titles} Title${card.titles === 1 ? "" : "s"}</div>` : ""}
          <div class="career-stat-grid">
            <div><span class="stat-num">${card.w}-${card.d}-${card.l}</span><span class="stat-label">Career W-D-L</span></div>
            <div><span class="stat-num">${card.winPct}%</span><span class="stat-label">Win Rate</span></div>
            <div><span class="stat-num">${card.top4}</span><span class="stat-label">Top-4s</span></div>
            <div><span class="stat-num">${card.pointsFor.toLocaleString()}</span><span class="stat-label">Career Pts For</span></div>
            <div><span class="stat-num">${card.points}</span><span class="stat-label">Career League Pts</span></div>
            <div><span class="stat-num">${card.avgRank}</span><span class="stat-label">Avg. Rank</span></div>
          </div>
        </div>
      </div>
    </div>`;
}
