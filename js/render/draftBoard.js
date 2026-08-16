import { escapeHtml } from "../format.js";

// Module-level so a re-render (revisiting this page) clears the previous
// tick loop instead of stacking a second one on top of it.
let countdownTimer = null;

function partsUntil(target) {
  const diff = Math.max(0, target.getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: diff <= 0,
  };
}

function unitHtml(value, label) {
  return `
    <div class="countdown-unit">
      <span class="countdown-value">${String(value).padStart(2, "0")}</span>
      <span class="countdown-label">${label}</span>
    </div>`;
}

function countdownHtml(parts) {
  if (parts.done) return `<p class="countdown-done">The draft is starting — good luck.</p>`;
  return `
    <div class="countdown">
      ${unitHtml(parts.days, "Days")}
      ${unitHtml(parts.hours, "Hrs")}
      ${unitHtml(parts.minutes, "Min")}
      ${unitHtml(parts.seconds, "Sec")}
    </div>`;
}

// Standard FPL Draft squad size (2 GKP / 5 DEF / 5 MID / 3 FWD) -- only used
// to shape the empty pre-draft grid below. Once real picks exist, the board
// is driven entirely by actual data and this is never consulted.
const PLACEHOLDER_ROUNDS = 15;

function placeholderBoardHtml(managerCount) {
  const headerHtml = Array.from(
    { length: managerCount },
    () => `<th><span class="draft-col-name draft-col-unknown">?</span></th>`
  ).join("");

  const rowsHtml = Array.from({ length: PLACEHOLDER_ROUNDS }, (_, i) => {
    const cellsHtml = Array.from({ length: managerCount }, () => `<td class="empty-state">—</td>`).join("");
    return `<tr><th class="text-left">R${i + 1}</th>${cellsHtml}</tr>`;
  }).join("");

  return `
    <div class="card draft-board-card">
      <table class="draft-board-table">
        <thead><tr><th></th>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

// Official Premier League player-photo CDN, keyed by each player's stable
// `code` field from bootstrap-static -- same source the real FPL site uses,
// so every player is covered with no uploads or hosting of our own.
function playerPhotoHtml(code) {
  if (!code) return "";
  const src = `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;
  return `<img class="draft-pick-photo" src="${src}" alt="" onerror="this.remove()">`;
}

function boardTableHtml(board, managers) {
  const headerHtml = board.slots
    .map(
      (id) => `
      <th>
        ${managers.avatarHtml(id)}
        <div class="draft-col-name">${escapeHtml(managers.shortName(id))}</div>
      </th>`
    )
    .join("");

  const rowsHtml = board.rounds
    .map((r) => {
      const cellsHtml = r.cells
        .map((cell) => {
          if (!cell) return `<td class="empty-state">—</td>`;
          const positionTag = cell.position
            ? `<span class="draft-pick-pos">${escapeHtml(cell.position)}</span>`
            : "";
          return `
            <td>
              <span class="draft-pick-num">#${cell.index}</span>
              ${playerPhotoHtml(cell.playerCode)}
              <span class="draft-pick-player">${escapeHtml(cell.playerName)}</span>
              ${positionTag}
            </td>`;
        })
        .join("");
      return `<tr><th class="text-left">R${r.round}</th>${cellsHtml}</tr>`;
    })
    .join("");

  return `
    <div class="card draft-board-card">
      <table class="draft-board-table">
        <thead><tr><th></th>${headerHtml}</tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

export function render(container, data, managers) {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  const { draftDt, draftStarted, draftCompleted } = data.meta ?? {};
  const board = data.draftBoard ?? { started: false, slots: [], rounds: [] };
  const target = draftDt ? new Date(draftDt) : null;
  const showCountdown = !board.started && target && !draftStarted;

  const kicker = draftCompleted ? "Final Draft Board" : board.started ? "Draft In Progress" : "Countdown To The Draft";

  container.innerHTML = `
    <div class="schedule-luxury draft-central">
      <div class="hero-block">
        <div class="giant-mark" aria-hidden="true">X</div>
        <div class="hero-content">
          <span class="eyebrow">${kicker}</span>
          <span class="title-line-2">The Draft</span>
          <span class="est-line">The Business &middot; Snake Draft</span>
          <div class="hero-rule"><span></span><span class="dot"></span><span></span></div>
        </div>
      </div>

      ${showCountdown ? `<div id="draftCountdown"></div>` : ""}

      ${board.started ? boardTableHtml(board, managers) : placeholderBoardHtml(managers.all.length)}
    </div>
  `;

  if (showCountdown) {
    const el = container.querySelector("#draftCountdown");
    const tick = () => {
      const parts = partsUntil(target);
      el.innerHTML = countdownHtml(parts);
      if (parts.done) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }
}
