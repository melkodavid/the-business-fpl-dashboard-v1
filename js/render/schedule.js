import { buildTaleOfTheTapeCard, loadLore } from "./taleOfTheTape.js";
import { buildRecapCard } from "./recapSection.js";
import { buildSeasonArcWidgets } from "./seasonArcWidgets.js";
import { initPassNetwork } from "../lib/passNetwork.js";

function statusInfo(fixture) {
  if (fixture.finished) return { label: "FT", cls: "status-ft" };
  if (fixture.started) return { label: "LIVE", cls: "status-live" };
  return { label: "Not Started", cls: "status-scheduled" };
}

function fixtureCard(f, managers) {
  const status = statusInfo(f);
  const homeColor = managers.color(f.homeManagerId) ?? "#5a6472";
  const awayColor = managers.color(f.awayManagerId) ?? "#5a6472";

  return `
    <div class="fixture-card">
      <div class="fixture-tag">${f.tag}</div>
      <div class="fixture-body">
        <div class="fixture-side">
          <span class="fixture-name">${managers.nameHtml(f.homeManagerId)}</span>
          <span class="fixture-rank">#${f.homeRank}</span>
          <span class="fixture-abbr" style="background:${homeColor}">${managers.abbreviation(f.homeManagerId)}</span>
          ${managers.avatarHtml(f.homeManagerId)}
        </div>
        <div class="fixture-score">
          <span class="${f.finished || f.started ? "" : "score-pending"}">${f.started || f.finished ? f.homePoints : "–"}</span>
          <span class="fixture-score-sep">:</span>
          <span class="${f.finished || f.started ? "" : "score-pending"}">${f.started || f.finished ? f.awayPoints : "–"}</span>
        </div>
        <div class="fixture-side away">
          <span class="fixture-name">${managers.nameHtml(f.awayManagerId)}</span>
          <span class="fixture-rank">#${f.awayRank}</span>
          <span class="fixture-abbr" style="background:${awayColor}">${managers.abbreviation(f.awayManagerId)}</span>
          ${managers.avatarHtml(f.awayManagerId)}
        </div>
      </div>
      <div class="fixture-status ${status.cls}">${status.label}</div>
    </div>`;
}

const PITCH_LINES_SVG = `
  <svg viewBox="0 0 800 500" preserveAspectRatio="none">
    <rect x="30" y="30" width="740" height="440" fill="none" stroke="#ecd9a3" stroke-width="1.5" />
    <line x1="400" y1="30" x2="400" y2="470" stroke="#ecd9a3" stroke-width="1.5" />
    <circle cx="400" cy="250" r="70" fill="none" stroke="#ecd9a3" stroke-width="1.5" />
    <circle cx="400" cy="250" r="3" fill="#ecd9a3" />
    <path d="M30 30 A20 20 0 0 1 50 50" fill="none" stroke="#ecd9a3" stroke-width="1.5" />
    <path d="M770 30 A20 20 0 0 0 750 50" fill="none" stroke="#ecd9a3" stroke-width="1.5" />
    <path d="M30 470 A20 20 0 0 0 50 450" fill="none" stroke="#ecd9a3" stroke-width="1.5" />
    <path d="M770 470 A20 20 0 0 1 750 450" fill="none" stroke="#ecd9a3" stroke-width="1.5" />
  </svg>`;

export function render(container, data, managers) {
  const { gw, seasonComplete, fixtures } = data.schedule;

  const kicker = seasonComplete ? "Final Day Recap" : "Ranked by Stakes";
  const heroSub = seasonComplete
    ? `The season's played out — here's how the final gameweek (GW${gw}) landed. Check back once next season's fixtures are live.`
    : `Gameweek ${gw}'s fixtures, ranked by matchup importance — title six-pointers and bottom-of-the-table battles float to the top.`;

  // Tale of the Tape enrichment (rivalry history, form, luck, positional edge,
  // lore hooks) only makes sense for a genuinely upcoming gameweek -- once the
  // season's over there's no "stakes" left to preview, so the final day just
  // gets the plain result cards.
  const lore = loadLore(data.lore);
  const cardsHtml = seasonComplete
    ? fixtures.map((f) => fixtureCard(f, managers)).join("")
    : fixtures.map((f) => buildTaleOfTheTapeCard(f, data, managers, lore)).join("");

  const recapHtml = buildRecapCard(data.latestRecap, { large: true });
  const arcWidgetsHtml = buildSeasonArcWidgets(data.seasonArcs, managers);

  container.innerHTML = `
    <div class="schedule-luxury">
      <div class="hero-block">
        <div class="giant-mark" aria-hidden="true">X</div>
        <div class="hero-content">
          <span class="eyebrow">Season 25/26 · Final Standings</span>
          <span class="title-line-2">The Business</span>
          <span class="est-line">Est. 2017 · Tenth Anniversary Season</span>
          <div class="hero-rule"><span></span><span class="dot"></span><span></span></div>
          <p class="hero-sub">${heroSub}</p>
        </div>
      </div>

      ${recapHtml ? `<div class="recap-section">${recapHtml}<a class="recap-archive-link" href="#recaps">Full Season Story archive &rarr;</a></div>` : ""}

      ${arcWidgetsHtml}

      <div class="pitch-hero" id="pitchHero">
        <div class="pitch-lines">${PITCH_LINES_SVG}</div>
        <div class="floodlight fl-1"></div>
        <div class="floodlight fl-2"></div>
        <div class="floodlight fl-3"></div>
        <canvas id="passNetwork" class="sl-pass-canvas"></canvas>
        <div class="fixtures-title">
          <span class="kicker">${kicker}</span>
          <h2>${seasonComplete ? "Final Day Recap" : "This Week's Fixtures"}</h2>
        </div>
        <div class="fixture-list">
          ${cardsHtml || '<p class="empty-state">No fixtures to show.</p>'}
        </div>
      </div>
    </div>
  `;

  const canvas = container.querySelector("#passNetwork");
  const hero = container.querySelector("#pitchHero");
  if (canvas && hero) initPassNetwork(canvas, hero);
}
