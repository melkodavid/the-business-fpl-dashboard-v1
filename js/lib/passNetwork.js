// Ambient "pass network" behind the fixture cards -- one node per manager
// (12), faint connecting lines like a broadcaster's post-match pass-network
// graphic, with an occasional "completed pass" pulse. Purely decorative; not
// tied to any real pass data. Stops itself once its canvas leaves the DOM
// (the next route change replaces container.innerHTML), so re-visiting this
// page never stacks up multiple animation loops. Shared between the Schedule
// "This Week" page and the landing page's hero -- same branded moment, one
// implementation.
export function initPassNetwork(canvas, heroEl) {
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
