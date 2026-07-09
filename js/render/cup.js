import { buildTrophy } from "../trophy.js";

const ROUND_LABELS = { round1: "Round 1", round2: "Quarterfinal", round3: "Semifinal", round4: "Final" };
const FUTURE_MATCH_COUNT = { round1: 4, round2: 4, round3: 2, round4: 1 };
const TINTS = ["#d4af37", "#3f9c78", "#bfe3d2"];

function initials(name) {
  const words = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
  const picked = words.slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  return picked || name.slice(0, 2).toUpperCase();
}
function tintFor(managerId) {
  return TINTS[managerId % TINTS.length];
}
function avatarHtml(managerId, managers) {
  return `<span class="cup-avatar" style="background:${tintFor(managerId)}">${initials(managers.name(managerId))}</span>`;
}
function nameHtml(managerId, managers) {
  return `${avatarHtml(managerId, managers)}<span class="cup-name">${managers.name(managerId)}</span>`;
}

function matchHtml(match, roundKey, isLive, managers) {
  const aWin = match.winnerId === match.managerAId;
  const bWin = match.winnerId === match.managerBId;
  return `
    <div class="cup-bracket-match${isLive ? " live" : ""}">
      ${isLive ? '<span class="cup-live-chip"><span class="dot"></span>Live</span>' : ""}
      <div class="cup-bracket-side${aWin ? " winner" : ""}" data-mgr="${match.managerAId}">
        ${nameHtml(match.managerAId, managers)}<span class="cup-score">${match.scoreA}</span>
      </div>
      <div class="cup-bracket-side${bWin ? " winner" : ""}" data-mgr="${match.managerBId}">
        ${nameHtml(match.managerBId, managers)}<span class="cup-score">${match.scoreB}</span>
      </div>
    </div>`;
}

function drawOnlyMatchHtml(pairing, managers) {
  return `
    <div class="cup-bracket-match">
      <div class="cup-bracket-side" data-mgr="${pairing.managerAId}">${nameHtml(pairing.managerAId, managers)}<span class="cup-score">–</span></div>
      <div class="cup-bracket-side" data-mgr="${pairing.managerBId}">${nameHtml(pairing.managerBId, managers)}<span class="cup-score">–</span></div>
    </div>`;
}

function futureMatchHtml() {
  return `
    <div class="cup-bracket-match future">
      <div class="cup-bracket-side tbd"><span class="cup-name">To be drawn</span><span class="cup-score">—</span></div>
      <div class="cup-bracket-side tbd"><span class="cup-name">To be drawn</span><span class="cup-score">—</span></div>
    </div>`;
}

function roundColumnHtml(key, round, managers) {
  const isLive = Boolean(round.draw) && !round.results;
  let matchesHtml;
  if (round.results) {
    matchesHtml = round.results.map((m) => matchHtml(m, key, false, managers)).join("");
  } else if (round.draw) {
    matchesHtml = round.draw.map((p) => drawOnlyMatchHtml(p, managers)).join("");
  } else {
    matchesHtml = Array.from({ length: FUTURE_MATCH_COUNT[key] }, futureMatchHtml).join("");
  }

  const gwLabel = round.gws.length > 1 ? `GW${round.gws[0]}–${round.gws[1]}` : `GW${round.gws[0]}`;
  const championSlot =
    key === "round4"
      ? `<div class="cup-champion-slot"><span class="cup-label">Champion</span><span class="cup-champ-name${round.results ? "" : " tbd"}">${round.results ? managers.name(round.results[0].winnerId) : "Not yet decided"}</span></div>`
      : "";

  return `
    <div class="cup-bracket-col">
      <div class="cup-bracket-col-head">${ROUND_LABELS[key]}<span class="cup-bracket-col-sub">${gwLabel}</span></div>
      <div class="cup-bracket-matches">${matchesHtml}</div>
      ${championSlot}
    </div>`;
}

// Eliminated managers across every decided round, in the order they fell,
// for the graveyard -- includes the runner-up (everyone but the champion).
function computeEliminations(cup) {
  const out = [];
  for (const key of ["round1", "round2", "round3", "round4"]) {
    const round = cup.rounds[key];
    if (!round.results) continue;
    for (const m of round.results) {
      const loserId = m.winnerId === m.managerAId ? m.managerBId : m.managerAId;
      out.push({ managerId: loserId, roundLabel: ROUND_LABELS[key] });
    }
  }
  return out;
}

