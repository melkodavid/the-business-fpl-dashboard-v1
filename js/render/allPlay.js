import { round1, rankChipHtml, luckPillHtml, escapeHtml } from "../format.js";
import { getIdentity } from "../identity.js";
import { luckExplainerHtml } from "../lib/luckExplainer.js";

// All-Play: every manager's score each gameweek played against all 11 others,
// not just the one opponent the fixture list handed them. The records are
// worked out here from data.allPlay.perGw (each manager's score per week).

// { gws, record: Map<managerId, {w,d,l}>, week: Map<gw, Map<managerId, {score,w,d,l}>> }
function allPlayRecords(perGw) {
  const gws = Object.keys(perGw).map(Number).sort((a, b) => a - b);
  const record = new Map();
  const week = new Map();
  for (const gw of gws) {
    const rows = perGw[gw];
    const thisWeek = new Map();
    for (const r of rows) {
      let w = 0, d = 0, l = 0;
      for (const o of rows) {
        if (o.managerId === r.managerId) continue;
        if (r.score > o.score) w++; else if (r.score === o.score) d++; else l++;
      }
      thisWeek.set(r.managerId, { score: r.score, w, d, l });
      const total = record.get(r.managerId) ?? { w: 0, d: 0, l: 0 };
      record.set(r.managerId, { w: total.w + w, d: total.d + d, l: total.l + l });
    }
    week.set(gw, thisWeek);
  }
  return { gws, record, week };
}

const rec = (r) => `${r.w}-${r.d}-${r.l}`;
const winPct = (r) => { const n = r.w + r.d + r.l; return n ? Math.round(((r.w + r.d / 2) / n) * 100) : 0; };

