// API service layer.
//
// This is the adapter boundary between the UI and whichever provider backs
// each league. UI components only ever import from this file — never from a
// provider module directly.
//
// Adding a new league:
//   1. Create src/providers/<league>.js implementing the provider contract.
//   2. Add an entry to PROVIDERS below.
//   3. Add an entry to LEAGUE_CONFIGS below.
//   4. Add the key to ALL_LEAGUES.
//   5. Add the key to LeagueKey in src/lib/types.ts.

import * as nbaProvider from "./providers/nba";
import * as wnbaProvider from "./providers/wnba";
import * as nblProvider from "./providers/nbl";
import * as nznblProvider from "./providers/nznbl";
import * as fibaProvider from "./providers/fiba";
import * as nbaSummerProvider from "./providers/nba-summer";

const PROVIDERS = {
  nba: nbaProvider,
  wnba: wnbaProvider,
  nbl: nblProvider,
  nznbl: nznblProvider,
  fiba: fibaProvider,
  "nba-summer": nbaSummerProvider,
};

function getProvider(league) {
  const provider = PROVIDERS[league];
  if (!provider) {
    throw new Error(`No provider registered for league "${league}"`);
  }
  return provider;
}

// ─── League metadata ──────────────────────────────────────────────────────────

/**
 * Static metadata for every supported league — used by the home page and
 * league selector to render cards, colours, and descriptions without a
 * network round-trip.
 */
export const LEAGUE_CONFIGS = {
  wnba: {
    name: "WNBA",
    fullName: "Women's National Basketball Assoc.",
    description: "Women's Professional Basketball",
    color: "orange",
    gradient: "from-orange-900 to-slate-900",
    accent: "text-orange-400",
    accentHover: "group-hover:text-orange-300",
    textLight: "text-orange-200",
    active: true,
  },
  "nba-summer": {
    name: "NBA Summer",
    fullName: "NBA Summer League",
    description: "Las Vegas Summer League",
    color: "sky",
    gradient: "from-sky-900 to-slate-900",
    accent: "text-sky-400",
    accentHover: "group-hover:text-sky-300",
    textLight: "text-sky-200",
    active: true, // Runs July in Las Vegas
  },
  nba: {
    name: "NBA",
    fullName: "National Basketball Association",
    description: "Men's Professional Basketball",
    color: "blue",
    gradient: "from-blue-900 to-slate-900",
    accent: "text-blue-400",
    accentHover: "group-hover:text-blue-300",
    textLight: "text-blue-200",
    active: false, // Regular season returns ~October
  },
  nbl: {
    name: "NBL",
    fullName: "National Basketball League",
    description: "Australian Pro Basketball",
    color: "emerald",
    gradient: "from-emerald-900 to-slate-900",
    accent: "text-emerald-400",
    accentHover: "group-hover:text-emerald-300",
    textLight: "text-emerald-200",
    active: false, // Season starts October 2026
  },
  nznbl: {
    name: "NZ NBL",
    fullName: "New Zealand NBL",
    description: "New Zealand Pro Basketball",
    color: "teal",
    gradient: "from-teal-900 to-slate-900",
    accent: "text-teal-400",
    accentHover: "group-hover:text-teal-300",
    textLight: "text-teal-200",
    active: true, // Season runs May–August; games confirmed July 2026
  },
  fiba: {
    name: "FIBA",
    fullName: "International Basketball Federation",
    description: "International Competitions",
    color: "violet",
    gradient: "from-violet-900 to-slate-900",
    accent: "text-violet-400",
    accentHover: "group-hover:text-violet-300",
    textLight: "text-violet-200",
    active: true,
  },
};

/**
 * Ordered list of leagues shown on the home page.
 * Data source status (July 2026):
 *   nba        → ESPN (off-season, next game Oct 2026)
 *   wnba       → ESPN (live ✅)
 *   nba-summer → ESPN NBA type-3 filter + NBA CDN fallback (active ✅)
 *   nbl        → ESPN (off-season, next game Oct 2026)
 *   nznbl      → TheSportsDB ID 5066 (in-season ✅)
 *   fiba       → ESPN (varies by tournament)
 */

