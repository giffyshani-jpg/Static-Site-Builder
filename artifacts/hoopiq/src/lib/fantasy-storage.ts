// Local persistence for the Fantasy Optimizer.
//
// Everything here is plain browser localStorage — no backend, no
// database. Credits are keyed by player id (globally, so an edit to a
// player's credits sticks no matter which game they're viewed from).
// Budget is a single global value.

export const DEFAULT_FANTASY_BUDGET = 100;

const BUDGET_KEY = "hoopiq:fantasy-budget";
const CREDITS_KEY = "hoopiq:fantasy-credits";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getStoredBudget(): number {
  if (!hasStorage()) return DEFAULT_FANTASY_BUDGET;
  const raw = window.localStorage.getItem(BUDGET_KEY);
  const parsed = raw !== null ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_FANTASY_BUDGET;
}

export function setStoredBudget(value: number): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(BUDGET_KEY, String(value));
}

function readCreditsMap(): Record<string, number> {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(CREDITS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCreditsMap(map: Record<string, number>): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(CREDITS_KEY, JSON.stringify(map));
}

/**
 * Returns the user-edited credit value for a player, or undefined if
 * they haven't customized it yet (caller should fall back to a
 * computed default).
 */
export function getStoredPlayerCredits(playerId: string): number | undefined {
  const map = readCreditsMap();
  return map[playerId];
}

export function setStoredPlayerCredits(playerId: string, credits: number): void {
  const map = readCreditsMap();
  map[playerId] = credits;
  writeCreditsMap(map);
}
