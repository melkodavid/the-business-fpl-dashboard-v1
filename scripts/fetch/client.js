const BASE_URL = "https://draft.premierleague.com/api";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Thin wrapper around the Draft API: builds the URL, retries transient
// failures with backoff, and returns parsed JSON.
export async function apiGet(path) {
  const url = `${BASE_URL}${path}`;
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts: ${lastError.message}`);
}