// Week-by-week grid: how many of the other 11 each manager beat, every gameweek.
function gridHtml(order, records, managers, myId) {
  const { gws, week } = records;
  const opponents = (week.get(gws[0])?.size ?? 12) - 1;
  const cell = (gw, id) => {
    const r = week.get(gw)?.get(id);
    if (!r) return `<td class="ap-cell ap-none">-</td>`;
    const share = (r.w + r.d / 2) / opponents;
    return `<td class="ap-cell" style="--s:${share.toFixed(3)}" title="GW${gw}: ${r.score} pts, ${rec(r)} against everyone"><button type="button" data-week="${gw}" data-mgr="${id}">${r.w}</button></td>`;
  };
  return `
    <div class="card ap-grid-card">
      <table class="ap-grid">
        <thead><tr><th class="text-left">Manager</th>${gws.map((gw) => `<th>GW${gw}</th>`).join("")}</tr></thead>
        <tbody>${order.map((id) => `<tr class="${id === myId ? "is-me" : ""}"><td class="text-left ap-name">${managers.clubHtml(id)}</td>${gws.map((gw) => cell(gw, id)).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    <p class="ap-note">Each number is how many of the other ${opponents} teams that score would have beaten. Greener is better; tap one to see the week.</p>`;
}

// One manager, one gameweek, against everyone.
function weekHtml(records, managers, id, gw) {
  const thisWeek = records.week.get(gw);
  const me = thisWeek?.get(id);
  if (!me) return `<p class="ap-note">No score for that week.</p>`;
  const others = [...thisWeek.entries()].filter(([oid]) => oid !== id).sort((a, b) => b[1].score - a[1].score);
  const name = escapeHtml(managers.name(id).replace(/\s*\*+$/, ""));
  const verdict = (o) => (me.score > o.score ? "W" : me.score === o.score ? "D" : "L");
  return `
    <div class="ap-week-sum">
      <b class="ap-week-score">${me.score}</b>
      <p><b>${name}</b> scored ${me.score} in GW${gw}: that beats <b>${me.w}</b> of the other ${others.length}${me.d ? `, ties ${me.d}` : ""} and loses to <b>${me.l}</b>. All-play record <b>${rec(me)}</b>.</p>
    </div>
    <ol class="ap-vs">
      ${others.map(([oid, o]) => `
        <li class="ap-vs-row ap-${verdict(o)}">
          <span class="ap-vs-res">${verdict(o)}</span>
          <span class="ap-vs-club">${managers.clubHtml(oid)}</span>
          <span class="ap-vs-score">${me.score} <i>-</i> ${o.score}</span>
        </li>`).join("")}
    </ol>`;
}

export function render(container, data, managers) {
  const myId = managers.idForPersonKey(getIdentity());
  const records = allPlayRecords(data.allPlay.perGw ?? {});
  const standings = data.allPlay.standings;
  const order = standings.map((s) => s.managerId);

  const rowsHtml = standings
    .map((s, i) => {
      const r = records.record.get(s.managerId) ?? { w: 0, d: 0, l: 0 };
      return `
        <tr class="${s.managerId === myId ? "is-me" : ""}">
          <td>${rankChipHtml(i + 1)}</td>
          <td class="text-left">${managers.clubHtml(s.managerId)}</td>
          <td class="ap-rec">${rec(r)}</td>
          <td class="ap-sm-hide">${winPct(r)}%</td>
          <td class="ap-sm-hide">${s.actualWins}</td>
          <td>${round1(s.expectedWins)}</td>
          <td>${luckPillHtml(s.luckScore)}</td>
        </tr>`;
    })
    .join("");

  const latestGw = records.gws[records.gws.length - 1];
  const pickId = order.includes(myId) ? myId : order[0];
  const byName = [...order].sort((a, b) => managers.name(a).localeCompare(managers.name(b)));

  container.innerHTML = `
    <h2 class="section-title">All-Play Standings</h2>
    <p class="section-subtitle">Every manager's score each gameweek played against all 11 others, not just the one opponent they drew - sorted by Expected Wins. Luck Score = Actual Wins − Expected Wins.</p>
    <div class="card ap-table-card">
      <table>
        <thead>
          <tr><th>#</th><th class="text-left">Manager</th><th title="Wins-draws-losses against every team, every week"><span class="ap-long">All-Play Record</span><span class="ap-short">Record</span></th><th class="ap-sm-hide" title="Share of all-play games won (draws count half)">All-Play %</th><th class="ap-sm-hide">Actual Wins</th><th><span class="ap-long">Expected Wins</span><span class="ap-short">Exp. W</span></th><th><span class="ap-long">Luck Score</span><span class="ap-short">Luck</span></th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>

    ${records.gws.length ? `
      <h3 class="ap-h3">Your week against everyone</h3>
      <div class="card ap-week">
        <div class="ap-pick">
          <label>Manager<select id="ap-mgr">${byName.map((id) => `<option value="${id}"${id === pickId ? " selected" : ""}>${escapeHtml(managers.name(id).replace(/\s*\*+$/, ""))}</option>`).join("")}</select></label>
          <label>Gameweek<select id="ap-gw">${[...records.gws].reverse().map((gw) => `<option value="${gw}"${gw === latestGw ? " selected" : ""}>GW${gw}</option>`).join("")}</select></label>
        </div>
        <div id="ap-week-body">${weekHtml(records, managers, pickId, latestGw)}</div>
      </div>

      <h3 class="ap-h3">Week by week</h3>
      ${gridHtml(order, records, managers, myId)}
    ` : ""}

    ${luckExplainerHtml(data, managers, myId)}
  `;

  const mgrEl = container.querySelector("#ap-mgr");
  const gwEl = container.querySelector("#ap-gw");
  if (!mgrEl) return;
  const show = () => { container.querySelector("#ap-week-body").innerHTML = weekHtml(records, managers, Number(mgrEl.value), Number(gwEl.value)); };
  mgrEl.addEventListener("change", show);
  gwEl.addEventListener("change", show);
  // tapping a grid cell opens that manager's week above
  container.querySelector(".ap-grid")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-week]");
    if (!b) return;
    mgrEl.value = b.dataset.mgr; gwEl.value = b.dataset.week; show();
    container.querySelector(".ap-week").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