const EPITAPHS = [
  "Gone but not forgotten. Mostly forgotten.",
  "Their bench outscored their starters. Every week.",
  "Set the lineup on autopilot once too often.",
  "Undone by a 59th-minute substitution.",
  "Never recovered from that one blank gameweek.",
  "Traded away their best player for a hunch.",
  "Believed in the process. The process did not believe back.",
  "Died as they lived: two points off a playoff spot.",
];

function renderGraveyard(cup, managers) {
  const eliminated = computeEliminations(cup);
  const plotsHtml = eliminated.length
    ? eliminated
        .map(
          (e, i) => `
        <div class="cup-plot">
          <div class="cup-tombstone">
            <span class="cup-rip">R.I.P.</span>
            ${avatarHtml(e.managerId, managers)}
            <span class="cup-t-name">${managers.name(e.managerId)}</span>
            <span class="cup-epitaph">Eliminated — ${e.roundLabel}<br />${EPITAPHS[i % EPITAPHS.length]}</span>
          </div>
          <div class="cup-plot-ground"></div>
        </div>`
        )
        .join("")
    : '<p class="cup-empty-graveyard">No eliminations yet — check back after Round 1.</p>';

  return `
    <section class="cup-graveyard">
      <div class="cup-moon"></div>
      <div class="cup-graveyard-heading">
        <p class="cup-graveyard-eyebrow">The Graveyard</p>
        <h2 class="cup-graveyard-title">Here lie the fallen</h2>
        <p class="cup-graveyard-dek">Every manager the Cup has claimed so far. Rest in pieces.</p>
      </div>
      <div class="cup-plots">${plotsHtml}</div>
      <div class="cup-fog"></div>
    </section>`;
}

function setupHoverHighlight(root) {
  root.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-mgr]");
    if (!el) return;
    root.querySelectorAll(`[data-mgr="${el.dataset.mgr}"]`).forEach((n) => n.classList.add("path-highlight"));
  });
  root.addEventListener("mouseout", (e) => {
    const el = e.target.closest("[data-mgr]");
    if (!el) return;
    root.querySelectorAll(`[data-mgr="${el.dataset.mgr}"]`).forEach((n) => n.classList.remove("path-highlight"));
  });
}

// Replays the *real* Round 1 draw pairings as a ball-drum ceremony -- the
// order balls get "drawn" is dramatized, but every pairing shown is exactly
// what actually happened, not a freshly randomized one.
function setupDrawCeremony(root, round1Draw, managers) {
  const overlay = root.querySelector(".cup-draw-overlay");
  const drum = root.querySelector(".cup-drum");
  const status = root.querySelector(".cup-draw-status");
  const log = root.querySelector(".cup-draw-log");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function placeBallsRandomly() {
    drum.querySelectorAll(".cup-ball").forEach((b) => {
      const r = 65;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * r;
      b.style.left = `${100 + Math.cos(angle) * dist - 27}px`;
      b.style.top = `${100 + Math.sin(angle) * dist - 27}px`;
      b.style.animationDelay = `${Math.random() * 2}s`;
    });
  }

  function openDraw() {
    overlay.dataset.open = "true";
    drum.innerHTML = "";
    log.innerHTML = "";
    status.textContent = "Eight seeds in the drum. Four matches to make.";

    const order = round1Draw.flatMap((p) => [p.managerAId, p.managerBId]);
    order.forEach((managerId) => {
      const ball = document.createElement("div");
      ball.className = "cup-ball";
      ball.dataset.key = managerId;
      ball.textContent = managers.name(managerId);
      drum.appendChild(ball);
    });
    placeBallsRandomly();

    const wait = reducedMotion ? 450 : 1200;
    function drawNext(remaining, matchNum, picked) {
      if (remaining.length === 0) return;
      setTimeout(() => {
        const managerId = remaining.shift();
        const ball = drum.querySelector(`[data-key="${managerId}"]`);
        ball.classList.add("drawn");
        ball.style.left = "50%";
        ball.style.top = "10px";
        ball.style.transform = "translateX(-50%)";
        status.textContent = `Drawing match ${matchNum}…`;
        picked.push(managerId);

        if (picked.length === 2) {
          const row = document.createElement("div");
          row.className = "cup-draw-result";
          row.innerHTML = `<span class="cup-result-pill">${managers.name(picked[0])}</span><span class="cup-vs">vs</span><span class="cup-result-pill">${managers.name(picked[1])}</span>`;
          log.appendChild(row);
          picked.forEach((id) => {
            const b = drum.querySelector(`[data-key="${id}"]`);
            setTimeout(() => b.classList.add("gone"), 450);
          });
          picked = [];
          matchNum++;
        }
        if (remaining.length > 0) drawNext(remaining, matchNum, picked);
        else setTimeout(() => { status.textContent = "That's the real Round 1 draw."; }, 400);
      }, wait + Math.random() * 350);
    }
    drawNext(order.slice(), 1, []);
  }

  root.querySelector(".cup-draw-cta")?.addEventListener("click", openDraw);
  root.querySelector(".cup-draw-close").addEventListener("click", () => { overlay.dataset.open = "false"; });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.dataset.open = "false"; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") overlay.dataset.open = "false"; });
}

