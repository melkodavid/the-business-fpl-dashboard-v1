// Shared helpers for the Home page design samples. Everything is built from the
// league's real data (data/*.json) and the site's own rarity logic, so each
// sample shows the real managers, titles, records and rarities.
import { buildCareerCards } from "../js/lib/cardTiers.js";
import { rarityFor, prestigeRanks } from "../js/lib/cardRarity.js";
import { setIdentity } from "../js/identity.js";

const get = (path) => fetch(`../data/${path}`).then((r) => r.json());

export async function loadHome() {
  const [managers, history, lore, recapsIndex, schedule] = await Promise.all([
    get("managers.json"), get("history.json"), get("league-lore.json"), get("recaps/index.json"), get("schedule.json"),
  ]);
  const latest = recapsIndex.recaps.at(-1);
  const recap = latest ? await get(`recaps/gw${latest.gw}.json`) : null;

  const themeBy = new Map((lore.people ?? []).filter((p) => p.theme).map((p) => [p.personKey, p.theme]));
  const careers = buildCareerCards(history);
  const careerBy = new Map(careers.map((c) => [c.managerKey, c]));
  const reigningKey = history.reigningChampionKey ?? null;

  // Same order as the live Home page: titles, then average finish, then win %.
  const order = careers.map((c) => c.managerKey);
  const people = managers.list
    .map((m) => {
      const c = careerBy.get(m.personKey) ?? { titles: 0, w: 0, d: 0, l: 0, winPct: 0, seasons: 0, bestRank: null };
      return {
        key: m.personKey, name: m.playerName, club: m.name.replace(/\s*\*+$/, ""), color: m.color ?? "#6a2fa8", abbr: m.abbreviation,
        badge: m.badge, titles: c.titles, seasons: c.seasons, w: c.w, d: c.d, l: c.l, winPct: c.winPct,
        rarity: rarityFor(c), theme: themeBy.get(m.personKey) ?? null, isReigning: m.personKey === reigningKey, career: c,
      };
    })
    .sort((a, b) => (order.indexOf(a.key) === -1 ? 99 : order.indexOf(a.key)) - (order.indexOf(b.key) === -1 ? 99 : order.indexOf(b.key)));

  const headlines = recap ? [recap.headline?.text, ...recap.secondaries.map((s) => s.text)].filter(Boolean) : [];
  const champion = people.find((p) => p.isReigning) ?? people[0];
  const news = [
    `<b>Reigning champion</b> ${champion.name}`,
    ...(schedule.gw ? [`<b>Matchday ${String(schedule.gw).padStart(2, "0")}</b> lineups lock soon`] : []),
    ...headlines,
  ];
  // Minimal stand-in for the site's manager lookup, so the real trading-card renderer can be reused as-is.
  const lookup = { all: managers.list, themeForPersonKey: (k) => themeBy.get(k) ?? null };
  return { people, champion, news, lookup, careers, ladder: prestigeRanks(careers), gw: schedule.gw, currentYear: history.seasons.find((s) => s.isCurrent)?.year ?? "" };
}

export const photoSrc = (p) => `../assets/managers/${p.key}.jpg`;

// The same avatar logic as everywhere else: theme icon replaces the photo for
// managers whose joke is their identity, otherwise photo over an initials disc.
export function avatarHtml(p, cls = "") {
  if (p.theme?.avatarIcon) return `<span class="av ${cls}" style="--c:${p.color}"><b class="av-icon">${p.theme.icon}</b></span>`;
  return `<span class="av ${cls}" style="--c:${p.color}"><b>${p.abbr}</b><img src="${photoSrc(p)}" alt="" loading="lazy" onerror="this.remove()"></span>`;
}

export function crestHtml(p, cls = "") {
  const isPath = /\.(png|jpe?g|svg|webp|gif)$/i.test(p.badge ?? "");
  const label = p.badge && !isPath ? p.badge : p.abbr;
  const src = isPath ? (p.badge.startsWith("http") ? p.badge : `../${p.badge}`) : `../assets/badges/${p.key}.png`;
  return `<span class="crest ${cls}" style="--c:${p.color}"><img src="${src}" alt="" loading="lazy" onerror="this.remove()"><b>${label}</b></span>`;
}

export function selectManager(key) {
  setIdentity(key);
  location.href = "../#my-season";
}

