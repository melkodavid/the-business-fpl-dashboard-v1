// "Tale of the Tape" -- an enriched fixture card for the upcoming gameweek's
// biggest matchups, layering rivalry history, form, luck, and positional edge
// on top of the plain schedule card. Reuses the same lore accessor the
// build-time narrative engine uses (a pure, portable module with no Node
// dependencies) so family/rivalry logic isn't duplicated client-side.
import { loadLore } from "../../scripts/narrative/lore.js";

export { loadLore };

function personKeyOf(managerId, managers) {
  return managers.all.find((m) => m.id === managerId)?.personKey ?? null;
}

function h2hCellFor(homeId, awayId, h2hGrid) {
  return h2hGrid.cells.find((c) => c.managerId === homeId && c.opponentId === awayId) ?? null;
}

function formRowFor(managerId, formGuide) {
  return formGuide.rows.find((r) => r.managerId === managerId) ?? null;
}

function luckScoreFor(managerId, allPlay) {
  return allPlay.standings.find((s) => s.managerId === managerId)?.luckScore ?? 0;
}

function last5WinPct(managerId, allPlay) {
  const gws = Object.keys(allPlay.perGw)
    .map(Number)
    .sort((a, b) => a - b)
    .slice(-5);
  if (gws.length === 0) return 0.5;
  const pcts = gws.map((gw) => allPlay.perGw[gw].find((r) => r.managerId === managerId)?.allPlayWinPct ?? 0.5);
  return pcts.reduce((a, b) => a + b, 0) / pcts.length;
}

function positionalEdge(homeId, awayId, positionalStrength) {
  const home = positionalStrength.perManager.find((p) => p.managerId === homeId);
  const away = positionalStrength.perManager.find((p) => p.managerId === awayId);
  if (!home || !away) return [];

  const notes = [];
  if (home.topForPosition === away.topAgainstPosition) {
    notes.push(`${home.topForPosition} edge: strong there, and it's where the opponent leaks the most`);
  }
  if (away.topForPosition === home.topAgainstPosition) {
    notes.push(`Watch their ${away.topForPosition}: it's their best position, and this side's weakest defensively`);
  }
  return notes;
}

function formStripHtml(results) {
  return results
    .map((r) => {
      const cls = r.result === "W" ? "win" : r.result === "L" ? "loss" : "draw";
      return `<span class="form-box ${cls}" title="GW${r.gw}: ${r.result} (${r.points} pts)">${r.result}</span>`;
    })
    .join("");
}

function loreHook(homeKey, awayKey, lore) {
  const relation = lore.familyRelation(homeKey, awayKey);
  if (relation === "brother") return { label: "Family", text: "Brothers, for now." };
  if (relation === "cousin") return { label: "Family", text: "Ernesto vs. Tongar: the cousin clash." };

  const rivalry = lore.rivalryFor(homeKey, awayKey);
  if (rivalry) return { label: "Rivalry", text: rivalry.blurb ?? rivalry.name };

  if (lore.isBridesmaid(homeKey) || lore.isBridesmaid(awayKey)) {
    return { label: "Bridesmaid stakes", text: "History says this is exactly when it goes wrong." };
  }

  return null;
}

function gauntletHook(homeId, awayId, seasonArcs) {
  const arc = seasonArcs?.gauntletWatch;
  if (!arc) return null;
  if (arc.facts.managerId !== homeId && arc.facts.managerId !== awayId) return null;
  const played = arc.facts.played ?? 0;
  const length = arc.facts.length;
  return { label: "Gauntlet Watch", text: `Leg ${played + 1} of ${length} against the family.` };
}

export function buildTaleOfTheTapeCard(fixture, data, managers, lore) {
  const { homeManagerId: homeId, awayManagerId: awayId } = fixture;
  const homeKey = personKeyOf(homeId, managers);
  const awayKey = personKeyOf(awayId, managers);

  const h2h = h2hCellFor(homeId, awayId, data.h2hGrid);
  const homeForm = formRowFor(homeId, data.formGuide);
  const awayForm = formRowFor(awayId, data.formGuide);
  const homeLuck = luckScoreFor(homeId, data.allPlay);
  const awayLuck = luckScoreFor(awayId, data.allPlay);
  const edges = positionalEdge(homeId, awayId, data.positionalStrength);
  const hook = gauntletHook(homeId, awayId, data.seasonArcs) ?? loreHook(homeKey, awayKey, lore);

  const homePct = last5WinPct(homeId, data.allPlay);
  const awayPct = last5WinPct(awayId, data.allPlay);
  const total = homePct + awayPct || 1;
  const homeShare = Math.round((homePct / total) * 100);
  const awayShare = 100 - homeShare;

  const rivalryLine = h2h
    ? `${h2h.wins}-${h2h.draws}-${h2h.losses} all-time${h2h.streak.count > 1 ? ` &middot; ${h2h.streak.type === "W" ? managers.name(homeId) : managers.name(awayId)} on a ${h2h.streak.count}-game run` : ""}`
    : "First ever meeting";
  const lastMeetingLine = h2h
    ? `Last time: GW${h2h.lastMeeting.gw}, ${h2h.lastMeeting.pointsFor}-${h2h.lastMeeting.pointsAgainst}`
    : "";

  return `
    <div class="tale-card">
      <div class="fixture-tag">${fixture.tag}</div>
      <div class="tale-heads">
        <div class="tale-side">
          ${managers.avatarHtml(homeId)}
          <span class="fixture-name">${managers.nameHtml(homeId)}</span>
          <span class="fixture-rank">#${fixture.homeRank}</span>
        </div>
        <div class="tale-vs">vs</div>
        <div class="tale-side away">
          <span class="fixture-name">${managers.nameHtml(awayId)}</span>
          <span class="fixture-rank">#${fixture.awayRank}</span>
          ${managers.avatarHtml(awayId)}
        </div>
      </div>

      <div class="tale-rivalry">
        <span>${rivalryLine}</span>
        ${lastMeetingLine ? `<span class="tale-dim">${lastMeetingLine}</span>` : ""}
      </div>

      <div class="tale-forms">
        <div class="tale-form-side">
          <div class="form-strip">${homeForm ? formStripHtml(homeForm.results) : ""}</div>
          <span class="tale-dim">Luck ${homeLuck >= 0 ? "+" : ""}${homeLuck.toFixed(1)}</span>
        </div>
        <div class="tale-form-side away">
          <div class="form-strip">${awayForm ? formStripHtml(awayForm.results) : ""}</div>
          <span class="tale-dim">Luck ${awayLuck >= 0 ? "+" : ""}${awayLuck.toFixed(1)}</span>
        </div>
      </div>

      <div class="tale-win-prob">
        <span class="tale-win-prob-label">Form says</span>
        <div class="tale-win-prob-bar">
          <span style="width:${homeShare}%"></span>
        </div>
        <span class="tale-win-prob-split">${homeShare}/${awayShare}</span>
      </div>

      ${edges.length ? `<div class="tale-edges">${edges.map((e) => `<span class="tale-edge">${e}</span>`).join("")}</div>` : ""}

      ${hook ? `<div class="tale-hook"><span class="tale-hook-label">${hook.label}</span>${hook.text}</div>` : ""}
    </div>`;
}
