// Merges draft picks, transactions, and trades into one chronological log of
// "manager X gained/lost player P at gameweek G" events. tradeLedger.js and
// waiverHitRate.js both use tenureEndGw() to find how long a manager kept a
// player after acquiring them, without needing a full per-GW roster snapshot.
export function buildRosterEvents(context) {
  const events = [];

  // Draft picks are locked in before the season starts, effective from GW1.
  for (const pick of context.draftChoices) {
    events.push({ gw: 1, managerId: pick.managerId, elementId: pick.elementId, type: "join", source: "draft" });
  }

  for (const t of context.transactions) {
    if (t.result !== "a") continue; // only approved moves actually changed a roster
    if (t.elementIn != null) {
      events.push({ gw: t.event, managerId: t.managerId, elementId: t.elementIn, type: "join", source: "transaction" });
    }
    if (t.elementOut != null) {
      events.push({ gw: t.event, managerId: t.managerId, elementId: t.elementOut, type: "leave", source: "transaction" });
    }
  }

  for (const trade of context.trades) {
    for (const side of trade.sides) {
      for (const elementId of side.playersIn) {
        events.push({ gw: trade.event, managerId: side.managerId, elementId, type: "join", source: "trade" });
      }
      for (const elementId of side.playersOut) {
        events.push({ gw: trade.event, managerId: side.managerId, elementId, type: "leave", source: "trade" });
      }
    }
  }

  events.sort((a, b) => a.gw - b.gw);

  const leavesByManagerPlayer = new Map();
  for (const e of events) {
    if (e.type !== "leave") continue;
    const key = `${e.managerId}:${e.elementId}`;
    if (!leavesByManagerPlayer.has(key)) leavesByManagerPlayer.set(key, []);
    leavesByManagerPlayer.get(key).push(e.gw);
  }
  for (const arr of leavesByManagerPlayer.values()) arr.sort((a, b) => a - b);

  // Last GW (inclusive) that `elementId` stayed on `managerId`'s roster
  // after joining at `joinGw`, or `seasonEndGw` if they never left.
  function tenureEndGw(managerId, elementId, joinGw, seasonEndGw) {
    const leaves = leavesByManagerPlayer.get(`${managerId}:${elementId}`) ?? [];
    const nextLeave = leaves.find((gw) => gw > joinGw);
    return nextLeave !== undefined ? nextLeave - 1 : seasonEndGw;
  }

  return { events, tenureEndGw };
}
