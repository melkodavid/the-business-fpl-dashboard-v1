import { signed, signedClass, streakBadge } from "../format.js";
import { getIdentity } from "../identity.js";
import { openIdentityPanel } from "../identitySwitcher.js";

const RECAP_LOOKBACK = 8; // how many recent GWs to scan for "mentions of me"
const MAX_MENTIONS = 5;

function formBoxes(results) {
  return results
    .map((r) => {
      const cls = r.result === "W" ? "win" : r.result === "L" ? "loss" : "draw";
      return `<span class="form-box ${cls}" title="GW${r.gw}: ${r.result} (${r.points} pts)">${r.result}</span>`;
    })
    .join("");
}

async function fetchRecap(gw) {
  const res = await fetch(`data/recaps/gw${gw}.json`);
  if (!res.ok) return null;
  return res.json();
}

async function findRecentMentions(personKey, recapsIndex) {
  const gws = (recapsIndex?.recaps ?? [])
    .map((r) => r.gw)
    .sort((a, b) => b - a)
    .slice(0, RECAP_LOOKBACK);

  const mentions = [];
  for (const gw of gws) {
    if (mentions.length >= MAX_MENTIONS) break;
    const recap = await fetchRecap(gw);
    if (!recap) continue;
    const storylines = [recap.headline, ...recap.secondaries].filter(Boolean);
    for (const s of storylines) {
      if (mentions.length >= MAX_MENTIONS) break;
      if (s.personKeys.includes(personKey)) mentions.push({ gw, text: s.text });
    }
  }
  return mentions;
}

function promptHtml() {
  return `
    <h2 class="section-title">My Season</h2>
    <p class="section-subtitle">Pick who you are and this page tailors itself to you.</p>
    <div class="card">
      <p>No identity selected yet.</p>
      <button type="button" id="my-season-pick-btn" class="identity-btn" style="color:inherit;">Who's watching?</button>
    </div>
  `;
}

export async function render(container, data, managers) {
  const me = getIdentity();

  if (!me) {
    container.innerHTML = promptHtml();
    container.querySelector("#my-season-pick-btn").addEventListener("click", openIdentityPanel);
    // No identity-change subscription needed here: app.js's own
    // onIdentityChange(draw) already fully re-invokes this render() (with
    // the newly-picked identity) on every change, same as a route change.
    return;
  }

  const myId = managers.idForPersonKey(me);
  const standingsRow = data.standings.rows.find((r) => r.managerId === myId);
  const luck = data.allPlay.standings.find((s) => s.managerId === myId);
  const formRow = data.formGuide.rows.find((r) => r.managerId === myId);
  const fixture = data.schedule.fixtures.find((f) => f.homeManagerId === myId || f.awayManagerId === myId);

  container.innerHTML = `
    <h2 class="section-title">My Season</h2>
    <p class="section-subtitle">${managers.nameHtml(myId)}'s season at a glance.</p>

    <div class="grid-cols two">
      <div class="card">
        <h3>Table Position</h3>
        ${
          standingsRow
            ? `
          <p style="font-size:2rem;font-weight:700;margin:0;">#${standingsRow.rank}</p>
          <p class="section-subtitle">${standingsRow.won}-${standingsRow.drawn}-${standingsRow.lost} &middot; ${standingsRow.total} pts &middot; ${streakBadge(standingsRow.streak)}</p>
          <p class="section-subtitle">${standingsRow.pointsFor} for, ${standingsRow.pointsAgainst} against</p>`
            : '<p class="empty-state">No standings data yet.</p>'
        }
      </div>
      <div class="card">
        <h3>Form &amp; Luck</h3>
        ${formRow ? `<div class="form-strip">${formBoxes(formRow.results)}</div><p class="section-subtitle">Avg ${formRow.avgPoints} pts, <span class="${signedClass(formRow.diffFromLeagueAvg)}">${signed(formRow.diffFromLeagueAvg)}</span> vs. league</p>` : '<p class="empty-state">No form data yet.</p>'}
        ${luck ? `<p class="section-subtitle">Luck score: <span class="${signedClass(luck.luckScore)}">${signed(luck.luckScore)}</span> (${luck.actualWins} actual wins vs. ${luck.expectedWins.toFixed(1)} expected)</p>` : ""}
      </div>
    </div>

    ${
      fixture
        ? `
      <div class="card">
        <h3>${data.schedule.seasonComplete ? "Final Fixture" : "This Week's Fixture"}</h3>
        <p>${managers.nameHtml(fixture.homeManagerId)} vs. ${managers.nameHtml(fixture.awayManagerId)}${fixture.finished ? ` &middot; ${fixture.homePoints}-${fixture.awayPoints}` : ""}</p>
      </div>`
        : ""
    }

    <div class="card">
      <h3>Recently, About You</h3>
      <div id="my-season-mentions"><p class="empty-state">Checking recent recaps…</p></div>
    </div>
  `;

  const mentionsHost = container.querySelector("#my-season-mentions");
  const mentions = await findRecentMentions(me, data.recapsIndex);
  if (!container.isConnected) return; // navigated away while the fetches were in flight
  mentionsHost.innerHTML = mentions.length
    ? `<ul class="recap-secondaries" style="margin:0;padding-left:1.1rem;">${mentions.map((m) => `<li>GW${m.gw}: ${m.text}</li>`).join("")}</ul>`
    : '<p class="empty-state">No mentions in the last few gameweeks.</p>';
}
