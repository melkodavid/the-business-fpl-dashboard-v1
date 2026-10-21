import { escapeHtml } from "../format.js";
import { getIdentity } from "../identity.js";

// "What if this manager had that manager's schedule?" -- see scripts/stats/scheduleSwap.js.
const clean = (n) => (n ?? "").replace(/\s*\*+$/, "").trim();
const ordinal = (n) => { const v = n % 100; return v >= 11 && v <= 13 ? `${n}th` : `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th"}`; };
const rec = (r) => `${r.w}-${r.d}-${r.l}`;
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const tone = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");

function summaryHtml(a, b, ctx, managers) {
  const { actual, matrix } = ctx;
  const real = actual[a];
  const swap = matrix[a][b];
  const dPts = swap.pts - real.pts;
  const dRank = real.rank - swap.rank; // positive = climbs
  const aName = escapeHtml(clean(managers.name(a)));
  const bName = escapeHtml(clean(managers.name(b)));
  const sentence = a === b
    ? `That's their real schedule — pick someone else's to see what changes.`
    : dPts === 0 && dRank === 0
      ? `<b>${aName}</b> would have ended up exactly where they are. Same points, same place.`
      : `<b>${aName}</b> would have <b class="${tone(dPts)}">${dPts === 0 ? "the same number of" : `${Math.abs(dPts)} ${dPts > 0 ? "more" : "fewer"}`} points</b>${dRank === 0 ? ` and still sit ${ordinal(swap.rank)}` : ` and ${dRank > 0 ? "climb" : "drop"} from <b>${ordinal(real.rank)}</b> to <b class="${tone(dRank)}">${ordinal(swap.rank)}</b>`} with <b>${bName}</b>'s schedule.`;
  return `
    <div class="sw-compare">
      <div class="sw-side"><small>Actual schedule</small><b class="sw-rec">${rec(real)}</b><span>${real.pts} pts · ${ordinal(real.rank)}</span></div>
      <div class="sw-arrow" aria-hidden="true">→</div>
      <div class="sw-side swapped"><small>With ${bName}'s schedule</small><b class="sw-rec">${rec(swap)}</b><span>${swap.pts} pts · ${ordinal(swap.rank)}</span></div>
      <div class="sw-delta ${tone(dPts)}"><b>${signed(dPts)}</b><small>points</small></div>
    </div>
    <p class="sw-sentence">${sentence}</p>`;
}

function weeksHtml(a, b, ctx, managers) {
  const rows = ctx.matrix[a][b].weeks.map((w) => {
    const changed = w.opp !== w.realOpp;
    return `
      <tr class="${changed && w.result !== w.realResult ? "sw-flip" : ""}">
        <td>${w.gw}</td>
        <td>${w.score}</td>
        <td class="text-left">${managers.clubHtml(w.realOpp)} <small class="sw-dim">${w.realOppScore}</small></td>
        <td><span class="sw-res ${w.realResult}">${w.realResult}</span></td>
        <td class="text-left">${changed ? managers.clubHtml(w.opp) : `<span class="sw-dim">same opponent</span>`} ${changed ? `<small class="sw-dim">${w.oppScore}</small>` : ""}</td>
        <td><span class="sw-res ${w.result}">${w.result}</span></td>
      </tr>`;
  }).join("");
  return `
    <div class="card sw-scroll"><table>
      <thead><tr><th>GW</th><th>Score</th><th class="text-left" colspan="2">Actual opponent</th><th class="text-left" colspan="2">Swapped opponent</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="sw-note">Only this manager's results change — everyone else's record stays as it really is, so the swapped finish is an estimate. If the other schedule would have had them facing themselves that week, they face the schedule's owner instead. Highlighted rows are results that flip.</p>`;
}

