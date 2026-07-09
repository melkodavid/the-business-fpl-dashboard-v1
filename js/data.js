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

export function managerLookup(data) {
  const byId = new Map(data.managers.list.map((m) => [m.id, m]));
  return {
    name: (id) => byId.get(id)?.name ?? `Manager ${id}`,
    shortName: (id) => byId.get(id)?.shortName ?? `M${id}`,
    all: data.managers.list,
  };
}
