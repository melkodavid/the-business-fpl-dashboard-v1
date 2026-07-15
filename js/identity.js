// "Who's watching?" identity — no password, just a personKey remembered
// locally so a manager can tailor the site to themselves. Deliberately keyed
// by personKey (not managerId): identity is a person concept and should
// survive team-name/manager-id churn across seasons, same reasoning as
// manager-profiles.json and league-lore.json.
const STORAGE_KEY = "fpl-identity";
const EVENT_NAME = "fpl:identitychange";

export function getIdentity() {
  return localStorage.getItem(STORAGE_KEY) || null;
}

export function setIdentity(personKey) {
  localStorage.setItem(STORAGE_KEY, personKey);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { personKey } }));
}

export function clearIdentity() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { personKey: null } }));
}

// Returns an unsubscribe function.
export function onIdentityChange(fn) {
  window.addEventListener(EVENT_NAME, fn);
  return () => window.removeEventListener(EVENT_NAME, fn);
}
