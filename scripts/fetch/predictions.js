// Pulls the revealed picks (gameweeks whose deadline has passed) from the shared
// predictions sheet -- see scripts/predictions/Code.gs. Returns null on any
// failure so the build can keep the previous predictions.json instead of
// wiping the table.
export async function fetchRevealedPicks(endpoint) {
  if (!endpoint) return null;
  try {
    const response = await fetch(`${endpoint}${endpoint.includes("?") ? "&" : "?"}action=picks`, { signal: AbortSignal.timeout(30000), redirect: "follow" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const body = await response.json();
    if (!body.ok || !Array.isArray(body.picks)) throw new Error(body.error ?? "unexpected response");
    return body.picks
      .map((p) => ({ gw: Number(p.gw), person: String(p.person), fixture: String(p.fixture), pick: String(p.pick) }))
      .filter((p) => p.gw > 0 && /^[HDA]$/.test(p.pick));
  } catch (error) {
    console.warn(`Predictions skipped: ${error.message}`);
    return null;
  }
}
