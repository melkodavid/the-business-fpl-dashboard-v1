// Shared "how much is riding on this fixture" scoring, used by This Week's
// Schedule (against the current final standings) and the narrative layer's
// bridesmaids detector (against a historical replay snapshot for a past gw).
// Pulled out to one place so both stay in sync rather than drifting apart.
export function matchImportance({ homeRank, awayRank, homeTotal, awayTotal, teamCount }) {
  const bestRank = Math.min(homeRank, awayRank);
  const worstRank = Math.max(homeRank, awayRank);
  const rankGap = worstRank - bestRank;
  const pointsGap = Math.abs(homeTotal - awayTotal);

  const inTitleRace = bestRank <= 3;
  const inBottomBattle = worstRank >= teamCount - 2;

  const proximity = 1 / (1 + rankGap) + 1 / (1 + pointsGap / 8);
  const stakes = (inTitleRace ? 1.5 : 0) + (inBottomBattle ? 1.5 : 0);
  const importance = Math.round((proximity + stakes) * 100) / 100;

  let tag = "Midtable Clash";
  if (inTitleRace) tag = "Title Six-Pointer";
  else if (inBottomBattle) tag = "Wooden Spoon Battle";
  else if (rankGap <= 1) tag = "Six-Pointer";

  return { importance, tag };
}
