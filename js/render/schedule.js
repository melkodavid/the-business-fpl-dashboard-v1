import { buildTaleOfTheTapeCard, loadLore } from "./taleOfTheTape.js";
import { buildRecapCard } from "./recapSection.js";
import { buildSeasonArcWidgets } from "./seasonArcWidgets.js";

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

// Ambient "pass network" behind the fixture cards -- one node per manager
// (12), faint connecting lines like a broadcaster's post-match pass-network
// graphic, with an occasional "completed pass" pulse. Purely decorative; not
// tied to any real pass data. Stops itself once its canvas leaves the DOM
// (the next route change replaces container.innerHTML), so re-visiting this
// page never stacks up multiple animation loops.
function initPassNetwork(canvas, heroEl) {
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const palette = ["#c9a660", "#9b5ce0", "#4fd6a0"];
  const NODE_COUNT = 12;
  let W, H, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let nodes = [];
  let pulse = null;
  let lastPulseAt = 0;
  let lastT = null;

  function resize() {
    W = heroEl.clientWidth;
    H = heroEl.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    nodes = Array.from({ length: NODE_COUNT }, (_, i) => ({
      x: 40 + Math.random() * (W - 80),
      y: 40 + Math.random() * (H - 80),
      vx: (Math.random() - 0.5) * 0.07,
      vy: (Math.random() - 0.5) * 0.07,
      r: 1.6 + Math.random() * 1.2,
      c: palette[i % palette.length],
    }));
  }

  function edges() {
    const list = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 190) list.push({ a, b, dist });
      }
    }
    return list;
  }

  function maybeStartPulse(now, list) {
    if (reduceMotion || pulse || !list.length) return;
    if (now - lastPulseAt < 2600) return;
    const e = list[Math.floor(Math.random() * list.length)];
    pulse = { a: e.a, b: e.b, t: 0, dur: 1100 + Math.random() * 500 };
    lastPulseAt = now;
  }

  function step(now) {
    if (!canvas.isConnected) return; // page navigated away; stop the loop
    if (lastT == null) lastT = now;
    const dt = now - lastT;
    lastT = now;
    ctx.clearRect(0, 0, W, H);

    if (!reduceMotion) {
      for (const n of nodes) {
        n.x += n.vx * dt * 0.06;
        n.y += n.vy * dt * 0.06;
        if (n.x < 20 || n.x > W - 20) n.vx *= -1;
        if (n.y < 20 || n.y > H - 20) n.vy *= -1;
      }
    }

    const list = edges();
    for (const e of list) {
      const alpha = 0.09 * (1 - e.dist / 190);
      ctx.strokeStyle = `rgba(236,217,163,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(e.a.x, e.a.y);
      ctx.lineTo(e.b.x, e.b.y);
      ctx.stroke();
    }

    maybeStartPulse(now, list);
    if (pulse) {
      pulse.t += dt;
      const f = Math.min(1, pulse.t / pulse.dur);
      const px = pulse.a.x + (pulse.b.x - pulse.a.x) * f;
      const py = pulse.a.y + (pulse.b.y - pulse.a.y) * f;
      ctx.strokeStyle = "rgba(0,255,133,0.35)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pulse.a.x, pulse.a.y);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.shadowColor = "#00ff85";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#00ff85";
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (f >= 1) pulse = null;
    }

    for (const n of nodes) {
      ctx.beginPath();
      ctx.shadowColor = n.c;
      ctx.shadowBlur = 6;
      ctx.fillStyle = n.c;
      ctx.globalAlpha = 0.8;
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    requestAnimationFrame(step);
  }

  resize();
  seed();
  requestAnimationFrame(step);
  window.addEventListener("resize", () => {
    if (!canvas.isConnected) return;
    resize();
    seed();
  });
}

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
        <canvas id="passNetwork"></canvas>
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
