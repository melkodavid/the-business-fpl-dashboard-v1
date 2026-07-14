// Small deterministic string hash, used anywhere the narrative layer needs a
// stable "random" choice (variant selection, nickname rotation, tiebreaks)
// that must stay identical across reruns for the same inputs -- a real
// Math.random() would make recaps different every time build.js runs.
export function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (Math.imul(hash, 31) + str.charCodeAt(i)) | 0;
  return hash;
}

// Deterministic pseudo-random float in [0, 1) from a seed string.
export function seededFloat(seed) {
  return (hashString(seed) >>> 0) / 0xffffffff;
}
