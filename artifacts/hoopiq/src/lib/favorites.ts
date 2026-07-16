// Local persistence for the Favorites feature.
//
// Plain browser localStorage only — no backend. Favorites are global
// (keyed by player id, not scoped to a game), since a favorited player
// stays favorited across every game/page they show up in.

const STORAGE_KEY = "hoopiq:favorites";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getStoredFavoriteIds(): string[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function setStoredFavoriteIds(ids: string[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}
