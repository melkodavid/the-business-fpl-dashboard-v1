// Keeps an open tab from going stale. The site is static: the hourly data job
// commits new JSON and GitHub Pages serves it, but a page that's already open
// never asks again. This polls the tiny meta.json (cheap, never cached) and,
// when a newer build has landed, offers a one-tap refresh -- so nobody has to
// remember to reload to see the new gameweek.
const CHECK_EVERY_MS = 5 * 60 * 1000;

function agoText(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function footerText(meta) {
  const date = new Date(meta.lastUpdated);
  return `Last updated ${date.toLocaleString()} (${agoText(meta.lastUpdated)}) · through GW${meta.finishedThroughGw ?? "?"}` +
    (meta.mock ? " · mock data" : "");
}

function showToast(onRefresh) {
  if (document.getElementById("fresh-toast")) return;
  const toast = document.createElement("div");
  toast.id = "fresh-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <div class="fresh-msg">
      <span class="fresh-hey">⚠ Hey Lucas! ⚠</span>
      <span class="fresh-sub">New league data is in! Scores, tables and lineups have updated. Press the big red button!</span>
    </div>
    <button type="button" class="fresh-go">REFRESH <span class="fresh-arrows">👉</span></button>
    <button type="button" class="fresh-x" aria-label="Dismiss">×</button>`;
  toast.querySelector(".fresh-go").addEventListener("click", onRefresh);
  toast.querySelector(".fresh-x").addEventListener("click", () => toast.remove());
  document.body.appendChild(toast);
}

export function watchForNewData(initialMeta, footerEl) {
  let known = initialMeta?.lastUpdated;
  let busy = false;

  async function check() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch(`data/meta.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const meta = await res.json();
      if (known && meta.lastUpdated && meta.lastUpdated !== known) showToast(() => location.reload());
    } catch {
      /* offline or Pages mid-deploy: try again next time */
    } finally {
      busy = false;
    }
  }

  // the footer describes the data on screen; only its "x ago" ticks forward
  if (footerEl) setInterval(() => { footerEl.textContent = footerText(initialMeta); }, 60 * 1000);
  setInterval(check, CHECK_EVERY_MS);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
  window.addEventListener("focus", check);
  return check;
}