export function countUp(el, ms = 1100) {
  const target = Number(el.dataset.v);
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// Reveal-on-scroll with an optional per-element callback (used for count-ups).
export function revealOnScroll(selector, onReveal) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("in");
      onReveal?.(e.target);
      io.unobserve(e.target);
    }
  }, { threshold: 0.12 });
  document.querySelectorAll(selector).forEach((el) => io.observe(el));
}

// Mouse-follow tilt + glare for any `.tilt` element.
export function attachTilt(root = document) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let active = null;
  const reset = (el) => el && ["--mx", "--my", "--rx", "--ry"].forEach((v) => el.style.removeProperty(v)) && el.classList.remove("tilting");
  root.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const card = e.target.closest(".tilt");
    if (card !== active) { reset(active); active = card; }
    if (!card) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    card.classList.add("tilting");
    card.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    card.style.setProperty("--rx", `${((px - 0.5) * 12).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${(-(py - 0.5) * 12).toFixed(2)}deg`);
  });
  root.addEventListener("pointerleave", () => { reset(active); active = null; });
}

// Interactive "pass map" backdrop: drifting nodes joined by faint lines, an
// occasional completed-pass pulse, and the lines near the pointer glow brighter.
// `nodeCount` nodes; stops itself when the canvas leaves the page.
export function startNetwork(canvas, { nodeCount = 16, fixed = true } = {}) {
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const palette = ["#c9a660", "#9b5ce0", "#4fd6a0"];
  let W, H, nodes = [], pulses = [], mouse = { x: -999, y: -999 }, last = null, lastPulse = 0;

  const resize = () => {
    W = fixed ? innerWidth : canvas.parentElement.clientWidth;
    H = fixed ? innerHeight : canvas.parentElement.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener("resize", resize);
  nodes = Array.from({ length: nodeCount }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05,
    r: 1.6 + Math.random() * 1.6, c: palette[i % 3],
  }));
  addEventListener("pointermove", (e) => { mouse = { x: e.clientX, y: e.clientY - (fixed ? 0 : canvas.getBoundingClientRect().top) }; });

  const LINK = 230;
  function frame(now) {
    if (!canvas.isConnected) return;
    if (last == null) last = now;
    const dt = Math.min(50, now - last); last = now;
    ctx.clearRect(0, 0, W, H);
    if (!reduce) for (const n of nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    const edges = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < LINK) edges.push({ a, b, d });
    }
    for (const e of edges) {
      const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2;
      const near = Math.max(0, 1 - Math.hypot(mx - mouse.x, my - mouse.y) / 260);
      const alpha = 0.1 * (1 - e.d / LINK) + near * 0.32;
      ctx.strokeStyle = `rgba(236,217,163,${alpha.toFixed(3)})`;
      ctx.lineWidth = 1 + near * 0.8;
      ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
    }
    if (!reduce && !pulses.length && edges.length && now - lastPulse > 1800) {
      const e = edges[Math.floor(Math.random() * edges.length)];
      pulses.push({ a: e.a, b: e.b, t: 0, dur: 1000 + Math.random() * 500 });
      lastPulse = now;
    }
    pulses = pulses.filter((p) => {
      p.t += dt / p.dur;
      if (p.t >= 1) return false;
      const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, "rgba(236,217,163,0.95)"); g.addColorStop(1, "rgba(236,217,163,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    for (const n of nodes) {
      ctx.fillStyle = n.c; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

export function newsBannerHtml(items) {
  const doubled = [...items, ...items].map((t) => `<span>${t}</span>`).join("");
  return `<div class="news"><div class="news-lab">Business News</div><div class="news-viewport"><div class="news-reel" style="--reel:${Math.max(40, Math.round(items.join("").length / 5))}s">${doubled}</div></div></div>`;
}

// CSS shared by all three samples: tokens, avatar/crest/belt pieces, ticker, tilt glare.
export const sharedCss = `
  :root { --bg:#0a0b12; --surface:#12141d; --text:#eef1f4; --muted:#8b95a3; --gold:#c9a660; --gold-b:#ecd9a3; --gold-d:#8a5c14; --plum:#6a2fa8; --plum-b:#9b5ce0; --lime:#00ff85; --line:rgba(255,255,255,0.09); }
  * { box-sizing: border-box; }
  html { background: var(--bg); }
  body { margin: 0; color: var(--text); font-family: "Archivo", system-ui, sans-serif; background: radial-gradient(900px 500px at 12% -8%, rgba(106,47,168,0.3), transparent 60%), radial-gradient(800px 460px at 100% 0%, rgba(0,255,133,0.07), transparent 60%), radial-gradient(900px 500px at 50% 118%, rgba(201,166,96,0.12), transparent 60%), var(--bg); min-height: 100vh; overflow-x: hidden; padding-bottom: 60px; }
  canvas.net { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
  .page { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto; padding: 0 18px; }
  .serif { font-family: "Cormorant Garamond", Georgia, serif; }
  .av { position: relative; display: inline-grid; place-items: center; width: var(--s, 64px); height: var(--s, 64px); border-radius: 50%; overflow: hidden; flex-shrink: 0;
    background: radial-gradient(circle at 35% 28%, color-mix(in srgb, var(--c) 70%, #fff), var(--c)); font-weight: 800; font-size: calc(var(--s, 64px) * 0.3); color: #fff; }
  .av img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .av-icon { font-size: calc(var(--s, 64px) * 0.55); }
  .crest { position: relative; display: inline-grid; place-items: center; width: var(--s, 40px); height: var(--s, 40px); flex-shrink: 0; border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 60%, #fff), var(--c) 70%); box-shadow: 0 0 0 1.5px var(--gold); font-weight: 800; font-size: calc(var(--s, 40px) * 0.3); color: #fff; }
  .crest img { position: absolute; inset: -12%; width: 124%; height: 124%; object-fit: contain; border-radius: 12%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5)); }
  .crest:has(img) { background: none; box-shadow: none; } .crest:has(img) b { display: none; }
  .belt { display: inline-block; filter: drop-shadow(0 2px 6px rgba(217,165,60,0.5)); }
  /* rarity tokens (same as the live site) */
  .r-common { --rc:#b3aa97; --rc2:#5b5446; } .r-uncommon { --rc:#3fd68a; --rc2:#176a45; } .r-rare { --rc:#52aeff; --rc2:#173f7a; }
  .r-epic { --rc:#b873ff; --rc2:#4a1b8c; } .r-legendary { --rc:#ffc93f; --rc2:#8a5806; } .r-mythic { --rc:#ff6ad0; --rc2:#3b2fd9; }
  @property --spin { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
  @keyframes spin { to { --spin: 360deg; } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
  @keyframes blip { 50% { opacity: 0.2; transform: scale(0.7); } }
  /* rolling news banner */
  .news { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; height: 44px; background: linear-gradient(90deg, #0a0614, #1a0f2e); border-top: 2px solid var(--gold); box-shadow: 0 -10px 40px -10px rgba(0,0,0,0.7); }
  .news-lab { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 0 32px 0 18px; position: relative; z-index: 2; color: #1b1405; font: 800 14px "Archivo"; letter-spacing: 0.16em; text-transform: uppercase;
    background: linear-gradient(160deg, var(--gold-b), var(--gold)); clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%); }
  .news-lab::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #1b1405; animation: blip 1.4s infinite; }
  .news-viewport { flex: 1; overflow: hidden; display: flex; align-items: center; -webkit-mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 60px), transparent); mask-image: linear-gradient(90deg, transparent, #000 40px, #000 calc(100% - 60px), transparent); }
  .news-reel { display: inline-flex; white-space: nowrap; animation: reel var(--reel, 50s) linear infinite; }
  .news:hover .news-reel { animation-play-state: paused; }
  .news-reel span { font: 600 14px "Archivo"; letter-spacing: 0.04em; padding: 0 22px; color: #efe7ff; }
  .news-reel span::after { content: "\\25C6"; color: var(--gold); margin-left: 44px; font-size: 10px; vertical-align: middle; }
  .news-reel span b { color: var(--gold-b); font-weight: 700; }
  @keyframes reel { to { transform: translateX(-50%); } }
  .tilt { transform: perspective(900px) rotateX(var(--ry, 0deg)) rotateY(var(--rx, 0deg)); transition: transform .5s cubic-bezier(.2,.8,.2,1); }
  .tilt.tilting { transition: transform .08s linear; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } .rv { opacity: 1 !important; transform: none !important; } }
`;
