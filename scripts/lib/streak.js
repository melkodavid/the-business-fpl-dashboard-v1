// Given a chronological list of 'W'/'L'/'D' results, returns the trailing run
// of identical results, e.g. ['W','W','L','W','W','W'] -> { type: 'W', count: 3 }.
// Used for both the main standings' "current streak" and the H2H grid's
// per-matchup streak.
export function currentStreak(resultsInOrder) {
  if (resultsInOrder.length === 0) return null;
  const last = resultsInOrder[resultsInOrder.length - 1];
  let count = 0;
  for (let i = resultsInOrder.length - 1; i >= 0 && resultsInOrder[i] === last; i--) count++;
  return { type: last, count };
}
