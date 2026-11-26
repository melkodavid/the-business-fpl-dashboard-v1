import { playNightVisionWhine } from "./nightVisionSound.js";

// Site-wide "event" themes: a temporary look for the whole site (a media
// blackout, Christmas, Halloween...). Which one is on comes from
// data/site-theme.json:
//   { "theme": "none" | "auto" | "<name>", "schedule": [{ "theme", "from": "MM-DD", "to": "MM-DD" }] }
// "auto" picks whatever the schedule says for today. Anyone can preview a theme
// without switching it on for everyone by adding ?theme=<name> to the address
// (?theme=none turns it off for that visit). Styles: css/themes.css.

export const THEMES = {
  blackout: {
    font: "Share+Tech+Mono",
    banner: "⚠ MEDIA BLACKOUT IN EFFECT ⚠ &nbsp;·&nbsp; Communications restricted by order of the Commissioner &nbsp;·&nbsp; Projection source: <s>REDACTED</s> &nbsp;·&nbsp; Internal investigation: ONGOING &nbsp;·&nbsp; Trust nothing &nbsp;·&nbsp;",
    fx: "rain",
    stamps: ["BLACKOUT", "CONFIDENTIAL"], // rubber stamps in the header; the site name gets a redaction bar
    docTitle: "█████ ████████ · CLASSIFIED",
    // full-screen entry screen, once per visit
    gate: {
      id: "blackout-1",
      title: "BLACKOUT ENABLED",
      subtitle: "TEAM HAS BEEN COMPROMISED",
      button: "ENTER THE DARKNESS",
      sound: true, // the night-vision power-up whine when the button is pressed
      terminal: [
        "> secure link ......... OK",
        "> league database ..... 12 subjects",
        "> projection source ... [REDACTED]",
        "> integrity check ..... FAILED",
        "> commissioner ........ UNREACHABLE",
      ],
    },
  },
  nightvision: {
    font: "Share+Tech+Mono",
    banner: "● NIGHT OPS &nbsp;·&nbsp; Surveillance of the league is ongoing &nbsp;·&nbsp; Subjects under observation: 12 &nbsp;·&nbsp; Nobody saw nothing &nbsp;·&nbsp;",
    fx: "grain",
    hud: true,
  },
  christmas: {
    font: "Mountains+of+Christmas:wght@700",
    banner: "🎄 Season's Greetings from The Business &nbsp;·&nbsp; May your bench never outscore your XI &nbsp;·&nbsp; Merry Christmas and a happy New Year &nbsp;·&nbsp; 🎁",
    fx: "snow",
    lights: true,
  },
  halloween: {
    font: "Creepster",
    banner: "🎃 Spooky season &nbsp;·&nbsp; Beware the 59th-minute sub &nbsp;·&nbsp; Something wicked this way benches &nbsp;·&nbsp; 🦇",
    fx: "bats",
  },
};

const today = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// "12-01".."12-31", and ranges that wrap the new year ("12-28".."01-02")
const inRange = (md, from, to) => (from <= to ? md >= from && md <= to : md >= from || md <= to);

export function pickTheme(config, { search = "", date = today() } = {}) {
  const asked = new URLSearchParams(search).get("theme");
  if (asked) return THEMES[asked] ? asked : null;
  const setting = config?.theme ?? "none";
  if (THEMES[setting]) return setting;
  if (setting === "auto") return (config.schedule ?? []).find((s) => THEMES[s.theme] && inRange(date, s.from, s.to))?.theme ?? null;
  return null;
}

