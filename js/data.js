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
  meta: "meta.json",
};

export async function loadAllData() {
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, file]) => {
      const res = await fetch(`data/${file}`);
      if (!res.ok) throw new Error(`Failed to load data/${file}: ${res.status}`);
      return [key, await res.json()];
    })
  );
  return Object.fromEntries(entries);
}

// A manager who's won N titles gets N gold stars next to their name,
// everywhere their name appears on the site (standings, brackets, awards --
// anywhere except the Cup page, which is its own untouched theme).
function starBadges(count) {
  if (!count) return "";
  return ` <span class="title-stars" title="${count} title${count === 1 ? "" : "s"}">${"★".repeat(count)}</span>`;
}

export function managerLookup(data) {
  const byId = new Map(data.managers.list.map((m) => [m.id, m]));
  return {
    name: (id) => byId.get(id)?.name ?? `Manager ${id}`,
    shortName: (id) => byId.get(id)?.shortName ?? `M${id}`,
    nameHtml: (id) => `${byId.get(id)?.name ?? `Manager ${id}`}${starBadges(byId.get(id)?.titles)}`,
    color: (id) => byId.get(id)?.color ?? null,
    abbreviation: (id) => byId.get(id)?.abbreviation ?? byId.get(id)?.shortName ?? "???",
    titles: (id) => byId.get(id)?.titles ?? 0,
    all: data.managers.list,
  };
}
