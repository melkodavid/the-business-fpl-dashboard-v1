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

// Manager photo convention: assets/managers/{personKey}.jpg, dropped in with no
// JSON edit required. Falls back to an initials badge tinted with the
// manager's chosen color if no photo file exists (or one hasn't been added yet).
function avatarHtml(m) {
  const color = m?.color ?? "#5a6472";
  const label = initialsOf(m?.playerName ?? m?.name);
  const photoSrc = m?.personKey ? `assets/managers/${m.personKey}.jpg` : null;
  const photoTag = photoSrc ? `<img class="mgr-avatar-photo" src="${photoSrc}" alt="" onerror="this.remove()">` : "";
  return `<span class="mgr-avatar" style="background:${color}"><span class="mgr-avatar-initials">${label}</span>${photoTag}</span>`;
}

export function managerLookup(data) {
  const byId = new Map(data.managers.list.map((m) => [m.id, m]));
  const byPersonKey = new Map(data.managers.list.map((m) => [m.personKey, m]));
  return {
    name: (id) => byId.get(id)?.name ?? `Manager ${id}`,
    shortName: (id) => byId.get(id)?.shortName ?? `M${id}`,
    nameHtml: (id) => `${byId.get(id)?.name ?? `Manager ${id}`}${starBadges(byId.get(id)?.titles)}`,
    starsHtml: (id) => starBadges(byId.get(id)?.titles),
    color: (id) => byId.get(id)?.color ?? null,
    abbreviation: (id) => byId.get(id)?.abbreviation ?? byId.get(id)?.shortName ?? "???",
    titles: (id) => byId.get(id)?.titles ?? 0,
    avatarHtml: (id) => avatarHtml(byId.get(id)),
    // Standings/All-Play/H2H Grid are keyed by numeric managerId, while
    // Cards/History/the identity switcher deal in personKey (the stable,
    // cross-season person identity) -- these two resolve between the spaces
    // so a page in either id space can check "is this the selected identity".
    idForPersonKey: (key) => byPersonKey.get(key)?.id ?? null,
    personKeyForId: (id) => byId.get(id)?.personKey ?? null,
    all: data.managers.list,
  };
}
