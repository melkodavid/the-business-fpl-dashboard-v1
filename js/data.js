const FILES = {
  managers: "managers.json",
  standings: "standings.json",
  allPlay: "all-play.json",
  h2hGrid: "h2h-grid.json",
  awards: "awards.json",
  positionalStrength: "positional-strength.json",
  scoringType: "scoring-type.json",
  fiftyNineClub: "fifty-nine-club.json",
  benchStats: "bench-stats.json",
  draftGrades: "draft-grades.json",
  projectedPoints: "projected-points.json",
  draftBoard: "draft-board.json",
  tradeLedger: "trade-ledger.json",
  waiverHitRate: "waiver-hit-rate.json",
  formGuide: "form-guide.json",
  cup: "cup.json",
  history: "history.json",
  schedule: "schedule.json",
  meta: "meta.json",
  lore: "league-lore.json",
  seasonArcs: "season-arcs.json",
  recapsIndex: "recaps/index.json",
  upcomingManagers: "upcoming-managers.json",
};

export async function loadAllData() {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const res = await fetch(`data/${file}`);
      if (!res.ok) throw new Error(`Failed to load data/${file}: ${res.status}`);
      return [key, await res.json()];
    })
  );
  const data = Object.fromEntries(entries);

  // Recaps are one file per GW (data/recaps/gw{N}.json), not a single static
  // file, so the latest one can only be fetched once the index reveals which
  // GW that is.
  const recaps = data.recapsIndex?.recaps ?? [];
  const latestGw = recaps[recaps.length - 1]?.gw;
  data.latestRecap = latestGw
    ? await fetch(`data/recaps/gw${latestGw}.json`).then((r) => r.json())
    : null;

  return data;
}

// A manager who's won N titles gets N gold stars next to their name,
// everywhere their name appears on the site (standings, brackets, awards --
// anywhere except the Cup page, which is its own untouched theme).
function starBadges(count) {
  if (!count) return "";
  return ` <span class="title-stars" title="${count} title${count === 1 ? "" : "s"}">${"★".repeat(count)}</span>`;
}