function drawHtml(ctx, managers) {
  const byId = new Map(ctx.schedules.map((s) => [s.managerId, s]));
  const kind = byId.get(ctx.easiestId);
  const cruel = byId.get(ctx.hardestId);
  const card = (cls, title, s, line) => `
    <div class="sw-callout ${cls}">
      <small>${title}</small>
      <div class="sw-callout-name">${managers.clubHtml(s.managerId)}</div>
      <b>${s.oppAvgScore}<i> pts</i></b>
      <span>${line}</span>
    </div>`;

  const max = Math.max(1, ...ctx.schedules.map((s) => Math.abs(s.scheduleLuck)));
  const ranked = [...ctx.schedules].sort((a, b) => b.scheduleLuck - a.scheduleLuck);
  const bars = ranked.map((s) => {
    const pct = (Math.abs(s.scheduleLuck) / max) * 100;
    const cls = tone(s.scheduleLuck);
    const word = s.scheduleLuck > 0 ? "lucky" : s.scheduleLuck < 0 ? "unlucky" : "neutral";
    return `
      <div class="sw-bar-row" title="${Math.abs(s.scheduleLuck)} points ${s.scheduleLuck >= 0 ? "better" : "worse"} than their scores would earn on an average schedule">
        <div class="sw-bar-name">${managers.clubHtml(s.managerId)}</div>
        <div class="sw-bar-track"><i class="sw-bar-mid"></i>
          <span class="sw-bar ${cls}" style="width:${(pct / 2).toFixed(1)}%;${s.scheduleLuck >= 0 ? "left:50%" : "right:50%"}"></span>
        </div>
        <div class="sw-bar-val ${cls}">${signed(s.scheduleLuck)}<small>${word}</small></div>
      </div>`;
  }).join("");

  const detail = ctx.schedules.map((s) => `
    <tr><td class="text-left">${managers.clubHtml(s.managerId)}</td><td>${s.oppAvgScore ?? "–"}</td><td>${s.actualPts}</td><td>${s.avgPtsOnAnySchedule.toFixed(1)}</td></tr>`).join("");

  return `
    <h3 class="sw-h3">Who's had the kindest and cruelest draw?</h3>
    <div class="sw-callouts">
      ${card("kind", "Kindest schedule", kind, `Opponents averaged just ${kind.oppAvgScore} a week — the league average is ${ctx.leagueAvgScore}.`)}
      ${card("cruel", "Cruelest schedule", cruel, `Opponents averaged ${cruel.oppAvgScore} a week — the league average is ${ctx.leagueAvgScore}.`)}
    </div>
    <h3 class="sw-h3">Points gained or lost to the schedule</h3>
    <div class="card sw-bars">
      <p class="sw-bars-lead">Each manager's real points compared with what the <b>same scores</b> would have earned on an average schedule. Green means the draw helped them; red means it hurt.</p>
      ${bars}
    </div>
    <details class="sw-more"><summary>See the full numbers</summary>
      <div class="card sw-scroll"><table>
        <thead><tr><th class="text-left">Manager</th><th title="Average score of the opponents they faced">Opponents' avg score</th><th>Actual points</th><th title="Points the same scores would earn on an average schedule">Points on an average schedule</th></tr></thead>
        <tbody>${detail}</tbody>
      </table></div>
    </details>`;
}

export function render(container, data, managers) {
  const ctx = data.scheduleSwap;
  if (!ctx || !ctx.gws?.length) {
    container.innerHTML = `<h2 class="section-title">Schedule Swap</h2><div class="card"><p style="padding:1rem">Check back once a gameweek has finished.</p></div>`;
    return;
  }
  const mineId = managers.idForPersonKey(getIdentity());
  const ids = ctx.managerIds;
  const label = (id) => escapeHtml(clean(managers.name(id)));
  const byName = [...ids].sort((x, y) => clean(managers.name(x)).localeCompare(clean(managers.name(y))));

  const aOpts = byName.map((id) => `<option value="${id}">${label(id)}</option>`).join("");
  const bOpts = `
    <optgroup label="Quick picks">
      <option value="easy">Easiest schedule (${label(ctx.easiestId)})</option>
      <option value="hard">Hardest schedule (${label(ctx.hardestId)})</option>
    </optgroup>
    <optgroup label="A specific manager's schedule">${aOpts}</optgroup>`;

  container.innerHTML = `
    <div class="sw-page">
      <h2 class="section-title">Schedule Swap</h2>
      <p class="section-subtitle">Same scores, different opponents. Pick a manager and a schedule to see how their season would have gone — or find out who's had the kindest and cruelest draws.</p>
      <div class="card sw-controls">
        <label>This manager<select id="sw-a">${aOpts}</select></label>
        <span class="sw-with">had the</span>
        <label>Schedule of<select id="sw-b">${bOpts}</select></label>
      </div>
      <div class="card sw-result" id="sw-result"></div>
      <div id="sw-weeks"></div>
      ${drawHtml(ctx, managers)}
    </div>`;

  const aEl = container.querySelector("#sw-a");
  const bEl = container.querySelector("#sw-b");
  aEl.value = String(ids.includes(mineId) ? mineId : byName[0]);
  bEl.value = "easy";

  const draw = () => {
    const a = Number(aEl.value);
    const b = bEl.value === "easy" ? ctx.easiestId : bEl.value === "hard" ? ctx.hardestId : Number(bEl.value);
    container.querySelector("#sw-result").innerHTML = summaryHtml(a, b, ctx, managers);
    container.querySelector("#sw-weeks").innerHTML = a === b ? "" : weeksHtml(a, b, ctx, managers);
  };
  aEl.addEventListener("change", draw);
  bEl.addEventListener("change", draw);
  draw();
}
