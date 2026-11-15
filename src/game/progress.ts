const KEY = 'cloud-tycoon:v1';

export interface Progress {
  /** Best stars per chapter id. */
  stars: Record<number, number>;
  /** Codex entries discovered across all play. */
  codex: string[];
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { stars: {}, codex: [], ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return { stars: {}, codex: [] };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage full or disabled; progress just won't persist.
  }
}