// ---- the moving layer: code rain, film grain, snow, bats -------------------
function startFx(kind, canvas) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ctx = canvas.getContext("2d");
  let w = 0, h = 0, items = [];
  const scale = kind === "grain" ? 0.35 : 1; // grain draws small and gets stretched
  const resize = () => {
    w = canvas.width = Math.ceil(innerWidth * scale);
    h = canvas.height = Math.ceil(innerHeight * scale);
    if (kind === "rain") items = Array.from({ length: Math.ceil(w / 16) }, () => ({ y: Math.random() * -h, speed: 4 + Math.random() * 8 }));
    if (kind === "snow") items = Array.from({ length: Math.min(140, Math.round(w / 9)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 0.8 + Math.random() * 2.4, s: 0.4 + Math.random() * 1.1, d: Math.random() * 6 }));
    if (kind === "bats") items = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * w, y: 60 + Math.random() * h * 0.5, s: 1 + Math.random() * 1.5, p: i }));
  };
  resize();
  addEventListener("resize", resize);
  const glyphs = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ$#%&*+=<>";

  const frame = (t) => {
    if (kind === "rain") {
      ctx.fillStyle = "rgba(0,0,0,0.1)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = "15px 'Share Tech Mono', monospace";
      items.forEach((c, i) => {
        ctx.fillStyle = Math.random() < 0.04 ? "#d6ffd9" : "#00ff41";
        ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * 16, c.y);
        c.y = c.y > h + Math.random() * 400 ? 0 : c.y + c.speed;
      });
    } else if (kind === "grain") {
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 26;
      }
      ctx.putImageData(img, 0, 0);
    } else if (kind === "snow") {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const f of items) {
        ctx.beginPath(); ctx.arc(f.x + Math.sin(t / 1600 + f.d) * 14, f.y, f.r, 0, Math.PI * 2); ctx.fill();
        f.y += f.s; if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
      }
    } else if (kind === "bats") {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "rgba(10,4,14,0.9)";
      for (const b of items) {
        const flap = Math.sin(t / 90 + b.p) * 7;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.quadraticCurveTo(b.x - 9, b.y - 6 - flap, b.x - 20, b.y - flap);
        ctx.quadraticCurveTo(b.x - 10, b.y + 2, b.x, b.y + 4);
        ctx.quadraticCurveTo(b.x + 10, b.y + 2, b.x + 20, b.y - flap);
        ctx.quadraticCurveTo(b.x + 9, b.y - 6 - flap, b.x, b.y);
        ctx.fill();
        b.x += b.s; b.y += Math.sin(t / 700 + b.p) * 0.6;
        if (b.x > w + 30) { b.x = -30; b.y = 60 + Math.random() * h * 0.5; }
      }
    }
  };

  if (reduced) { frame(0); return; }
  let last = 0;
  const loop = (t) => {
    if (!document.hidden && t - last > (kind === "grain" ? 90 : 33)) { frame(t); last = t; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function hudHtml() {
  return `
    <div class="st-hud">
      <span class="st-hud-rec">● REC</span>
      <span class="st-hud-mode">NV-4 · GAIN 3X · IR ON</span>
      <span class="st-hud-clock" id="st-clock"></span>
      <span class="st-hud-cross"></span>
      <i class="st-c tl"></i><i class="st-c tr"></i><i class="st-c bl"></i><i class="st-c br"></i>
    </div>`;
}

function lightsHtml() {
  return `<div class="st-lights" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>`;
}

// ---- the entry screen: shown once per visit while a theme with a `gate` is on --
const GATE_SEEN_KEY = "tb-gate-seen";

function showGate(gate) {
  try { if (sessionStorage.getItem(GATE_SEEN_KEY) === gate.id) return; } catch { /* private mode: just show it */ }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("div");
  el.className = "st-gate";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", gate.title);
  el.innerHTML = `
    <div class="st-gate-inner">
      <pre class="st-gate-term" aria-hidden="true"></pre>
      <h1 class="st-gate-title" data-text="${gate.title}">${gate.title}</h1>
      <p class="st-gate-sub" data-text="${gate.subtitle}">${gate.subtitle}</p>
      <button type="button" class="st-gate-btn">${gate.button}</button>
    </div>
    <i class="st-gate-scan" aria-hidden="true"></i>`;
  document.body.append(el);
  document.documentElement.classList.add("st-gated");

  // the terminal types itself out, then the warning and the button arrive
  const term = el.querySelector(".st-gate-term");
  const lines = gate.terminal;
  let li = 0, ci = 0;
  const reveal = () => el.classList.add("is-armed");
  const type = () => {
    if (li >= lines.length) { reveal(); return; }
    const line = lines[li];
    term.textContent += line[ci] ?? "";
    ci++;
    if (ci > line.length) { term.textContent += "\n"; li++; ci = 0; setTimeout(type, 140); return; }
    setTimeout(type, 4 + Math.random() * 12);
  };
  if (reduced) { term.textContent = lines.join("\n"); reveal(); } else setTimeout(type, 350);

  const btn = el.querySelector(".st-gate-btn");
  btn.addEventListener("click", () => {
    try { sessionStorage.setItem(GATE_SEEN_KEY, gate.id); } catch { /* fine */ }
    if (gate.sound) { try { playNightVisionWhine(); } catch { /* no sound is fine */ } }
    if (reduced) { el.remove(); document.documentElement.classList.remove("st-gated"); return; }
    // goggles on: a flash, the view opens out from the centre, the page over-bright then settling
    el.classList.add("is-entering");
    document.documentElement.classList.add("st-powering");
    setTimeout(() => { el.remove(); document.documentElement.classList.remove("st-gated"); }, 1900);
    setTimeout(() => document.documentElement.classList.remove("st-powering"), 2600);
  });
  // let the page load quietly behind it; focus the button once it appears
  setTimeout(() => btn.focus({ preventScroll: true }), reduced ? 0 : 400 + lines.join("").length * 12 + 2000);
}

// Applies the theme (if any). Safe to call before the league data has loaded.
export async function applySiteTheme() {
  let config = null;
  try { config = await fetch("data/site-theme.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)); } catch { /* no theme file: no theme */ }
  const name = pickTheme(config, { search: location.search });
  if (!name) return null;
  const theme = THEMES[name];
  document.documentElement.dataset.siteTheme = name;
  if (theme.gate) showGate(theme.gate);

  if (theme.font) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${theme.font}&display=swap`;
    document.head.append(link);
  }

  if (theme.stamps) {
    document.querySelector(".site-title")?.insertAdjacentHTML("afterend", `<span class="st-stamps" aria-hidden="true">${theme.stamps.map((s, i) => `<b class="st-stamp st-stamp-${i}">${s}</b>`).join("")}</span>`);
  }
  if (theme.docTitle) document.title = theme.docTitle;

  const header = document.querySelector(".site-header");
  const banner = document.createElement("div");
  banner.className = "st-banner";
  banner.innerHTML = `${theme.lights ? lightsHtml() : ""}<div class="st-banner-track"><span>${theme.banner}</span><span>${theme.banner}</span></div>`;
  header?.after(banner);

  const fx = document.createElement("div");
  fx.className = "st-fx";
  fx.setAttribute("aria-hidden", "true");
  fx.innerHTML = `<canvas class="st-canvas"></canvas><div class="st-overlay"></div>${theme.hud ? hudHtml() : ""}`;
  document.body.append(fx);
  startFx(theme.fx, fx.querySelector("canvas"));

  if (theme.hud) {
    const clock = document.getElementById("st-clock");
    const tick = () => { clock.textContent = new Date().toLocaleString(undefined, { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); };
    tick(); setInterval(tick, 1000);
  }
  return name;
}