export function render(container, data, managers) {
  const cup = data.cup;

  if (cup.status === "pending") {
    container.innerHTML = `
      <div class="cup-theme">
        <div class="cup-hero">
          <p class="cup-eyebrow">The Grassroots Cup</p>
          <h1 class="cup-title">The draw hasn't happened yet.</h1>
        </div>
        <p class="cup-pending">${cup.reason}</p>
      </div>`;
    return;
  }

  const championBanner =
    cup.status === "complete"
      ? `<div class="cup-champion-banner">\u{1F3C6} Champion: ${managers.name(cup.champion)}</div>`
      : "";

  const bracketHtml = ["round1", "round2", "round3", "round4"]
    .map((key) => roundColumnHtml(key, cup.rounds[key], managers))
    .join("");

  const seedsHtml = cup.seeds
    .map((s) => `<tr><td>${s.seed}</td><td class="text-left">${nameHtml(s.managerId, managers)}</td></tr>`)
    .join("");

  const hasRound1Draw = Boolean(cup.rounds.round1.draw);

  container.innerHTML = `
    <div class="cup-theme">
      <div class="cup-hero">
        <h1 class="cup-title cup-title-only">The Grassroots Cup</h1>
      </div>
      ${championBanner}

      <div class="cup-trophy-scene"></div>
      <div class="cup-trophy-shadow"></div>
      <div class="cup-plinth">THE GRASSROOTS CUP</div>

      <div class="cup-bracket-wrap"><div class="cup-bracket">${bracketHtml}</div></div>

      ${hasRound1Draw ? `
        <button class="cup-draw-cta" type="button">Watch the Round 1 Draw</button>
        <p class="cup-draw-hint">A replay of the actual Round 1 draw — the pairings are real, revealed one at a time for the ceremony.</p>
      ` : ""}

      <div class="cup-draw-overlay" role="dialog" aria-modal="true" aria-label="Round 1 draw">
        <div class="cup-draw-panel">
          <button class="cup-draw-close" type="button" aria-label="Close draw">✕</button>
          <p class="cup-draw-title">Round 1 Draw</p>
          <p class="cup-draw-status">Eight seeds in the drum. Four matches to make.</p>
          <div class="cup-drum"></div>
          <div class="cup-draw-log"></div>
        </div>
      </div>

      <div class="cup-bracket-wrap" style="margin-top:1.5rem;">
        <table style="max-width:420px;margin:0 auto;">
          <thead><tr><th>Seed</th><th class="text-left">Manager</th></tr></thead>
          <tbody>${seedsHtml}</tbody>
        </table>
      </div>

      ${renderGraveyard(cup, managers)}

      <p class="cup-footnote"><strong>On this page:</strong> the trophy is genuine CSS 3D geometry, not a flat image. Avatars are placeholder initials, ready to swap for real manager photos.</p>
    </div>
  `;

  buildTrophy(container.querySelector(".cup-trophy-scene"));
  setupHoverHighlight(container.querySelector(".cup-theme"));
  if (hasRound1Draw) setupDrawCeremony(container.querySelector(".cup-theme"), cup.rounds.round1.draw, managers);
}
