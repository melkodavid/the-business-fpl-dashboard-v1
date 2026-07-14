// LORE-DRIVEN — fires whenever noah completes a trade, again whenever one of
// his trades goes negative, and surfaces his running season net trade value
// whenever that running total itself is negative. Tolerates noah not being
// personKey-present this season (returns nothing rather than throwing).
export function detectNoahTradeDesk(context, tradeLedger) {
  const storylines = [];
  const noah = context.managers.list.find((m) => m.personKey === "noah");
  if (!noah) return storylines;

  let runningTotal = 0;
  const sortedLog = [...tradeLedger.log].sort((a, b) => a.gw - b.gw);

  for (const trade of sortedLog) {
    const side = trade.sides.find((s) => s.managerId === noah.id);
    if (!side) continue;

    storylines.push({
      type: "noah-trade-desk-entered",
      personKeys: ["noah"],
      facts: { tradeId: trade.tradeId, netValue: side.netValue },
      baseWeight: 3,
      gw: trade.gw,
      dedupeKey: `noah-trade-desk-entered:${trade.tradeId}`,
    });

    runningTotal += side.netValue;

    if (side.netValue < 0) {
      storylines.push({
        type: "noah-trade-desk-negative",
        personKeys: ["noah"],
        facts: { tradeId: trade.tradeId, netValue: side.netValue, runningTotal },
        baseWeight: 3,
        gw: trade.gw,
        dedupeKey: `noah-trade-desk-negative:${trade.tradeId}`,
      });
    }

    if (runningTotal < 0) {
      storylines.push({
        type: "noah-trade-desk-running-total",
        personKeys: ["noah"],
        facts: { runningTotal },
        baseWeight: 2,
        gw: trade.gw,
        dedupeKey: `noah-trade-desk-running-total:${trade.gw}`,
      });
    }
  }

  return storylines;
}
