// Client-side "recent form" tracking.
//
// The ESPN endpoints this app calls only ever return *today's* games
// (see providers/espn.js) — there's no historical schedule/game-log
// endpoint wired up, and per project constraints we're not adding one.
// So "last 5 games" here means the last games *viewed inside this app*
// on this device, not a full season log. Every time a box score loads,
// we snapshot each player's fantasy points for that game (deduped by
// game id) into localStorage. Over days of normal use this naturally
// builds into a genuine recent-form history.

export type PlayerGameEntry = {
  gameId: string;
  fpts: number;
  timestamp: number;
};

const STORAGE_KEY = "hoopiq:player-history";
const MAX_ENTRIES_PER_PLAYER = 8;
const DISPLAY_COUNT = 5;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readAll(): Record<string, PlayerGameEntry[]> {
  if (!hasStorage()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, PlayerGameEntry[]>): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/**
 * Records (or refreshes) each player's fantasy points for a specific
 * game. Safe to call every time a box score loads — re-viewing the same
 * game just updates that game's entry instead of duplicating it.
 */
export function recordPlayerGames(
  entries: { playerId: string; fpts: number }[],
  gameId: string,
  timestamp: number,
): void {
  if (!gameId || entries.length === 0) return;
  const all = readAll();
  for (const { playerId, fpts } of entries) {
    if (!playerId) continue;
    const existing = (all[playerId] ?? []).filter((e) => e.gameId !== gameId);
    existing.push({ gameId, fpts, timestamp });
    existing.sort((a, b) => a.timestamp - b.timestamp);
    all[playerId] = existing.slice(-MAX_ENTRIES_PER_PLAYER);
  }
  writeAll(all);
}

/** Returns up to the last 5 recorded games for a player, oldest first. */
export function getRecentForm(playerId: string): PlayerGameEntry[] {
  const entries = readAll()[playerId] ?? [];
  return entries.slice(-DISPLAY_COUNT);
}

/**
 * Returns every locally tracked game for a player (up to
 * MAX_ENTRIES_PER_PLAYER), oldest first. Used as the basis for a "season
 * average" — there's no real season-log endpoint wired up (see header
 * comment), so this is the honest, locally-available proxy: the average
 * across every game this player has appeared in while using this app.
 */
export function getAllTrackedGames(playerId: string): PlayerGameEntry[] {
  return readAll()[playerId] ?? [];
}
