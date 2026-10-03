import { buildTrophy } from "../trophy.js";

const ROUND_LABELS = { round1: "Round 1", round2: "Quarterfinal", round3: "Semifinal", round4: "Final" };
const FUTURE_MATCH_COUNT = { round1: 4, round2: 4, round3: 2, round4: 1 };
const REDUCED = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clubName = (managers, id) => managers.name(id).replace(/\s*\*+$/, "");

// Club crest: the manager's custom badge if there is one (assets/badges/), else
// a disc in their colour with their abbreviation -- always ringed in cup gold.
function crestHtml(managerId, managers) {
  const m = managers.all.find((x) => x.id === managerId);
  if (!m) return `<span class="cup-crest"><b>?</b></span>`;
  const badge = m.badge ?? "";
  const isPath = /\.(png|jpe?g|svg|webp|gif)$/i.test(badge);
  const label = badge && !isPath ? badge : m.abbreviation;
  const src = isPath ? badge : `assets/badges/${m.personKey}.png`;
  return `<span class="cup-crest" style="--c:${m.color ?? "#3f9c78"}"><img src="${src}" alt="" loading="lazy" onerror="this.remove()"><b>${label}</b></span>`;
}
function nameHtml(managerId, managers) {
  return `${crestHtml(managerId, managers)}<span class="cup-name">${clubName(managers, managerId)}</span>`;
}

// `data-v` scores count up from 0 when their match scrolls into view.
function scoreHtml(value) {
  return `<span class="cup-score" ${Number.isFinite(value) ? `data-v="${value}"` : ""}>${Number.isFinite(value) ? 0 : value}</span>`;
}

function matchHtml(match, roundKey, isLive, managers, idx) {
  const aWin = match.winnerId === match.managerAId;
  const bWin = match.winnerId === match.managerBId;
  return `
    <div class="cup-bracket-match cup-rv${isLive ? " live" : ""}" style="--i:${idx}">
      ${isLive ? '<span class="cup-live-chip"><span class="dot"></span>Live</span>' : ""}
      <div class="cup-bracket-side${aWin ? " winner" : ""}" data-mgr="${match.managerAId}">
        ${nameHtml(match.managerAId, managers)}${scoreHtml(match.scoreA)}
      </div>
      <div class="cup-bracket-side${bWin ? " winner" : ""}" data-mgr="${match.managerBId}">
        ${nameHtml(match.managerBId, managers)}${scoreHtml(match.scoreB)}
      </div>
    </div>`;
}

function drawOnlyMatchHtml(pairing, managers, idx) {
  return `
    <div class="cup-bracket-match cup-rv" style="--i:${idx}">
      <div class="cup-bracket-side" data-mgr="${pairing.managerAId}">${nameHtml(pairing.managerAId, managers)}<span class="cup-score">–</span></div>
      <div class="cup-bracket-side" data-mgr="${pairing.managerBId}">${nameHtml(pairing.managerBId, managers)}<span class="cup-score">–</span></div>
    </div>`;
}

function futureMatchHtml(_, idx) {
  return `
    <div class="cup-bracket-match future cup-rv" style="--i:${idx}">
      <div class="cup-bracket-side tbd"><span class="cup-name">To be drawn</span><span class="cup-score">—</span></div>
      <div class="cup-bracket-side tbd"><span class="cup-name">To be drawn</span><span class="cup-score">—</span></div>
    </div>`;
}

