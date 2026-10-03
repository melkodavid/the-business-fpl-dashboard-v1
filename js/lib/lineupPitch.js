import { escapeHtml } from "../format.js";

// The predicted-lineup pitch: one team's best XI for the coming gameweek laid
// out in its formation (keeper on the left, strikers on the right; flipped to
// vertical on phones), each player a jersey in the club's colour carrying his
// expected points. A canvas on top runs a looping build-up play -- the ball
// works from the keeper through defence and midfield to a forward, lighting the
// passing lanes it travels (the old Home pass map, now with real players).
// Hover or focus a player to light their lanes and see the details.

const JERSEY = "M13 2 L2 8 L6 18 L11 15 L11 36 L29 36 L29 15 L34 18 L38 8 L27 2 Q20 8 13 2 Z";
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const POS_LABEL = { GKP: "Goalkeeper", GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };

const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1);

function layout(xi, portrait) {
  const lines = { gk: [], def: [], mid: [], fwd: [] };
  for (const p of xi) lines[{ 1: "gk", 2: "def", 3: "mid", 4: "fwd" }[p.type]].push(p);
  const span = (i, count, lo, hi) => (count === 1 ? (lo + hi) / 2 : lo + ((hi - lo) * i) / (count - 1));
  const slots = [];
  for (const [line, list] of Object.entries(lines)) {
    list.forEach((player, k) => {
      let x;
      let y;
      if (!portrait) {
        x = { gk: 8, def: 28, mid: 53, fwd: 80 }[line];
        y = line === "gk" ? 50 : span(k, list.length, list.length > 3 ? 12 : 22, list.length > 3 ? 88 : 78);
      } else {
        y = { gk: 90, def: 71, mid: 48, fwd: 20 }[line];
        x = line === "gk" ? 50 : span(k, list.length, list.length > 3 ? 12 : 22, list.length > 3 ? 88 : 78);
      }
      slots.push({ player, line, xy: [x, y] });
    });
  }
  return slots;
}

const markings = (portrait) => (portrait
  ? `<svg class="lp-lines" viewBox="0 0 90 135" preserveAspectRatio="none" fill="none" stroke="rgba(236,217,163,0.35)" stroke-width="0.5" vector-effect="non-scaling-stroke"><rect x="4" y="4" width="82" height="127"/><line x1="4" y1="67.5" x2="86" y2="67.5"/><circle cx="45" cy="67.5" r="11"/><rect x="22" y="4" width="46" height="18"/><rect x="33" y="4" width="24" height="7"/><rect x="22" y="113" width="46" height="18"/><rect x="33" y="124" width="24" height="7"/></svg>`
  : `<svg class="lp-lines" viewBox="0 0 160 90" preserveAspectRatio="none" fill="none" stroke="rgba(236,217,163,0.35)" stroke-width="0.4"><rect x="4" y="4" width="152" height="82"/><line x1="80" y1="4" x2="80" y2="86"/><circle cx="80" cy="45" r="11"/><rect x="4" y="22" width="20" height="46"/><rect x="4" y="33" width="8" height="24"/><rect x="136" y="22" width="20" height="46"/><rect x="148" y="33" width="8" height="24"/></svg>`);

/**
 * @param host     element to render into (its previous contents and animation are replaced)
 * @param lineup   { xi, bench, formation, expected, captainId, locked }
 * @param color    the club's colour (jersey)
 * @returns a stop() function
 */