/** NBA and WNBA — rendered as full-width premium cards on the home page. */
export const PRIMARY_LEAGUES = ["nba", "wnba"];

/**
 * Secondary leagues — grouped under "Other Basketball" on the home page.
 * Summer League is rendered conditionally (only when it has live/upcoming games).
 */
export const SECONDARY_LEAGUES = ["nbl", "nznbl", "fiba", "nba-summer"];

/** Full ordered list — used internally (data fetching, routing). */
export const ALL_LEAGUES = [
  ...PRIMARY_LEAGUES,
  ...SECONDARY_LEAGUES,
];

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const EMPTY_OVERVIEW = { live: [], upcoming: [], lastPlayed: null };

/**
 * Wraps a provider call with a graceful fallback so no single provider
 * failure can crash the home page or league page.
 */
async function safeCall(fn, fallback, label) {
  try {
    return (await fn()) ?? fallback;
  } catch (err) {
    console.error(`[api] ${label} failed:`, err?.message ?? err);
    return fallback;
  }
}

// ── League overview cache ─────────────────────────────────────────────────────
//
// fetchLeagueOverview with scan:true can hit dozens of ESPN endpoints. Cache the
// result per (league × scan flag) for 2 minutes so navigating back and forth
// between the home page and league page doesn't retrigger the full scan.
//
// Two layers:
//   1. In-memory Map<key, {data, fetchedAt}> — fastest, cleared on page reload.
//   2. sessionStorage JSON — survives component unmount/remount within the session.
//
// If two calls arrive simultaneously with the same key the in-flight Map coalesces
// them into a single network request so only one fetch happens regardless of how
// many components mount at the same time.

const OVERVIEW_CACHE_TTL = 2 * 60 * 1000; // 2 minutes
const OVERVIEW_MEM_CACHE = new Map(); // key → { data, fetchedAt }
const OVERVIEW_IN_FLIGHT = new Map(); // key → Promise

function overviewCacheKey(league, scan) {
  return `${league}:${scan ? "1" : "0"}`;
}

function getOverviewFromCache(key) {
  // 1. Memory
  const mem = OVERVIEW_MEM_CACHE.get(key);
  if (mem && Date.now() - mem.fetchedAt < OVERVIEW_CACHE_TTL) return mem.data;
  // 2. sessionStorage
  try {
    const raw = sessionStorage.getItem("hoopiq:overview:" + key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.fetchedAt < OVERVIEW_CACHE_TTL) {
        OVERVIEW_MEM_CACHE.set(key, parsed); // promote to memory
        return parsed.data;
      }
    }
  } catch {}
  return null;
}

function setOverviewCache(key, data) {
  const entry = { data, fetchedAt: Date.now() };
  OVERVIEW_MEM_CACHE.set(key, entry);
  try {
    sessionStorage.setItem("hoopiq:overview:" + key, JSON.stringify(entry));
  } catch {}
}

/**
 * Today's games for a league.
 * @param {string} league
 */
export async function fetchGamesByLeague(league) {
  return safeCall(() => getProvider(league).getTodayGames(), [], `fetchGamesByLeague(${league})`);
}

/**
 * Games for a specific YYYYMMDD date.
 * @param {string} league
 * @param {string} dateStr
 */
export async function fetchGamesByLeagueAndDate(league, dateStr) {
  const provider = getProvider(league);
  const fn = provider.getGamesByDate ?? provider.getTodayGames;
  return safeCall(() => fn(dateStr), [], `fetchGamesByLeagueAndDate(${league}, ${dateStr})`);
}

/**
 * Timezone-safe league overview: { live, upcoming, lastPlayed }.
 *
 * Uses the provider's own status field — never local calendar dates — so a
 * currently-live game always appears as live regardless of viewer timezone.
 *
 * scan: true (default) — searches forward/backward to find upcoming/last
 * game even during off-season gaps. Use scan: false on the home page for a
 * fast first paint.
 *
 * @param {string} league
 * @param {{ scan?: boolean }} [options]
 */
