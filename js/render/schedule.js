// "This Week" -- the Matchday page. A rolling news banner, a big matchday
// header with a lineup-lock countdown, a featured match, and a strip for every
// other fixture that opens into a full match-centre panel. Styles live in
// css/style.css under .matchday (every class is md-prefixed).
import { taleDetails, loadLore } from "./taleOfTheTape.js";
import { buildSeasonArcWidgets } from "./seasonArcWidgets.js";

// The countdown ticks on a timer; make sure a previous visit's timer never
// outlives its page.
let clockTimer = null;

const pad = (n) => String(n).padStart(2, "0");
const signed = (n) => (n > 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
const cleanClub = (name) => (name ?? "").replace(/\s*\*+$/, "");

function countdown(iso) {
  const ms = iso ? new Date(iso) - Date.now() : 0;
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, over: true };
  return { d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60, over: false };
}

// Club crest: a custom badge if one exists (see assets/badges/README.md),
// otherwise a coloured disc with the manager's abbreviation.
function crest(m, size = "") {
  const badge = m.badge ?? "";
  const isPath = /\.(png|jpe?g|svg|webp|gif)$/i.test(badge);
  const label = badge && !isPath ? badge : m.abbreviation;
  const src = isPath ? badge : `assets/badges/${m.personKey}.png`;
  return `<span class="md-crest ${size}" style="--c:${m.color ?? "#6a2be0"}"><img src="${src}" alt="" loading="lazy" onerror="this.remove()"><b>${label}</b></span>`;
}

function formDots(results) {
  return results.map((r) => `<i class="md-f md-f-${r.result}" title="GW${r.gw}: ${r.result} (${r.points} pts)">${r.result}</i>`).join("");
}

// Win/draw/win odds. Numbers start at 0 and count up once the card scrolls
// into view (see choreograph()); bar widths grow via CSS from --w.
function oddsHtml(f, meta) {
  const o = f.odds;
  const live = meta?.basis === "live";
  return `
    <div class="md-odds ${o.homeWinPct >= o.awayWinPct ? "md-lead-home" : "md-lead-away"}">
      <div class="md-nums"><span class="md-home"><span class="md-cu" data-v="${o.homeWinPct}">0</span>%</span><span class="md-d"><span class="md-cu" data-v="${o.drawPct}">0</span>% draw</span><span class="md-away"><span class="md-cu" data-v="${o.awayWinPct}">0</span>%</span></div>
      <div class="md-track"><i class="md-h" style="--w:${o.homeWinPct}%"></i><i class="md-dr" style="--w:${o.drawPct}%"></i><i class="md-a" style="--w:${o.awayWinPct}%"></i></div>
      <small>${live ? "Live win odds" : "Win odds"} · projected ${o.homeExpected}–${o.awayExpected}</small>
    </div>`;
}

// Live or full-time: the score takes the middle, odds step aside (live keeps a one-line odds note).
function scoreHtml(f, meta) {
  const label = f.finished ? "Full time" : "Live";
  const note = !f.finished && f.odds ? `<small>${f.odds.homeWinPct}% · ${f.odds.drawPct}% · ${f.odds.awayWinPct}% · live odds</small>` : "";
  return `
    <div class="md-score">
      <span class="md-status ${f.finished ? "md-ft" : "md-live"}">${label}</span>
      <div class="md-scoreline"><b>${f.homePoints}</b><i>–</i><b>${f.awayPoints}</b></div>
      ${note}
    </div>`;
}

const centerHtml = (f, meta) => (f.started || f.finished ? scoreHtml(f, meta) : f.odds ? oddsHtml(f, meta) : `<div class="md-odds"><small>Win odds not available</small></div>`);

const better = (a, b, higherIsBetter = true) => (a == null || b == null || a === b ? "" : (higherIsBetter ? a > b : a < b) ? "md-lead" : "");

function sideInfo(m, st, rank) {
  return `#${rank ?? st?.rank ?? "–"} · ${st?.total ?? 0} pts · ${st ? `${st.won}-${st.drawn}-${st.lost}` : ""}`;
}

