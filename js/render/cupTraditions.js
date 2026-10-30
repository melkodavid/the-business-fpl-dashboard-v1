// The Grassroots Cup's traditions (see render/cup.js):
//   - the Hand-Turned Leaderboard: during a cup round, every tie's live score on
//     an old white board, one tile per letter, tiles flipping when a score
//     changes. Scores come from the same live relay and scoring as the Live page.
//   - the Champion's Blazer: the Cup's jacket, with its holder's name.
import { computeLive, cupTieLive } from "../lib/liveScoring.js";
import { blazerSvg } from "../lib/blazer.js";

const ROUND_NAME = { round1: "Round 1", round2: "Quarter-finals", round3: "Semi-finals", round4: "The Final" };
const REFRESH_MS = 60 * 1000;
let boardTimer = null;
const shown = new Map(); // tile id -> last score shown, so only changed scores flip

const boardName = (managers, id) =>
  managers.name(id).replace(/[’‘]/g, "'").replace(/[^\p{L}\p{N} '&.-]/gu, "").replace(/\s*\*+$/, "").replace(/\s+/g, " ").trim().toUpperCase().slice(0, 20);

function tiles(text) {
  return [...text].map((ch) => (ch === " " ? `<i class="sp"></i>` : `<i>${ch}</i>`)).join("");
}

function scoreTiles(id, value) {
  const text = value == null ? "-" : String(value);
  const flip = shown.has(id) && shown.get(id) !== text;
  shown.set(id, text);
  return [...text].map((ch) => `<i class="${flip ? "flip" : ""}">${ch}</i>`).join("");
}

// The cup round being played right now (drawn, not yet decided).
export function activeRound(cup) {
  if (cup?.status !== "in_progress") return null;
  const entry = Object.entries(cup.rounds ?? {}).find(([, r]) => r.draw?.length && !r.results);
  return entry ? { key: entry[0], round: entry[1] } : null;
}

function rowsHtml(ties, managers, live) {
  return ties.map((t, i) => {
    const lead = live && t.scoreA !== t.scoreB ? (t.scoreA > t.scoreB ? "a" : "b") : null;
    const row = (side, id, score) => `
      <div class="cb-row${lead === side ? " lead" : ""}">
        <span class="cb-name">${tiles(boardName(managers, id))}</span>
        <span class="cb-score">${scoreTiles(`${t.matchId}:${side}`, live ? score : null)}</span>
      </div>`;
    return `
      <div class="cb-tie">
        <p class="cb-tie-h">Tie ${i + 1}${live && t.by ? `<span> · level, ${t.by === "bench" ? "bench points" : "higher seed"} decides</span>` : ""}</p>
        ${row("a", t.managerAId, t.scoreA)}${row("b", t.managerBId, t.scoreB)}
      </div>`;
  }).join("");
}

export function leaderboardHtml(cup) {
  const active = activeRound(cup);
  if (!active) return "";
  const { key, round } = active;
  const gws = round.gws.length > 1 ? `GW${round.gws[0]} + GW${round.gws[1]}` : `GW${round.gws[0]}`;
  return `
    <section class="cup-board" data-round="${key}">
      <div class="cb-frame">
        <h2 class="cb-title">Leaders</h2>
        <p class="cb-sub">${ROUND_NAME[key]} · ${gws}</p>
        <div class="cb-body"></div>
        <p class="cb-foot">Scores go up as soon as ${gws.split(" + ")[0]} kicks off.</p>
      </div>
    </section>`;
}

// Fills the board and keeps it current while the Cup page is open.
export function runLeaderboard(root, data, managers) {
  clearInterval(boardTimer);
  const board = root.querySelector(".cup-board");
  const active = activeRound(data.cup);
  if (!board || !active) return;
  const { round } = active;
  const seeds = new Map((data.cup.seeds ?? []).map((s) => [s.managerId, s.seed]));
  const body = board.querySelector(".cb-body");
  const foot = board.querySelector(".cb-foot");
  const blank = round.draw.map((t) => ({ ...t, scoreA: null, scoreB: null }));
  body.innerHTML = rowsHtml(blank, managers, false);

  const endpoint = data.predictionsConfig?.endpoint;
  if (!endpoint) return;
  const update = async () => {
    if (!document.body.contains(board) || location.hash.replace("#", "") !== "cup") { clearInterval(boardTimer); return; }
    try {
      const payload = await fetch(`${endpoint}?action=live&t=${Date.now()}`).then((r) => r.json());
      if (!payload.ok || !Array.isArray(payload.fixtures) || !round.gws.includes(payload.gw)) return;
      const live = computeLive(payload);
      if (!live.anyStarted) return;
      const ties = round.draw.map((t) => cupTieLive(t, live.managers, { legs: round.legs ?? {}, liveGw: payload.gw, seeds }));
      body.innerHTML = rowsHtml(ties, managers, true);
      const done = payload.finished;
      foot.textContent = done ? "Final scores for the gameweek · results confirmed after the official update" : `Live · updated ${new Date(payload.fetchedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} · refreshes every minute`;
    } catch { /* offline or relay hiccup: keep what's on the board */ }
  };
  update();
  boardTimer = setInterval(() => { if (!document.hidden) update(); }, REFRESH_MS);
}

export function blazerSectionHtml(cup, managers) {
  const holder = cup?.status === "complete" && cup.champion ? managers.name(cup.champion).replace(/\s*\*+$/, "") : null;
  return `
    <section class="cup-blazer">
      <div class="cbz-art">${blazerSvg("cbz-svg")}</div>
      <div class="cbz-copy">
        <p class="cup-eyebrow">A Grassroots Cup tradition</p>
        <h2 class="cbz-title">The Champion's Blazer</h2>
        <p class="cbz-text">The Cup's own jacket. The winner wears it for a year, with their name stitched inside, and hands it on to next season's champion. Until then it's the holder's alone: a little blazer sits next to their club name everywhere on the site.</p>
        <p class="cbz-holder">${holder ? `Held by <b>${holder}</b>` : "Inaugural holder: decided at GW36"}</p>
      </div>
    </section>`;
}
