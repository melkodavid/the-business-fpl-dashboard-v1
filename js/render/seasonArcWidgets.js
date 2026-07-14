// Small "season arc" banners for the front page -- Life After Mark tracker,
// Generation War scoreboard, Gauntlet Watch. Each is only rendered when its
// underlying arc is actually active (see scripts/narrative/seasonArcs.js);
// most seasons most of these will simply be absent.
function gauntletWidget(arc, managers) {
  if (!arc) return "";
  const name = managers.name(arc.facts.managerId);
  const { wins = 0, played = 0, length, startGw } = arc.facts;
  const body =
    arc.type === "gauntlet-watch"
      ? `${name} faces ${length} straight Palladinos starting GW${startGw}.`
      : `${name} is ${wins}-for-${played} through the Palladino gauntlet.`;
  return `<div class="arc-badge arc-gauntlet"><span class="arc-badge-title">Gauntlet Watch</span><span>${body}</span></div>`;
}

function lifeAfterMarkWidget(arc, managers) {
  if (!arc) return "";
  const name = managers.name(arc.facts.managerId);
  let body;
  if (arc.type === "lu-post-mark-resolution-won") body = `${name} retains the Belt -- didn't need him after all.`;
  else if (arc.type === "lu-post-mark-resolution-eliminated") body = `${name}'s title defense ends here.`;
  else body = `${name} sits ${arc.facts.rank ?? "?"} in the table.`;
  return `<div class="arc-badge arc-mark"><span class="arc-badge-title">Life After Mark</span><span>${body}</span></div>`;
}

function generationWarWidget(arc) {
  if (!arc) return "";
  const { wins, draws, losses } = arc.oneOhOnesVsRest;
  return `<div class="arc-badge arc-genwar"><span class="arc-badge-title">Generation War: 01s vs. Everyone</span><span>${wins}-${draws}-${losses}</span></div>`;
}

export function buildSeasonArcWidgets(seasonArcs, managers) {
  if (!seasonArcs) return "";
  const widgets = [
    gauntletWidget(seasonArcs.gauntletWatch, managers),
    lifeAfterMarkWidget(seasonArcs.lifeAfterMark, managers),
    generationWarWidget(seasonArcs.generationWar),
  ].filter(Boolean);

  if (widgets.length === 0) return "";
  return `<div class="season-arc-widgets">${widgets.join("")}</div>`;
}
