// Shared data loader for the matchup-page design samples. Everything here is
// the league's real, current data (data/*.json), so the samples show real
// fixtures, odds, form and badges rather than placeholder content.
export async function loadMatchups() {
  const get = (path) => fetch(`../data/${path}`).then((r) => r.json());
  const [schedule, managers, form, allPlay, standings, h2h, recapsIndex] = await Promise.all([
    get("schedule.json"), get("managers.json"), get("form-guide.json"),
    get("all-play.json"), get("standings.json"), get("h2h-grid.json"), get("recaps/index.json"),
  ]);

  const byId = new Map(managers.list.map((m) => [m.id, m]));
  const formBy = new Map(form.rows.map((r) => [r.managerId, r]));
  const luckBy = new Map(allPlay.standings.map((r) => [r.managerId, r.luckScore]));
  const standBy = new Map(standings.rows.map((r) => [r.managerId, r]));

  const side = (id, expected, winPct, soFar) => {
    const m = byId.get(id);
    const st = standBy.get(id);
    const fm = formBy.get(id);
    return {
      id, club: m.name.replace(/\s*\*+$/, ""), manager: m.playerName, personKey: m.personKey,
      color: m.color ?? "#6a2fa8", abbr: m.abbreviation, titles: m.titles,
      rank: st?.rank, points: st?.total, pf: st?.pointsFor, played: st?.played,
      record: st ? `${st.won}-${st.drawn}-${st.lost}` : "",
      form: (fm?.results ?? []).map((r) => r.result),
      formAvg: fm?.avgPoints, luck: luckBy.get(id) ?? 0,
      expected, winPct, soFar,
    };
  };

  const fixtures = schedule.fixtures.map((f) => {
    const o = f.odds ?? {};
    const cell = h2h.cells.find((c) => c.managerId === f.homeManagerId && c.opponentId === f.awayManagerId);
    return {
      tag: f.tag, importance: f.importance, started: f.started, finished: f.finished,
      home: side(f.homeManagerId, o.homeExpected, o.homeWinPct, o.homeSoFar),
      away: side(f.awayManagerId, o.awayExpected, o.awayWinPct, o.awaySoFar),
      drawPct: o.drawPct ?? null,
      h2h: cell ? { w: cell.wins, d: cell.draws, l: cell.losses } : null,
    };
  });

  // Headlines for ticker-style components: the latest recap's lines.
  const latest = recapsIndex.recaps.at(-1);
  const recap = latest ? await get(`recaps/gw${latest.gw}.json`) : null;
  const headlines = recap ? [recap.headline?.text, ...recap.secondaries.map((s) => s.text)].filter(Boolean) : [];

  return { gw: schedule.gw, deadline: schedule.deadline, oddsMeta: schedule.oddsMeta ?? null, fixtures, headlines };
}

// Club crest: the custom badge if one exists, otherwise a coloured shield with the abbreviation.
export function crestHtml(side, cls = "") {
  return `<span class="crest ${cls}" style="--c:${side.color}"><img src="../assets/badges/${side.personKey}.png" alt="" onerror="this.remove()"><b>${side.abbr}</b></span>`;
}

export function countdown(iso) {
  const ms = new Date(iso) - Date.now();
  if (!iso || ms <= 0) return { d: 0, h: 0, m: 0, s: 0, over: true };
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60, over: false };
}

export function formDots(results) {
  return results.map((r) => `<i class="f f-${r}">${r}</i>`).join("");
}

export const sign = (n) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
