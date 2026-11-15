const KEY = 'cloud-tycoon:v2';

export interface Progress {
  /** Best stars per mission id. A mission with stars has been completed. */
  stars: Record<string, number>;
  /** Codex entries discovered across all play. */
  codex: string[];
  /** The full explanation of strikes has been shown once. */
  seenStrikeIntro: boolean;
}

const EMPTY: Progress = { stars: {}, codex: [], seenStrikeIntro: false };

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    // Corrupt or unavailable storage: start fresh.
  }
  return { ...EMPTY };
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage full or disabled; progress just won't persist.
  }
}

export function clearProgress(): Progress {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore.
  }
  return { ...EMPTY };
}
