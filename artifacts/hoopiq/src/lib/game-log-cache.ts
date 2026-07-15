// Client-side cache for network-sourced player game logs.
//
// This is a *performance* cache only — the source of truth is always
// ESPN's gamelog endpoint (see providers/espn.js and api.js). Unlike
// lib/player-history.ts (which builds its data from games viewed locally
// in this app), entries here are only ever written with data that came
// back from a real network request. Once an entry is older than
// CACHE_TTL_MS it's treated as stale and the caller must re-fetch.
//
// sessionStorage (not localStorage) is used deliberately: a 30–60 minute
// TTL roughly matches a single browsing session, and it avoids slowly
// accumulating stale per-player entries across days of use the way
// localStorage would.

import { PlayerGameLogEntry } from "./types";

const STORAGE_PREFIX = "hoopiq:gamelog-cache:";
const CACHE_TTL_MS = 45 * 60 * 1000; // 45 minutes — within the required 30–60 min window.

type CacheEntry = {
  fetchedAt: number;
  games: PlayerGameLogEntry[];
};

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

function cacheKey(league: "nba" | "wnba", playerId: string): string {
  return `${STORAGE_PREFIX}${league}:${playerId}`;
}

/** Returns cached games if present and fresh, otherwise null. */
export function getCachedGameLog(league: "nba" | "wnba", playerId: string): PlayerGameLogEntry[] | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(cacheKey(league, playerId));
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (!parsed || typeof parsed.fetchedAt !== "number" || !Array.isArray(parsed.games)) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed.games;
  } catch {
    return null;
  }
}

/** Stores a freshly network-fetched game log. Never call with locally-derived data. */
export function setCachedGameLog(league: "nba" | "wnba", playerId: string, games: PlayerGameLogEntry[]): void {
  if (!hasStorage()) return;
  const entry: CacheEntry = { fetchedAt: Date.now(), games };
  try {
    window.sessionStorage.setItem(cacheKey(league, playerId), JSON.stringify(entry));
  } catch {
    // Storage full/unavailable — safe to no-op, the next read just misses the cache.
  }
}
