// Local persistence for the Player Comparison feature.
//
// Plain browser localStorage only — no backend. Selected player ids are
// scoped per game (a comparison only ever spans the two teams playing
// in one game), so refreshing or reopening a game restores exactly the
// players that were being compared for that game.

export const MAX_COMPARE_PLAYERS = 4;

const STORAGE_PREFIX = "hoopiq:compare:";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function storageKey(gameId: string): string {
  return `${STORAGE_PREFIX}${gameId}`;
}

export function getStoredComparisonIds(gameId: string): string[] {
  if (!hasStorage() || !gameId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(gameId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function setStoredComparisonIds(gameId: string, ids: string[]): void {
  if (!hasStorage() || !gameId) return;
  window.localStorage.setItem(storageKey(gameId), JSON.stringify(ids));
}
