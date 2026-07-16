import { getIdentity, setIdentity, clearIdentity, onIdentityChange } from "./identity.js";

let panelEl = null;
let btnEl = null;

function labelFor(managers, upcoming) {
  const key = getIdentity();
  if (!key) return "Who's watching?";
  const m = managers.all.find((mgr) => mgr.personKey === key);
  if (m) return `Viewing as: ${m.playerName ?? m.name}`;
  const rookie = upcoming.find((p) => p.personKey === key);
  return `Viewing as: ${rookie?.displayName ?? key}`;
}

// upcoming managers (see data/upcoming-managers.json) have no managerId, so
// managers.avatarHtml(id) doesn't apply -- same .mgr-avatar markup, built
// directly from their color/abbreviation instead.
function rookieAvatarHtml(person) {
  return `<span class="mgr-avatar" style="background:${person.color}"><span class="mgr-avatar-initials">${person.abbreviation}</span></span>`;
}

function closePanel() {
  panelEl.hidden = true;
  btnEl.setAttribute("aria-expanded", "false");
}

function openPanel() {
  panelEl.hidden = false;
  btnEl.setAttribute("aria-expanded", "true");
}

export function openIdentityPanel() {
  if (panelEl) openPanel();
}

export function mountIdentitySwitcher(managers, upcoming = []) {
  btnEl = document.getElementById("identity-btn");
  panelEl = document.getElementById("identity-panel");
  if (!btnEl || !panelEl) return;

  const people = [...managers.all].sort((a, b) => (a.playerName ?? a.name).localeCompare(b.playerName ?? b.name));

  panelEl.innerHTML = `
    <div class="identity-panel-inner">
      <p class="identity-panel-title">Who's watching?</p>
      <div class="identity-grid">
        ${people
          .map(
            (m) => `
          <button type="button" class="identity-option" data-person-key="${m.personKey}">
            ${managers.avatarHtml(m.id)}
            <span>${m.playerName ?? m.name}</span>
          </button>`
          )
          .join("")}
        ${upcoming
          .map(
            (p) => `
          <button type="button" class="identity-option" data-person-key="${p.personKey}">
            ${rookieAvatarHtml(p)}
            <span>${p.displayName} (Rookie)</span>
          </button>`
          )
          .join("")}
      </div>
      <button type="button" class="identity-clear" data-clear>Clear (view as everyone)</button>
    </div>
  `;

  panelEl.addEventListener("click", (e) => {
    const option = e.target.closest(".identity-option");
    if (option) {
      setIdentity(option.dataset.personKey);
      closePanel();
      return;
    }
    if (e.target.closest("[data-clear]")) {
      clearIdentity();
      closePanel();
    }
  });

  btnEl.addEventListener("click", () => {
    if (panelEl.hidden) openPanel();
    else closePanel();
  });

  document.addEventListener("click", (e) => {
    if (panelEl.hidden) return;
    if (panelEl.contains(e.target) || btnEl.contains(e.target)) return;
    closePanel();
  });

  btnEl.textContent = labelFor(managers, upcoming);
  onIdentityChange(() => {
    btnEl.textContent = labelFor(managers, upcoming);
  });
}