function roundColumnHtml(key, round, managers, colIndex) {
  const isLive = Boolean(round.draw) && !round.results;
  const base = colIndex * 2;
  let matchesHtml;
  if (round.results) {
    matchesHtml = round.results.map((m, i) => matchHtml(m, key, false, managers, base + i)).join("");
  } else if (round.draw) {
    matchesHtml = round.draw.map((p, i) => drawOnlyMatchHtml(p, managers, base + i)).join("");
  } else {
    matchesHtml = Array.from({ length: FUTURE_MATCH_COUNT[key] }, (_, i) => futureMatchHtml(_, base + i)).join("");
  }

  const gwLabel = round.gws.length > 1 ? `GW${round.gws[0]}–${round.gws[1]}` : `GW${round.gws[0]}`;
  const championSlot =
    key === "round4"
      ? `<div class="cup-champion-slot"><span class="cup-label">Champion</span><span class="cup-champ-name${round.results ? " cup-champ-won" : " tbd"}">${round.results ? clubName(managers, round.results[0].winnerId) : "Not yet decided"}</span></div>`
      : "";

  return `
    <div class="cup-bracket-col">
      <div class="cup-bracket-col-head cup-rv" style="--i:${colIndex}">${ROUND_LABELS[key]}<span class="cup-bracket-col-sub">${gwLabel}</span></div>
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
        <div class="cup-plot cup-rv" style="--i:${i}">
          <div class="cup-tombstone">
            <span class="cup-rip">R.I.P.</span>
            ${crestHtml(e.managerId, managers)}
            <span class="cup-t-name">${clubName(managers, e.managerId)}</span>
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
      <div class="cup-fireflies" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--x:${(i * 83) % 100}%;--y:${20 + ((i * 37) % 60)}%;--d:${(i * 0.7).toFixed(1)}s"></i>`).join("")}</div>
      <div class="cup-graveyard-heading cup-rv">
        <p class="cup-graveyard-eyebrow">The Graveyard</p>
        <h2 class="cup-graveyard-title">Here lie the fallen</h2>
        <p class="cup-graveyard-dek">Every manager the Cup has claimed so far. Rest in pieces.</p>
      </div>
      <div class="cup-plots">${plotsHtml}</div>
      <div class="cup-fog"></div>
    </section>`;
}

// ---- rolling "Cup News" banner: results, draws, and what's coming ----
function newsItems(cup, managers) {
  if (cup.status === "pending") return [`<b>The Grassroots Cup</b> opens soon`, cup.reason];
  const items = [];
  if (cup.status === "complete") items.push(`<b>Champions</b> ${clubName(managers, cup.champion)} lift the Grassroots Cup`);
  for (const key of ["round4", "round3", "round2", "round1"]) {
    const round = cup.rounds[key];
    if (round.results) {
      for (const m of round.results) {
        const w = m.winnerId === m.managerAId ? [m.managerAId, m.scoreA, m.scoreB] : [m.managerBId, m.scoreB, m.scoreA];
        const l = m.winnerId === m.managerAId ? m.managerBId : m.managerAId;
        items.push(`<b>${ROUND_LABELS[key]}</b> ${clubName(managers, w[0])} beat ${clubName(managers, l)} ${w[1]}–${w[2]}`);
      }
    } else if (round.draw) {
      const gw = round.gws.length > 1 ? `GW${round.gws[0]}–${round.gws[1]}` : `GW${round.gws[0]}`;
      for (const p of round.draw) items.push(`<b>${ROUND_LABELS[key]} · ${gw}</b> ${clubName(managers, p.managerAId)} v ${clubName(managers, p.managerBId)}`);
    }
  }
  return items.length ? items : [`<b>${ROUND_LABELS.round1}</b> draw to be made`];
}

function newsHtml(items) {
  const doubled = [...items, ...items].map((t) => `<span>${t}</span>`).join("");
  return `<div class="cup-news"><div class="cup-news-lab">Cup News</div><div class="cup-news-viewport"><div class="cup-news-reel" style="--reel:${Math.max(36, Math.round(items.join("").length / 5))}s">${doubled}</div></div></div>`;
}

// ---- the trophy stage: rays, halo and sparkles around the 3D trophy ----
function stageHtml() {
  const sparks = Array.from({ length: 18 }, (_, i) => {
    const left = 12 + ((i * 53) % 76);
    const top = 8 + ((i * 29) % 78);
    const size = 3 + (i % 4) * 1.5;
    return `<i style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;animation-delay:${((i * 0.43) % 3.2).toFixed(2)}s"></i>`;
  }).join("");
  return `
    <div class="cup-stage">
      <div class="cup-rays"></div>
      <div class="cup-sparkles" aria-hidden="true">${sparks}</div>
      <div class="cup-trophy-scene"></div>
    </div>`;
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

// Gold-and-emerald confetti, thrown from the top of `host`.
function burstConfetti(host) {
  if (REDUCED()) return;
  const colours = ["#d4af37", "#f5e1a4", "#3f9c78", "#bfe3d2", "#ffffff"];
  const layer = document.createElement("div");
  layer.className = "cup-confetti";
  for (let i = 0; i < 70; i++) {
    const p = document.createElement("i");
    p.style.cssText = `left:${Math.random() * 100}%;background:${colours[i % colours.length]};animation-delay:${(Math.random() * 0.9).toFixed(2)}s;animation-duration:${(2.6 + Math.random() * 1.8).toFixed(2)}s;--drift:${(Math.random() * 160 - 80).toFixed(0)}px;--spin:${(Math.random() * 900 - 450).toFixed(0)}deg;width:${6 + Math.random() * 6}px;height:${9 + Math.random() * 8}px`;
    layer.appendChild(p);
  }
  host.appendChild(layer);
  setTimeout(() => layer.remove(), 5200);
}