function initialsOf(name) {
  return (name ?? "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function escapeAttr(str) {
  return (str ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// A handful of managers with a running joke/known team identity get an
// optional decorative emoji badge (see data/league-lore.json's `theme`
// field) -- most managers have none, in which case this renders nothing.
function themeBadgeHtml(theme) {
  if (!theme) return "";
  return `<span class="mgr-avatar-theme" title="${escapeAttr(theme.label)}">${theme.icon}</span>`;
}

// Manager photo convention: assets/managers/{personKey}.jpg, dropped in with no
// JSON edit required. Falls back to an initials badge tinted with the
// manager's chosen color if no photo file exists (or one hasn't been added yet).
// Wrapped in its own span (rather than putting the theme badge inside the
// circle) so the badge isn't clipped by the circle's overflow:hidden.
//
// theme.avatarIcon (see data/league-lore.json) replaces the initials/photo
// outright with the theme icon -- for a manager whose running joke *is*
// their identity, rather than a small badge layered on top of it.
function avatarHtml(m, theme) {
  const color = m?.color ?? "#5a6472";
  if (theme?.avatarIcon) {
    return `<span class="mgr-avatar-wrap"><span class="mgr-avatar mgr-avatar-icon" style="background:${color}" title="${escapeAttr(theme.label)}">${theme.icon}</span></span>`;
  }
  const label = initialsOf(m?.playerName ?? m?.name);
  const photoSrc = m?.personKey ? `assets/managers/${m.personKey}.jpg` : null;
  const photoTag = photoSrc ? `<img class="mgr-avatar-photo" src="${photoSrc}" alt="" onerror="this.remove()">` : "";
  return `<span class="mgr-avatar-wrap"><span class="mgr-avatar" style="background:${color}"><span class="mgr-avatar-initials">${label}</span>${photoTag}</span>${themeBadgeHtml(theme)}</span>`;
}

// Club badge -- the crest next to a team name on current-season pages, so the
// club reads as distinct from the person running it (history pages show the
// manager's name instead). Resolved in order:
//   1. a custom image dropped at assets/badges/{personKey}.png (or a path set
//      as `badge` in manager-profiles.json) -- shown over the shield
//   2. an emoji set as `badge` in manager-profiles.json
//   3. the default: a shield in the manager's colour with their abbreviation
function clubBadgeHtml(m) {
  const color = m?.color ?? "#5a6472";
  const badge = m?.badge ?? "";
  const isPath = /\.(png|jpe?g|svg|webp|gif)$/i.test(badge);
  const label = badge && !isPath ? badge : (m?.abbreviation ?? initialsOf(m?.name));
  const imgSrc = isPath ? badge : m?.personKey ? `assets/badges/${m.personKey}.png` : null;
  const imgTag = imgSrc ? `<img class="club-badge-img" src="${escapeAttr(imgSrc)}" alt="" loading="lazy" onerror="this.remove()">` : "";
  const emojiClass = badge && !isPath ? " club-badge-emoji" : "";
  return `<span class="club-badge${emojiClass}" style="--bc:${color}"><span class="club-badge-shape"><span class="club-badge-text">${escapeAttr(label)}</span></span>${imgTag}</span>`;
}

function clubHtml(m, id, { sub = false } = {}) {
  const name = m?.name ?? `Manager ${id}`;
  const subHtml = sub && m?.playerName ? `<span class="club-sub">${escapeAttr(m.playerName)}</span>` : "";
  return `<span class="club" title="${escapeAttr(m?.playerName ?? "")}">${clubBadgeHtml(m)}<span class="club-text"><span class="club-name">${name}${starBadges(m?.titles)}</span>${subHtml}</span></span>`;
}

export function managerLookup(data) {
  const byId = new Map(data.managers.list.map((m) => [m.id, m]));
  const byPersonKey = new Map(data.managers.list.map((m) => [m.personKey, m]));
  const themeByPersonKey = new Map(
    (data.lore?.people ?? []).filter((p) => p.theme).map((p) => [p.personKey, p.theme])
  );
  return {
    name: (id) => byId.get(id)?.name ?? `Manager ${id}`,
    shortName: (id) => byId.get(id)?.shortName ?? `M${id}`,
    nameHtml: (id) => `${byId.get(id)?.name ?? `Manager ${id}`}${starBadges(byId.get(id)?.titles)}`,
    // Club (team name + badge, manager on hover) for current-season pages;
    // nameHtml stays the plain team name, which the Cup page keeps using.
    clubHtml: (id, opts) => clubHtml(byId.get(id), id, opts),
    badgeHtml: (id) => clubBadgeHtml(byId.get(id)),
    playerName: (id) => byId.get(id)?.playerName ?? "",
    starsHtml: (id) => starBadges(byId.get(id)?.titles),
    color: (id) => byId.get(id)?.color ?? null,
    abbreviation: (id) => byId.get(id)?.abbreviation ?? byId.get(id)?.shortName ?? "???",
    titles: (id) => byId.get(id)?.titles ?? 0,
    avatarHtml: (id) => avatarHtml(byId.get(id), themeByPersonKey.get(byId.get(id)?.personKey)),
    themeForPersonKey: (key) => themeByPersonKey.get(key) ?? null,
    // Standings/All-Play/H2H Grid are keyed by numeric managerId, while
    // Cards/History/the identity switcher deal in personKey (the stable,
    // cross-season person identity) -- these two resolve between the spaces
    // so a page in either id space can check "is this the selected identity".
    idForPersonKey: (key) => byPersonKey.get(key)?.id ?? null,
    personKeyForId: (id) => byId.get(id)?.personKey ?? null,
    all: data.managers.list,
  };
}
