import { startConstellation } from "../lib/constellation.js";
import { renderLineupPitch } from "../lib/lineupPitch.js";
import { beltIconHtml, avatarHtml, personFor } from "../lib/cardRender.js";
import { buildCareerCards } from "../lib/cardTiers.js";
import { rarityFor } from "../lib/cardRarity.js";
import { escapeHtml } from "../format.js";
import { getIdentity, setIdentity } from "../identity.js";

const SELECT_ANIMATION_MS = 420;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cleanClub = (name) => (name ?? "").replace(/\s*\*+$/, "");

// ---- count-up numbers + reveal-on-scroll (with a fallback so nothing can stay hidden) ----
function countUp(el, ms = 1100) {
  const target = Number(el.dataset.v);
  if (reduced()) { el.textContent = target; return; }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = Math.round(target * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function revealOnScroll(root) {
  const items = [...root.querySelectorAll(".hm-rv")];
  const show = (el) => {
    if (el.classList.contains("in")) return;
    el.classList.add("in");
    el.querySelectorAll(".hm-cu").forEach((c) => setTimeout(() => countUp(c), 400));
  };
  if (reduced() || !("IntersectionObserver" in window)) { items.forEach(show); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { show(e.target); io.unobserve(e.target); }
  }, { threshold: 0.12 });
  items.forEach((el) => io.observe(el));
  // a hidden/background tab never fires observers -- don't leave tiles invisible
  setTimeout(() => items.forEach(show), 2500);
}

// ---- mouse-follow tilt + glare ----
function attachTilt(root) {
  if (reduced()) return;
  let active = null;
  const reset = (el) => {
    if (!el) return;
    ["--mx", "--my", "--rx", "--ry"].forEach((v) => el.style.removeProperty(v));
    el.classList.remove("tilting");
  };
  root.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const card = e.target.closest(".hm-tilt");
    if (card !== active) { reset(active); active = card; }
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.classList.add("tilting");
    card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    card.style.setProperty("--rx", `${((px - 0.5) * 12).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${(-(py - 0.5) * 12).toFixed(2)}deg`);
  });
  root.addEventListener("pointerleave", () => { reset(active); active = null; });
}

// A manager who hasn't joined the real league yet (see data/upcoming-managers.json) -- no
// stats, just a calm "first season coming up" tile so they still have something to click.
function rookieTileHtml(person, i) {
  return `
    <button type="button" class="hm-tile hm-tilt hm-rv hm-r-common" style="--i:${i}" data-manager-key="${person.personKey}">
      <div class="hm-tile-in">
        ${avatarHtml({ ...person, name: person.displayName })}
        <div class="hm-tile-txt">
          <h3>${escapeHtml(person.displayName)}</h3>
          <div class="hm-meta"><span class="hm-rar">Rookie</span> · First season coming up</div>
        </div>
        <span class="hm-play">Play as ${escapeHtml(person.displayName.split(" ")[0])} →</span>
      </div>
    </button>`;
}

function tileHtml(card, i, managers, me, isReigning) {
  const person = personFor(card.managerKey, card.displayName, managers);
  const rarity = rarityFor(card);
  const theme = person.theme;
  const first = person.name.split(" ")[0];
  return `
    <button type="button" class="hm-tile hm-tilt hm-rv hm-r-${rarity.id}${card.managerKey === me ? " is-you" : ""}" style="--i:${i}" data-manager-key="${card.managerKey}">
      ${rarity.id === "legendary" || rarity.id === "mythic" ? `<span class="hm-crown" aria-hidden="true">👑</span>` : ""}
      ${theme?.flag ? `<span class="hm-flag" aria-hidden="true">${theme.icon}</span>` : ""}
      <div class="hm-tile-in">
        ${avatarHtml(person)}
        <div class="hm-tile-txt">
          <h3>${escapeHtml(person.name)}${isReigning ? ` ${beltIconHtml(26)}` : ""}</h3>
          <div class="hm-meta"><span class="hm-rar">${rarity.label}</span> · ${card.seasons} season${card.seasons === 1 ? "" : "s"}${card.titles ? ` · <span class="hm-st">${"★".repeat(Math.min(card.titles, 8))}</span>` : ""}</div>
          <div class="hm-rec"><span class="hm-cu" data-v="${card.w}">0</span>-<span class="hm-cu" data-v="${card.d}">0</span>-<span class="hm-cu" data-v="${card.l}">0</span><small><span class="hm-cu" data-v="${Math.round(card.winPct)}">0</span>% win</small></div>
        </div>
        <span class="hm-play">${card.managerKey === me ? "Continue as you" : `Play as ${escapeHtml(first)}`} →</span>
      </div>
    </button>`;
}