export function renderLineupPitch(host, lineup, color = "#6a2fa8") {
  host.__lpStop?.();
  const mq = window.matchMedia("(max-width: 760px)");
  let raf = 0;
  let stopped = false;

  function build() {
    cancelAnimationFrame(raf);
    const slots = layout(lineup.xi, mq.matches);
    const star = lineup.captainId;
    host.innerHTML = `
      <div class="lp-pitch">
        ${markings(mq.matches)}
        <canvas></canvas>
        ${slots.map(({ player: p, xy }, i) => `
          <button type="button" class="lp-pl${p.id === star ? " is-star" : ""}" style="--x:${xy[0]}%;--y:${xy[1]}%;--i:${i}" data-i="${i}" aria-label="${escapeHtml(p.name)}, ${fmt(p.ep)} expected points">
            <svg class="lp-shirt" viewBox="0 0 40 38" aria-hidden="true"><path d="${JERSEY}" fill="${color}" stroke="#0a0f0c" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 2 Q20 8 27 2" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.4"/></svg>
            <span class="lp-ep">${fmt(p.ep)}</span>
            <span class="lp-nm">${escapeHtml(p.name)}</span>
            ${p.id === star ? `<span class="lp-star" title="Highest expected points">★</span>` : ""}
            <span class="lp-tip"><b>${escapeHtml(p.name)}</b><small>${POS_LABEL[p.pos] ?? p.pos} · ${escapeHtml(p.team ?? "")}</small><span class="lp-tip-ep">${fmt(p.ep)} <em>expected pts</em></span></span>
          </button>`).join("")}
      </div>`;
    start(slots);
  }

  function start(slots) {
    const pitch = host.querySelector(".lp-pitch");
    const canvas = pitch.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const size = () => {
      W = pitch.clientWidth; H = pitch.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = `${W}px`; canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const pt = (i) => [(slots[i].xy[0] / 100) * W, (slots[i].xy[1] / 100) * H];

    const by = (line) => slots.map((s, i) => ({ ...s, i })).filter((s) => s.line === line);
    const L = { gk: by("gk"), def: by("def"), mid: by("mid"), fwd: by("fwd") };
    const edges = [];
    const link = (a, b) => edges.push([a.i, b.i]);
    L.def.forEach((d) => link(L.gk[0], d));
    [L.def, L.mid, L.fwd].forEach((line) => line.slice(1).forEach((s, k) => link(line[k], s)));
    const nearest = (from, to) => from.forEach((a) => [...to]
      .sort((x, y) => Math.hypot(x.xy[0] - a.xy[0], x.xy[1] - a.xy[1]) - Math.hypot(y.xy[0] - a.xy[0], y.xy[1] - a.xy[1]))
      .slice(0, 2).forEach((b) => link(a, b)));
    nearest(L.def, L.mid);
    nearest(L.mid, L.fwd);

    let hover = null;
    pitch.onpointerover = (e) => { const b = e.target.closest(".lp-pl"); hover = b ? Number(b.dataset.i) : null; };
    pitch.onpointerleave = () => { hover = null; };
    pitch.onfocusin = (e) => { const b = e.target.closest(".lp-pl"); hover = b ? Number(b.dataset.i) : null; };
    pitch.onfocusout = () => { hover = null; };

    // Players with more expected points are likelier to be on the ball.
    const pickFrom = (arr) => {
      const weights = arr.map((s) => 1 + Math.max(0, s.player.ep));
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let k = 0; k < arr.length; k++) { r -= weights[k]; if (r <= 0) return arr[k].i; }
      return arr[arr.length - 1].i;
    };
    const chain = () => [L.gk[0].i, pickFrom(L.def), pickFrom(L.mid), pickFrom(L.fwd)];

    const lit = new Map();
    let play = null;
    let burst = null;
    let rest = 0;
    let last = null;
    const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

    function frame(now) {
      if (stopped || !canvas.isConnected) return;
      if (last == null) last = now;
      const dt = Math.min(50, now - last);
      last = now;
      if (pitch.clientWidth !== W || pitch.clientHeight !== H) size();
      ctx.clearRect(0, 0, W, H);

      for (const [a, b] of edges) {
        const k = key(a, b);
        const glow = lit.get(k) ?? 0;
        const hot = hover !== null && (a === hover || b === hover) ? 1 : 0;
        const [ax, ay] = pt(a);
        const [bx, by2] = pt(b);
        ctx.strokeStyle = `rgba(236,217,163,${(0.12 + glow * 0.7 + hot * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1 + glow * 1.6 + hot;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by2); ctx.stroke();
        lit.set(k, Math.max(0, glow - dt * 0.0007));
      }

      if (!reduced()) {
        if (!play && now > rest) play = { path: chain(), leg: 0, t: 0 };
        if (play) {
          const a = play.path[play.leg];
          const b = play.path[play.leg + 1];
          play.t += dt / 560;
          const [ax, ay] = pt(a);
          const [bx, by2] = pt(b);
          const f = Math.min(1, play.t);
          const x = ax + (bx - ax) * f;
          const y = ay + (by2 - ay) * f;
          lit.set(key(a, b), 1);
          const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
          g.addColorStop(0, "rgba(255,248,214,1)");
          g.addColorStop(0.4, "rgba(236,217,163,0.55)");
          g.addColorStop(1, "rgba(236,217,163,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
          if (play.t >= 1) {
            play.leg++; play.t = 0;
            if (play.leg >= play.path.length - 1) { burst = { at: pt(b), t: 0 }; play = null; rest = now + 2200; }
          }
        }
        if (burst) {
          burst.t += dt / 900;
          ctx.strokeStyle = `rgba(0,255,133,${Math.max(0, 1 - burst.t).toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(burst.at[0], burst.at[1], 20 + burst.t * 70, 0, Math.PI * 2); ctx.stroke();
          if (burst.t >= 1) burst = null;
        }
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  mq.addEventListener("change", build);
  host.__lpStop = () => { stopped = true; cancelAnimationFrame(raf); mq.removeEventListener("change", build); };
  build();
  return host.__lpStop;
}
