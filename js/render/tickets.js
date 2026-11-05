// "Tickets" -- the league's suggestion box. Anyone can file an idea, a bug or a
// bit of banter for the site; everyone sees the board and can "me too" a
// ticket. Tickets live in the Tickets tab of the league's Google Sheet (see
// scripts/predictions/Code.gs), where the commissioner sets each one's status
// and can type a reply that shows here. Styles: css/style.css, .tk-*.
import { escapeHtml } from "../format.js";
import { getIdentity } from "../identity.js";

const TYPES = {
  feature: { icon: "💡", label: "New feature" },
  bug: { icon: "🐛", label: "Something's broken" },
  design: { icon: "🎨", label: "Design tweak" },
  banter: { icon: "😂", label: "Banter idea" },
  other: { icon: "💬", label: "Other" },
};
const PRIORITIES = { nice: "Nice to have", want: "Want it", need: "Need it" };
const FILTERS = [["open", "Open"], ["New", "New"], ["Planned", "Planned"], ["In progress", "In progress"], ["Done", "Done"], ["Won't do", "Won't do"], ["all", "All"]];
const isOpen = (t) => t.status !== "Done" && t.status !== "Won't do";
const statusClass = (s) => s.toLowerCase().replace(/[^a-z]+/g, "-");
const ticketNo = (id) => `#${String(id).padStart(3, "0")}`;

let filter = "open";
let sort = "votes";
let justFiled = null; // the ticket this visitor just sent, kept highlighted

