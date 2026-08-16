// The Draft Board — a classic snake-draft grid (round x team). Column order
// is fixed to each manager's round-1 slot (their real draft position) rather
// than the alternating snake order, so a manager's whole draft reads down
// one column even though picks 2, 4, 6... within a round actually happened
// in reverse. Returns `started: false` before any pick exists, so the
// front end can show a countdown/placeholder instead of an empty grid.
export function computeDraftBoard(context) {
  const choices = context.draftChoices;
  if (choices.length === 0) {
    return { started: false, slots: [], rounds: [] };
  }

  const slots = choices
    .filter((c) => c.round === 1)
    .sort((a, b) => a.pick - b.pick)
    .map((c) => c.managerId);
  const slotIndex = new Map(slots.map((managerId, i) => [managerId, i]));

  const maxRound = Math.max(...choices.map((c) => c.round));
  const rounds = [];
  for (let round = 1; round <= maxRound; round++) {
    const cells = new Array(slots.length).fill(null);
    for (const c of choices.filter((c) => c.round === round)) {
      const col = slotIndex.get(c.managerId);
      if (col === undefined) continue;
      const player = context.players.byId.get(c.elementId);
      cells[col] = {
        index: c.index,
        managerId: c.managerId,
        playerName: player?.webName ?? "Unknown",
        playerCode: player?.code ?? null,
        position: player?.positionName ?? null,
        teamName: player?.teamName ?? null,
      };
    }
    rounds.push({ round, cells });
  }

  return { started: true, slots, rounds };
}
