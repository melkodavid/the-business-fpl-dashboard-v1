// Interactive "pass map" backdrop for the Home page: drifting nodes joined by
// faint lines, an occasional completed-pass pulse, and the lines near the
// pointer glow brighter. Fixed behind the page; stops itself (and unhooks its
// listeners) once the canvas leaves the DOM, i.e. when you navigate away.
export function startConstellation(canvas, { nodeCount = 18 } = {}) {
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const palette = ["#c9a660", "#9b5ce0", "#4fd6a0"];
  const LINK = 230;
  let W = 0;
  let H = 0;
  let mouse = { x: -999, y: -999 };
  let pulses = [];
  let last = null;
  let lastPulse = 0;

  const resize = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const onMove = (e) => { mouse = { x: e.clientX, y: e.clientY }; };
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", onMove);

  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    x: Math.random() * W, y: Math.random() * H,
    vx: (Math.random() - 0.5) * 0.05, vy: (Math.random() - 0.5) * 0.05,
    r: 1.6 + Math.random() * 1.6, c: palette[i % 3],
  }));

  function frame(now) {
    if (!canvas.isConnected) {
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      return;
    }
    if (last == null) last = now;
    const dt = Math.min(50, now - last);
    last = now;
    ctx.clearRect(0, 0, W, H);
    if (!reduce) {
      for (const n of nodes) {
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
    }
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) edges.push({ a, b, d });
      }
    }
    for (const e of edges) {
      const mx = (e.a.x + e.b.x) / 2;
      const my = (e.a.y + e.b.y) / 2;
      const near = Math.max(0, 1 - Math.hypot(mx - mouse.x, my - mouse.y) / 260);
      ctx.strokeStyle = `rgba(236,217,163,${(0.1 * (1 - e.d / LINK) + near * 0.32).toFixed(3)})`;
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
      const x = p.a.x + (p.b.x - p.a.x) * p.t;
      const y = p.a.y + (p.b.y - p.a.y) * p.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 12);
      g.addColorStop(0, "rgba(236,217,163,0.95)");
      g.addColorStop(1, "rgba(236,217,163,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      return true;
    });
    for (const n of nodes) {
      ctx.fillStyle = n.c;
      ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