function agoText(iso) {
  if (!iso) return "";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days} days ago` : new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function personName(managers, key) {
  const id = managers.idForPersonKey(key);
  return id ? managers.playerName(id).split(" ")[0] || key : key;
}

function ticketHtml(t, managers, me) {
  const type = TYPES[t.type] ?? TYPES.other;
  const mine = t.votes.includes(me);
  return `
    <article class="tk-card tk-st-${statusClass(t.status)}${t.id === justFiled ? " is-new" : ""}" data-id="${t.id}">
      <header class="tk-card-head">
        <span class="tk-no">${ticketNo(t.id)}</span>
        <span class="tk-type" title="${type.label}">${type.icon} ${type.label}</span>
        <span class="tk-status">${escapeHtml(t.status)}</span>
      </header>
      <h3 class="tk-title">${escapeHtml(t.title)}</h3>
      ${t.details ? `<p class="tk-details">${escapeHtml(t.details)}</p>` : ""}
      ${t.reply ? `<div class="tk-reply"><b>From the commissioner</b><p>${escapeHtml(t.reply)}</p></div>` : ""}
      <footer class="tk-card-foot">
        <span class="tk-meta">${escapeHtml(personName(managers, t.person))} · ${agoText(t.createdAt)} · ${PRIORITIES[t.priority] ?? ""}</span>
        <button type="button" class="tk-vote${mine ? " is-mine" : ""}" data-vote="${t.id}" aria-pressed="${mine}" title="${mine ? "Take back your vote" : "Me too: I want this as well"}">
          ▲ <b>${t.votes.length}</b> <span>${mine ? "You +1'd" : "Me too"}</span>
        </button>
      </footer>
    </article>`;
}

function boardHtml(tickets, managers, me) {
  const shown = tickets
    .filter((t) => (filter === "all" ? true : filter === "open" ? isOpen(t) : t.status === filter))
    .sort((a, b) => (sort === "votes" ? b.votes.length - a.votes.length || b.id - a.id : b.id - a.id));
  const count = (f) => tickets.filter((t) => (f === "all" ? true : f === "open" ? isOpen(t) : t.status === f)).length;
  return `
    <div class="tk-filters" role="tablist">
      ${FILTERS.map(([key, label]) => `<button type="button" class="tk-filter" data-filter="${key}" aria-pressed="${filter === key}">${label} <i>${count(key)}</i></button>`).join("")}
      <label class="tk-sort">Sort <select data-sort><option value="votes"${sort === "votes" ? " selected" : ""}>Most wanted</option><option value="new"${sort === "new" ? " selected" : ""}>Newest</option></select></label>
    </div>
    <div class="tk-list">${shown.length ? shown.map((t) => ticketHtml(t, managers, me)).join("") : `<p class="tk-empty">${tickets.length ? "Nothing in this pile." : "No tickets yet. Be the first!"}</p>`}</div>`;
}

function formHtml(managers, me) {
  const people = [...managers.all].sort((a, b) => a.playerName.localeCompare(b.playerName));
  return `
    <form class="tk-form card" novalidate>
      <h3 class="tk-form-title">File a ticket</h3>
      <label class="tk-field">Who's asking?
        <select name="person" required>
          <option value="">Choose your name…</option>
          ${people.map((m) => `<option value="${m.personKey}"${m.personKey === me ? " selected" : ""}>${escapeHtml(m.playerName)}</option>`).join("")}
        </select>
      </label>
      <fieldset class="tk-field tk-types"><legend>What kind of thing?</legend>
        ${Object.entries(TYPES).map(([key, t], i) => `<label class="tk-chip"><input type="radio" name="type" value="${key}"${i === 0 ? " checked" : ""}><span>${t.icon} ${t.label}</span></label>`).join("")}
      </fieldset>
      <label class="tk-field">In a few words
        <input name="title" maxlength="90" placeholder="e.g. A page for the best trades ever" required autocomplete="off">
      </label>
      <label class="tk-field">Tell me more <small>(optional)</small>
        <textarea name="details" rows="4" maxlength="1500" placeholder="What should it do? Where would it go? Any examples?"></textarea>
      </label>
      <fieldset class="tk-field tk-types"><legend>How badly do you want it?</legend>
        ${Object.entries(PRIORITIES).map(([key, label], i) => `<label class="tk-chip"><input type="radio" name="priority" value="${key}"${i === 0 ? " checked" : ""}><span>${label}</span></label>`).join("")}
      </fieldset>
      <button type="submit" class="tk-submit">Send ticket</button>
      <p class="tk-msg" role="status"></p>
    </form>`;
}

export function render(container, data, managers) {
  const endpoint = data.predictionsConfig?.endpoint;
  const me = getIdentity();
  container.innerHTML = `
    <div class="tk">
      <header class="tk-hero">
        <p class="tk-eyebrow">Support desk</p>
        <h2 class="tk-h">Got an idea for the site? File a ticket.</h2>
        <p class="tk-lead">New features, things that look broken, design tweaks, banter you want immortalised. Everything lands on the commissioner's to-do list, and you can follow it here from <b>New</b> to <b>Done</b>. See something you want too? Hit <b>Me too</b> so it moves up the pile.</p>
      </header>
      <div class="tk-layout">
        ${endpoint ? formHtml(managers, me) : `<div class="card tk-off"><p>Tickets need the league's Apps Script - see scripts/predictions/SETUP.md.</p></div>`}
        <section class="tk-board"><h3 class="tk-board-title">The board</h3><div class="tk-board-body"><p class="tk-empty">Loading tickets…</p></div></section>
      </div>
    </div>`;
  if (!endpoint) return;

  const root = container.querySelector(".tk");
  const board = root.querySelector(".tk-board-body");
  const form = root.querySelector(".tk-form");
  const msg = form.querySelector(".tk-msg");
  let tickets = [];
  const currentPerson = () => form.elements.person.value || me;
  const paint = () => { board.innerHTML = boardHtml(tickets, managers, currentPerson()); };
  const post = (body) => fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }).then((r) => r.json());

  async function load() {
    try {
      const body = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}action=tickets&t=${Date.now()}`, { cache: "no-store" }).then((r) => r.json());
      // an older copy of the Apps Script doesn't know about tickets and answers with predictions
      if (!body.ok || !Array.isArray(body.tickets)) throw new Error(body.ok ? "the league's Apps Script needs its Tickets update - see scripts/predictions/SETUP.md" : body.error);
      tickets = body.tickets;
      paint();
    } catch (err) {
      board.innerHTML = `<p class="tk-empty">Couldn't load the tickets (${escapeHtml(err.message)}).</p>`;
    }
  }

  form.elements.person.addEventListener("change", paint);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = form.elements;
    if (!f.person.value) { msg.className = "tk-msg err"; msg.textContent = "Pick your name first."; f.person.focus(); return; }
    if (f.title.value.trim().length < 3) { msg.className = "tk-msg err"; msg.textContent = "Give it a short title."; f.title.focus(); return; }
    const button = form.querySelector(".tk-submit");
    button.disabled = true; msg.className = "tk-msg"; msg.textContent = "Sending…";
    try {
      const res = await post({ action: "ticket", person: f.person.value, type: f.type.value, priority: f.priority.value, title: f.title.value.trim(), details: f.details.value.trim() });
      if (!res.ok) throw new Error(res.error || "Couldn't send it.");
      msg.className = "tk-msg ok";
      msg.textContent = `Ticket ${ticketNo(res.id)} is in. Thanks! You can follow it on the board.`;
      f.title.value = ""; f.details.value = "";
      filter = "open"; sort = "new"; justFiled = res.id;
      await load();
    } catch (err) {
      msg.className = "tk-msg err";
      msg.textContent = /Bad gameweek/.test(err.message) ? "The league's Apps Script needs its Tickets update before tickets can be sent." : err.message;
    } finally {
      button.disabled = false;
    }
  });

  root.addEventListener("click", async (e) => {
    const f = e.target.closest("[data-filter]");
    if (f) { filter = f.dataset.filter; paint(); return; }
    const v = e.target.closest("[data-vote]");
    if (!v) return;
    const person = form.elements.person.value;
    if (!person) { msg.className = "tk-msg err"; msg.textContent = "Choose your name in the form first, then you can vote."; form.elements.person.focus(); return; }
    const t = tickets.find((x) => x.id === Number(v.dataset.vote));
    if (!t) return;
    // optimistic: flip it now, settle with the sheet's answer
    t.votes = t.votes.includes(person) ? t.votes.filter((p) => p !== person) : [...t.votes, person];
    paint();
    try {
      const res = await post({ action: "vote", id: t.id, person });
      if (res.ok) { t.votes = res.votes; paint(); }
    } catch { /* keep the optimistic vote; the next load corrects it */ }
  });
  root.addEventListener("change", (e) => {
    if (e.target.matches("[data-sort]")) { sort = e.target.value; paint(); }
  });

  load();
}