function championHtml(card, managers) {
  const person = personFor(card.managerKey, card.displayName, managers);
  const sparks = Array.from({ length: 10 }, (_, i) => `<i class="hm-sp" style="left:${8 + ((i * 41) % 84)}%;top:${10 + ((i * 29) % 70)}%;animation-delay:${(i * 0.5).toFixed(1)}s"></i>`).join("");
  return `
    <div class="hm-champ hm-rv">
      ${sparks}
      <div class="hm-ring">${avatarHtml(person)}</div>
      <div class="hm-champ-txt">
        <small>Reigning champion</small>
        <h2>${escapeHtml(person.name)}</h2>
        <span>${"★".repeat(Math.min(card.titles, 8))} ${card.titles} Title${card.titles === 1 ? "" : "s"}</span>
      </div>
      <span class="hm-belt">${beltIconHtml(110)}</span>
    </div>`;
}

// ---------------------------------------------------------------- predicted lineups
function lineupSection(data, managers, me, champKey) {
  const lineups = data.schedule?.lineups;
  if (!lineups || !Object.keys(lineups).length) return null;
  const myId = managers.idForPersonKey(me) ?? managers.idForPersonKey(champKey);
  const ids = managers.all.filter((m) => lineups[m.id]).map((m) => m.id);
  const fixtures = data.schedule.fixtures ?? [];
  const meta = data.schedule.lineupsMeta;

  const html = `
    <section class="hm-lineups hm-rv" id="hm-lineups">
      <div class="hm-sec-head"><h3>Predicted XI</h3><i></i></div>
      <p class="hm-lead">Each team's best legal lineup for <b>Gameweek ${meta?.gw ?? data.schedule.gw}</b>, picked by the official FPL expected-points projections. Pick a team to line them up.</p>
      <div class="hm-chips" role="tablist" aria-label="Choose a team">
        ${ids.map((id) => {
          const m = managers.all.find((x) => x.id === id);
          return `<button type="button" role="tab" class="hm-chip" data-id="${id}" style="--c:${m.color ?? "#6a2fa8"}"><i></i>${escapeHtml(cleanClub(m.name))}</button>`;
        }).join("")}
      </div>
      <div class="hm-lp-head" id="hm-lp-head"></div>
      <div id="hm-lp-pitch"></div>
      <div class="hm-bench" id="hm-lp-bench"></div>
      <p class="hm-foot">${meta?.source ? `${escapeHtml(meta.source)}. ` : ""}Jersey numbers are expected points for the gameweek — a for-fun forecast, not a promise.</p>
    </section>`;

  function mount(root) {
    const head = root.querySelector("#hm-lp-head");
    const pitch = root.querySelector("#hm-lp-pitch");
    const bench = root.querySelector("#hm-lp-bench");
    let current = null;
    function show(id) {
      current = id;
      const m = managers.all.find((x) => x.id === id);
      const lu = lineups[id];
      root.querySelectorAll(".hm-chip").forEach((c) => c.setAttribute("aria-selected", String(Number(c.dataset.id) === id)));
      const fx = fixtures.find((f) => f.homeManagerId === id || f.awayManagerId === id);
      let vs = "";
      if (fx) {
        const home = fx.homeManagerId === id;
        const oppId = home ? fx.awayManagerId : fx.homeManagerId;
        const opp = managers.all.find((x) => x.id === oppId);
        const lu2 = lineups[oppId];
        const win = fx.odds ? (home ? fx.odds.homeWinPct : fx.odds.awayWinPct) : null;
        vs = `<a class="hm-vs" href="#schedule">${home ? "vs" : "@"} ${escapeHtml(cleanClub(opp?.name))}${lu2 ? ` <small>(${lu2.expected.toFixed(1)} predicted)</small>` : ""}${win != null ? ` · <b>${win}% to win</b>` : ""}</a>`;
      }
      head.innerHTML = `
        <div class="hm-lp-team">
          <h4>${escapeHtml(cleanClub(m.name))}</h4>
          <span>${escapeHtml(m.playerName ?? "")} · ${lu.formation}${lu.locked ? ` · <b class="hm-locked">Lineup locked in</b>` : ""}</span>
        </div>
        <div class="hm-lp-total"><b>${lu.expected.toFixed(1)}</b><small>predicted pts</small></div>
        ${vs}`;
      renderLineupPitch(pitch, lu, m.color ?? "#6a2fa8");
      bench.innerHTML = lu.bench.length
        ? `<span class="hm-bench-lab">Bench</span>${lu.bench.map((p) => `<span class="hm-bchip"><b>${p.ep.toFixed(1)}</b>${escapeHtml(p.name)}</span>`).join("")}`
        : "";
    }
    root.querySelector(".hm-chips").addEventListener("click", (e) => {
      const chip = e.target.closest(".hm-chip");
      if (chip && Number(chip.dataset.id) !== current) show(Number(chip.dataset.id));
    });
    show(ids.includes(myId) ? myId : ids[0]);
  }
  return { html, mount };
}

// ---------------------------------------------------------------- page
export function render(container, data, managers) {
  const me = getIdentity();

  // Only the 12 current managers are "who's viewing" choices -- buildCareerCards() also returns
  // departed managers from the all-time leaderboard. Already ordered titles, then avg rank, then win %.
  const careerCards = buildCareerCards(data.history).filter((c) => managers.all.some((m) => m.personKey === c.managerKey));
  const reigningKey = data.history?.reigningChampionKey ?? null;
  const champCard = careerCards.find((c) => c.managerKey === reigningKey) ?? null;
  const season = data.history?.seasons?.find((s) => s.isCurrent)?.year ?? "";

  // Real members with no completed season yet, and explicit upcoming managers, get the Rookie tile.
  const careerKeys = new Set(careerCards.map((c) => c.managerKey));
  const rookies = [
    ...managers.all.filter((m) => !careerKeys.has(m.personKey)).map((m) => ({
      personKey: m.personKey, displayName: m.playerName ?? m.name, color: m.color ?? "#5a6472", abbreviation: m.abbreviation ?? m.shortName ?? "???",
    })),
    ...(data.upcomingManagers?.upcoming ?? []),
  ];
  const tiles = [
    ...careerCards.map((c, i) => tileHtml(c, i, managers, me, c.managerKey === reigningKey)),
    ...rookies.map((p, i) => rookieTileHtml({ ...p, theme: managers.themeForPersonKey?.(p.personKey) ?? null }, careerCards.length + i)),
  ].join("");

  const lineups = lineupSection(data, managers, me, reigningKey);

  container.innerHTML = `
    <div class="hm">
      <canvas class="hm-net" aria-hidden="true"></canvas>
      <header class="hm-hero" id="hm-hero">
        <div class="hm-giant" aria-hidden="true">X</div>
        <p class="hm-eyebrow">Who's watching?</p>
        <h1 class="hm-title">The Business</h1>
        <p class="hm-est">Est. 2017${season ? ` · Season ${escapeHtml(String(season))}` : ""}</p>
        <div class="hm-rule"><i></i><b></b><i></i></div>
        <div class="hm-cue">Choose your manager</div>
      </header>
      ${champCard ? championHtml(champCard, managers) : ""}
      <section class="hm-roster" id="hm-roster">${tiles}</section>
      ${lineups ? lineups.html : ""}
    </div>`;

  const root = container.querySelector(".hm");
  startConstellation(root.querySelector(".hm-net"), { nodeCount: 18 });

  // the giant X drifts slightly against the pointer
  const giant = root.querySelector(".hm-giant");
  const onMove = (e) => {
    if (!giant.isConnected) { window.removeEventListener("pointermove", onMove); return; }
    giant.style.setProperty("--px", `${(e.clientX / window.innerWidth - 0.5) * -30}px`);
    giant.style.setProperty("--py", `${(e.clientY / window.innerHeight - 0.5) * -18}px`);
  };
  if (!reduced()) window.addEventListener("pointermove", onMove);

  revealOnScroll(root);
  attachTilt(root.querySelector("#hm-roster"));
  lineups?.mount(root.querySelector("#hm-lineups"));

  const roster = root.querySelector("#hm-roster");
  roster.addEventListener("click", (e) => {
    const btn = e.target.closest(".hm-tile");
    if (!btn) return;
    const key = btn.dataset.managerKey;
    function navigate() {
      // Order matters: location.hash updates synchronously (the hashchange *event* fires later),
      // so setting it first means setIdentity()'s synchronous dispatch re-renders straight into
      // the personalised page -- one clean render, no flash of the landing page.
      location.hash = "#my-season";
      setIdentity(key);
    }
    if (reduced()) { navigate(); return; }
    btn.classList.add("selecting");
    roster.querySelectorAll(".hm-tile").forEach((other) => { if (other !== btn) other.classList.add("dimmed"); });
    setTimeout(navigate, SELECT_ANIMATION_MS);
  });

  root.querySelector(".hm-cue")?.addEventListener("click", () => root.querySelector("#hm-roster")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" }));
}
