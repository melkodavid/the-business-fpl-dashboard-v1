import { loadAllData, managerLookup } from "./data.js";
import { render as renderStandings } from "./render/standings.js";
import { render as renderAllPlay } from "./render/allPlay.js";
import { render as renderH2H } from "./render/h2hGrid.js";
import { render as renderAwards } from "./render/awards.js";
import { render as renderPositions } from "./render/positionalStrength.js";
import { render as renderScoring } from "./render/scoringType.js";
import { render as renderFiftyNine } from "./render/fiftyNineClub.js";
import { render as renderBench } from "./render/benchStats.js";
import { render as renderDraft } from "./render/draftGrades.js";
import { render as renderTrades } from "./render/tradeLedger.js";
import { render as renderWaivers } from "./render/waiverHitRate.js";
import { render as renderForm } from "./render/formGuide.js";
import { render as renderHistory } from "./render/history.js";
import { render as renderCup } from "./render/cup.js";

const ROUTES = {
  standings: renderStandings,
  "all-play": renderAllPlay,
  h2h: renderH2H,
  awards: renderAwards,
  positions: renderPositions,
  scoring: renderScoring,
  "fifty-nine": renderFiftyNine,
  bench: renderBench,
  draft: renderDraft,
  trades: renderTrades,
  waivers: renderWaivers,
  form: renderForm,
  history: renderHistory,
  cup: renderCup,
};
const DEFAULT_ROUTE = "standings";

const app = document.getElementById("app");
const nav = document.getElementById("site-nav");
const navToggle = document.getElementById("nav-toggle");

function currentRoute() {
  const hash = location.hash.replace("#", "");
  return ROUTES[hash] ? hash : DEFAULT_ROUTE;
}

function setActiveNav(route) {
  nav.querySelectorAll("a").forEach((a) => a.classList.toggle("active", a.dataset.route === route));
}

function main(data, managers) {
  function draw() {
    const route = currentRoute();
    setActiveNav(route);
    ROUTES[route](app, data, managers);
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }

  window.addEventListener("hashchange", draw);
  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  draw();
}

async function init() {
  try {
    const data = await loadAllData();
    const managers = managerLookup(data);

    if (data.meta?.lastUpdated) {
      const date = new Date(data.meta.lastUpdated);
      document.getElementById("last-updated").textContent =
        `Last updated ${date.toLocaleString()} · through GW${data.meta.finishedThroughGw ?? "?"}` +
        (data.meta.mock ? " · mock data" : "");
    }

    main(data, managers);
  } catch (err) {
    app.innerHTML = `<div class="card"><p>Couldn't load league data: ${err.message}</p></div>`;
    console.error(err);
  }
}

init();