export function render(container, data, managers) {
  if (clockTimer) clearInterval(clockTimer);

  const { gw, seasonComplete, fixtures, deadline, oddsMeta } = data.schedule;
  const notStarted = gw === null;
  const lore = loadLore(data.lore);
  const mById = new Map(managers.all.map((m) => [m.id, m]));
  const stById = new Map(data.standings.rows.map((r) => [r.managerId, r]));
  const currentYear = data.history?.seasons?.find((s) => s.isCurrent)?.year ?? "";

  const rows = fixtures.map((f) => ({
    f,
    home: mById.get(f.homeManagerId),
    away: mById.get(f.awayManagerId),
    homeSt: stById.get(f.homeManagerId),
    awaySt: stById.get(f.awayManagerId),
    tale: taleDetails(f, data, managers, lore),
  }));

  // ---- rolling news banner: latest recap lines + a teaser per fixture ----
  const recap = data.latestRecap;
  const teasers = rows.map(({ f, home, away }) =>
    f.odds && !f.finished ? `<b>${f.tag || "Fixture"}</b> ${cleanClub(home.name)} v ${cleanClub(away.name)} — ${f.odds.homeWinPct}% / ${f.odds.awayWinPct}%` : null
  ).filter(Boolean);
  const recapLines = recap ? [recap.headline?.text, ...(recap.secondaries ?? []).map((s) => s.text)].filter(Boolean) : [];
  const newsItems = [...(notStarted ? [] : [`<b>Matchday ${pad(gw)}</b> ${seasonComplete ? "final day" : "is here"}`]), ...teasers, ...recapLines];
  const newsHtml = newsItems.length
    ? `<div class="md-news"><div class="md-lab">Business News</div><div class="md-viewport"><div class="md-reel" style="--reel:${Math.max(40, Math.round(newsItems.join("").length / 5))}s">${[...newsItems, ...newsItems].map((t) => `<span>${t}</span>`).join("")}</div></div></div>`
    : "";

  // ---- featured match (top of the stakes ranking) + strips ----
  const [top, ...rest] = rows;

  const featureHtml = top ? `
    <div class="md-feature">
      <span class="md-ribbon">${top.f.tag || "Match of the week"}</span>
      <div class="md-feature-grid">
        <div class="md-fside">${crest(top.home, "md-xl")}<h3>${cleanClub(top.home.name)}${managers.starsHtml(top.home.id)}</h3><p>${top.home.playerName}</p><div class="md-meta">${sideInfo(top.home, top.homeSt, top.f.homeRank)}</div><div>${formDots(top.tale.homeForm)}</div></div>
        ${centerHtml(top.f, oddsMeta)}
        <div class="md-fside">${crest(top.away, "md-xl")}<h3>${cleanClub(top.away.name)}${managers.starsHtml(top.away.id)}</h3><p>${top.away.playerName}</p><div class="md-meta">${sideInfo(top.away, top.awaySt, top.f.awayRank)}</div><div>${formDots(top.tale.awayForm)}</div></div>
      </div>
      <div class="md-cmp">
        <div><span class="${better(top.tale.homeFormAvg, top.tale.awayFormAvg)}">${top.tale.homeFormAvg ?? "–"}</span><em>Avg score</em><span class="${better(top.tale.awayFormAvg, top.tale.homeFormAvg)}">${top.tale.awayFormAvg ?? "–"}</span></div>
        <div><span class="${better(top.homeSt?.pointsFor, top.awaySt?.pointsFor)}">${top.homeSt?.pointsFor ?? "–"}</span><em>Points for</em><span class="${better(top.awaySt?.pointsFor, top.homeSt?.pointsFor)}">${top.awaySt?.pointsFor ?? "–"}</span></div>
        <div><span>${signed(top.tale.homeLuck)}</span><em>Luck</em><span>${signed(top.tale.awayLuck)}</span></div>
        ${top.f.odds ? `<div><span class="${better(top.f.odds.homeExpected, top.f.odds.awayExpected)}">${top.f.odds.homeExpected}</span><em>Projected XI</em><span class="${better(top.f.odds.awayExpected, top.f.odds.homeExpected)}">${top.f.odds.awayExpected}</span></div>` : ""}
      </div>
      ${extraNotes(top.tale)}
    </div>` : "";

  const stripHtml = (r, i) => `
    <article class="md-strip" style="--i:${i}">
      ${r.f.tag ? `<span class="md-tag">${r.f.tag}</span>` : ""}
      <div class="md-row">
        <div class="md-team">${crest(r.home, "md-lg")}<div><h4>${cleanClub(r.home.name)}${managers.starsHtml(r.home.id)}</h4><p><span class="md-rk">#${r.f.homeRank}</span> · ${r.home.playerName}</p>${formDots(r.tale.homeForm)}</div></div>
        ${centerHtml(r.f, oddsMeta)}
        <div class="md-team md-r">${crest(r.away, "md-lg")}<div><h4>${cleanClub(r.away.name)}${managers.starsHtml(r.away.id)}</h4><p><span class="md-rk">#${r.f.awayRank}</span> · ${r.away.playerName}</p>${formDots(r.tale.awayForm)}</div></div>
      </div>
      <div class="md-detail">
        <div class="md-box"><small>Head to head this season</small><b>${r.tale.rivalryLine}</b>${r.tale.lastMeetingLine ? `<span class="md-dim">Last time: ${r.tale.lastMeetingLine}</span>` : ""}</div>
        <div class="md-box"><small>Form (avg score)</small><b>${r.tale.homeFormAvg ?? "–"} vs ${r.tale.awayFormAvg ?? "–"}</b></div>
        <div class="md-box"><small>Luck score</small><b>${signed(r.tale.homeLuck)} vs ${signed(r.tale.awayLuck)}</b></div>
        ${extraNotes(r.tale)}
      </div>
    </article>`;

  const recapHtml = recap?.headline
    ? `<section class="md-story">
         <span class="md-kicker">Story of the week · GW${recap.gw}</span>
         <h2>${recap.headline.text}</h2>
         ${recap.secondaries?.length ? `<ul>${recap.secondaries.slice(0, 4).map((s) => `<li>${s.text}</li>`).join("")}</ul>` : ""}
         <a href="#recaps">Full Season Story archive &rarr;</a>
       </section>`
    : "";

  const heroWord = notStarted ? "Matchday" : seasonComplete ? "Final day" : "Matchday";
  const kicker = `Season ${currentYear}${seasonComplete ? " · Final standings" : " · This week"}`;
  const showClock = !notStarted && !seasonComplete && deadline;
  const arcs = buildSeasonArcWidgets(data.seasonArcs, managers);

  container.innerHTML = `
    <div class="matchday">
      <div class="md-aurora"><i></i><i></i><i></i></div>
      ${newsHtml}
      <section class="md-hero">
        <div>
          <div class="md-kicker">${kicker}</div>
          <h1 class="md-big"><span class="md-word">${heroWord}</span><br><span class="md-num" data-n="${notStarted ? "–" : pad(gw)}">${notStarted ? "–" : pad(gw)}</span></h1>
        </div>
        ${showClock ? `<div class="md-lock"><small id="md-locklabel">Lineups lock in</small><div class="md-clock" id="md-clock"></div></div>` : ""}
      </section>
      ${notStarted ? `<p class="md-empty">The draft hasn't happened yet — check back once fixtures are live.</p>` : ""}
      ${seasonComplete ? `<p class="md-empty">The season's played out — here's how the final gameweek (GW${gw}) landed. Check back once next season's fixtures are live.</p>` : ""}
      ${arcs ? `<div class="md-arcs">${arcs}</div>` : ""}
      <section>${featureHtml}</section>
      <section>${rest.map(stripHtml).join("")}</section>
      ${rows.length === 0 && !notStarted ? `<p class="md-empty">No fixtures to show.</p>` : ""}
      ${recapHtml}
      <p class="md-foot">${oddsMeta ? `${oddsMeta.basis === "live" ? "Live odds" : "Win odds"} compare each manager's best XI using ${oddsMeta.source} — a for-fun estimate, not a bookmaker's price. ` : ""}Tap a fixture to open it.</p>
    </div>`;

  const root = container.querySelector(".matchday");
  startClock(root, deadline);
  root.querySelectorAll(".md-strip").forEach((el) => el.addEventListener("click", () => el.classList.toggle("md-open")));
  choreograph(root);
}

// Positional edges + family/rivalry/gauntlet hook, shown at the foot of a match-centre panel.
function extraNotes(tale) {
  const lines = [
    ...tale.edges.map((e) => `<span>${e}</span>`),
    ...(tale.hook ? [`<span><b>${tale.hook.label}:</b> ${tale.hook.text}</span>`] : []),
  ];
  return lines.length ? `<div class="md-notes">${lines.join("")}</div>` : "";
}

function startClock(root, deadline) {
  const box = root.querySelector("#md-clock");
  if (!box) return;
  const last = {};
  const tick = () => {
    if (!document.body.contains(box)) { clearInterval(clockTimer); return; }
    const c = countdown(deadline);
    root.querySelector("#md-locklabel").textContent = c.over ? "Lineups are locked" : "Lineups lock in";
    if (!box.children.length) box.innerHTML = [["d", "Days"], ["h", "Hrs"], ["m", "Min"], ["s", "Sec"]].map(([k, l]) => `<div><b data-k="${k}">00</b><span>${l}</span></div>`).join("");
    for (const k of ["d", "h", "m", "s"]) {
      const el = box.querySelector(`[data-k="${k}"]`);
      const v = pad(c[k]);
      if (el.textContent !== v) {
        el.textContent = v;
        if (last[k] !== undefined) { el.classList.remove("md-pop"); void el.offsetWidth; el.classList.add("md-pop"); }
      }
      last[k] = v;
    }
  };
  tick();
  clockTimer = setInterval(tick, 1000);
}

// Reveal each block as it scrolls into view, count the odds up, and nudge the
// VS watermark with the pointer. All of it is skipped under reduced motion.
function choreograph(root) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const countUp = (el) => {
    const target = Number(el.dataset.v);
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 1100);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("md-in");
      e.target.querySelectorAll(".md-cu").forEach((el) => (reduce ? (el.textContent = el.dataset.v) : setTimeout(() => countUp(el), 350)));
      io.unobserve(e.target);
    }
  }, { threshold: 0.12 });
  root.querySelectorAll(".md-feature, .md-strip, .md-story").forEach((el) => io.observe(el));

  const feature = root.querySelector(".md-feature");
  if (feature && !reduce) {
    feature.addEventListener("pointermove", (e) => {
      const r = feature.getBoundingClientRect();
      feature.style.setProperty("--px", `${((e.clientX - r.left) / r.width - 0.5) * 40}px`);
      feature.style.setProperty("--py", `${((e.clientY - r.top) / r.height - 0.5) * 20}px`);
    });
  }
}