export async function fetchLeagueOverview(league, options) {
  const scan = options?.scan ?? false;
  const key = overviewCacheKey(league, scan);

  // Return cached data when fresh.
  const cached = getOverviewFromCache(key);
  if (cached) return cached;

  // Coalesce concurrent requests — only one network call per key at a time.
  if (OVERVIEW_IN_FLIGHT.has(key)) return OVERVIEW_IN_FLIGHT.get(key);

  const promise = safeCall(
    () => getProvider(league).getLeagueOverview(options),
    EMPTY_OVERVIEW,
    `fetchLeagueOverview(${league})`
  ).then((result) => {
    OVERVIEW_IN_FLIGHT.delete(key);
    if (result && result !== EMPTY_OVERVIEW) setOverviewCache(key, result);
    return result;
  }).catch((err) => {
    OVERVIEW_IN_FLIGHT.delete(key);
    throw err;
  });

  OVERVIEW_IN_FLIGHT.set(key, promise);
  return promise;
}

// ── Game detail cache ─────────────────────────────────────────────────────────
//
// fetchGameById is called on every component mount (box score, optimizer,
// pregame panel) AND on every poll tick for live games. The cache prevents
// redundant fetches on remount; the poll loop bypasses it via { noCache: true }
// so live state is never stale.
//
// TTLs by game status:
//   in_progress → 30 s   (changes fast; remounts should feel fresh)
//   final       → 5 min  (score is fixed; back-navigation is instant)
//   scheduled   → 2 min  (lineups/injuries change infrequently pre-game)
//
// Cache is memory-only (no sessionStorage) — game payloads can be large and
// the primary win is within a single navigation session.

const GAME_TTL_MS = {
  in_progress: 30_000,
  final: 5 * 60_000,
  scheduled: 2 * 60_000,
};
const GAME_DEFAULT_TTL_MS = 30_000;

const GAME_MEM_CACHE = new Map(); // `${gameId}:${league}` → { data, fetchedAt }
const GAME_IN_FLIGHT = new Map(); // same key → Promise

function getGameFromCache(key) {
  const entry = GAME_MEM_CACHE.get(key);
  if (!entry) return undefined;
  const ttl = GAME_TTL_MS[entry.data?.status] ?? GAME_DEFAULT_TTL_MS;
  return Date.now() - entry.fetchedAt < ttl ? entry.data : undefined;
}

function setGameCache(key, data) {
  GAME_MEM_CACHE.set(key, { data, fetchedAt: Date.now() });
}

/**
 * Full game detail (box score) by game ID.
 *
 * @param {string} gameId
 * @param {string} league
 * @param {{ noCache?: boolean }} [options]
 *   noCache – pass true in poll loops so live state is always fetched fresh.
 *   The result is still written to the cache regardless, so a remount right
 *   after a poll will hit a warm cache entry.
 */
export async function fetchGameById(gameId, league, { noCache = false } = {}) {
  const key = `${gameId}:${league}`;

  if (!noCache) {
    const cached = getGameFromCache(key);
    if (cached !== undefined) return cached;
    if (GAME_IN_FLIGHT.has(key)) return GAME_IN_FLIGHT.get(key);
  }

  const promise = safeCall(
    () => getProvider(league).getGame(gameId),
    undefined,
    `fetchGameById(${gameId}, ${league})`
  ).then((result) => {
    GAME_IN_FLIGHT.delete(key);
    // Always populate cache (even for noCache calls) so remounts see fresh data.
    if (result !== undefined) setGameCache(key, result);
    return result;
  }).catch((err) => {
    GAME_IN_FLIGHT.delete(key);
    throw err;
  });

  if (!noCache) GAME_IN_FLIGHT.set(key, promise);
  return promise;
}

/**
 * Player historical game log (most recent first).
 * @param {string} playerId
 * @param {string} league
 */
export async function fetchPlayerGameLog(playerId, league) {
  return safeCall(
    () => getProvider(league).getPlayerGameLog(playerId),
    [],
    `fetchPlayerGameLog(${playerId}, ${league})`
  );
}

/**
 * Team season schedule — used for back-to-back detection.
 * @param {string} teamId
 * @param {string} league
 */
export async function fetchTeamSchedule(teamId, league) {
  return safeCall(
    () => getProvider(league).getTeamSchedule(teamId),
    [],
    `fetchTeamSchedule(${teamId}, ${league})`
  );
}