// Reveal blocks as they scroll into view (staggered by --i), count scores up,
// and throw confetti the first time the champion banner is seen.
function choreograph(root) {
  const reduce = REDUCED();
  const countUp = (el) => {
    const target = Number(el.dataset.v);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1000);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("cup-in");
      e.target.querySelectorAll(".cup-score[data-v]").forEach((el) => (reduce ? (el.textContent = el.dataset.v) : setTimeout(() => countUp(el), 350)));
      if (e.target.classList.contains("cup-champion-banner")) burstConfetti(root);
      io.unobserve(e.target);
    }
  }, { threshold: 0.15 });
  root.querySelectorAll(".cup-rv, .cup-champion-banner, .cup-pending").forEach((el) => io.observe(el));
}

// Replays the *real* Round 1 draw pairings as a ball-drum ceremony -- the
// order balls get "drawn" is dramatized, but every pairing shown is exactly
// what actually happened, not a freshly randomized one.
function setupDrawCeremony(root, round1Draw, managers) {
  const overlay = root.querySelector(".cup-draw-overlay");
  const drum = root.querySelector(".cup-drum");
  const status = root.querySelector(".cup-draw-status");
  const log = root.querySelector(".cup-draw-log");
  const reducedMotion = REDUCED();

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
      ball.textContent = clubName(managers, managerId);
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
          row.innerHTML = `<span class="cup-result-pill">${clubName(managers, picked[0])}</span><span class="cup-vs">vs</span><span class="cup-result-pill">${clubName(managers, picked[1])}</span>`;
          log.appendChild(row);
          picked.forEach((id) => {
            const b = drum.querySelector(`[data-key="${id}"]`);
            setTimeout(() => b.classList.add("gone"), 450);
          });
          picked = [];
          matchNum++;
        }
        if (remaining.length > 0) drawNext(remaining, matchNum, picked);
        else setTimeout(() => {
          status.textContent = "That's the real Round 1 draw.";
          burstConfetti(overlay.querySelector(".cup-draw-panel"));
        }, 400);
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
  const banner = newsHtml(newsItems(cup, managers));
  const aurora = `<div class="cup-aurora"><i></i><i></i><i></i></div>`;

  if (cup.status === "pending") {
    container.innerHTML = `
      <div class="cup-theme">
        ${aurora}${banner}
        <div class="cup-hero">
          <p class="cup-eyebrow">The Grassroots Cup</p>
          <h1 class="cup-title">The draw hasn't happened yet.</h1>
        </div>
        ${stageHtml()}
        <div class="cup-plinth">THE GRASSROOTS CUP</div>
        <p class="cup-pending cup-rv">${cup.reason}</p>
      </div>`;
    buildTrophy(container.querySelector(".cup-trophy-scene"));
    choreograph(container.querySelector(".cup-theme"));
    return;
  }

  const championBanner =
    cup.status === "complete"
      ? `<div class="cup-champion-banner">\u{1F3C6} Champion: ${clubName(managers, cup.champion)}</div>`
      : "";

  const bracketHtml = ["round1", "round2", "round3", "round4"]
    .map((key, i) => roundColumnHtml(key, cup.rounds[key], managers, i))
    .join("");

  const seedsHtml = cup.seeds
    .map((s, i) => `<tr class="cup-rv" style="--i:${i}"><td>${s.seed}</td><td class="text-left">${nameHtml(s.managerId, managers)}</td></tr>`)
    .join("");

  const hasRound1Draw = Boolean(cup.rounds.round1.draw);

  container.innerHTML = `
    <div class="cup-theme">
      ${aurora}${banner}
      <div class="cup-hero">
        <h1 class="cup-title cup-title-only">The Grassroots Cup</h1>
      </div>
      ${championBanner}

      ${stageHtml()}
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
        <table class="cup-seeds" style="max-width:420px;margin:0 auto;">
          <thead><tr><th>Seed</th><th class="text-left">Club</th></tr></thead>
          <tbody>${seedsHtml}</tbody>
        </table>
      </div>

      ${renderGraveyard(cup, managers)}
    </div>
  `;

  const root = container.querySelector(".cup-theme");
  buildTrophy(root.querySelector(".cup-trophy-scene"));
  setupHoverHighlight(root);
  if (hasRound1Draw) setupDrawCeremony(root, cup.rounds.round1.draw, managers);
  choreograph(root);
}
