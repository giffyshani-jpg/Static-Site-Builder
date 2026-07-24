// API service layer.
//
// This is the adapter boundary between the UI and whichever provider backs
// each league. UI components only ever import from this file — never from a
// provider module directly.
//
// Adding a new basketball league:
//   1. Create src/providers/<league>.js implementing the provider contract.
//   2. Add an entry to PROVIDERS below.
//   3. Add an entry to LEAGUE_CONFIGS below.
//   4. Add the key to ALL_LEAGUES.
//   5. Add the key to LeagueKey in src/lib/types.ts.
//
// Cricket uses a separate auto-discovery architecture — see providers/cricket.js.
// No code changes needed to add new cricket competitions.

import * as nbaProvider from "./providers/nba";
import * as wnbaProvider from "./providers/wnba";
import * as nblProvider from "./providers/nbl";
import * as nznblProvider from "./providers/nznbl";
import * as fibaProvider from "./providers/fiba";
import * as nbaSummerProvider from "./providers/nba-summer";
import * as cricketProvider from "./providers/cricket";

// ─── Cricket provider adapter ──────────────────────────────────────────────
// Wraps the cricket provider so it satisfies the same interface as basketball
// providers (getLeagueOverview, getGame, getPlayerGameLog, getTeamSchedule).
const cricketAdapter = {
  getLeagueOverview: () => cricketProvider.getLeagueOverview(),
  getGame: (gameId) => cricketProvider.fetchGameById(gameId),
  getPlayerGameLog: () => Promise.resolve([]),
  getTeamSchedule: () => Promise.resolve([]),
};

const PROVIDERS = {
  nba: nbaProvider,
  wnba: wnbaProvider,
  nbl: nblProvider,
  nznbl: nznblProvider,
  fiba: fibaProvider,
  "nba-summer": nbaSummerProvider,
  cricket: cricketAdapter,
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
    active: true,
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
    active: false,
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
    active: false,
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
    active: true,
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
  cricket: {
    name: "Cricket",
    fullName: "Cricket — All Competitions",
    description: "T20, ODI, Test & more",
    color: "green",
    gradient: "from-green-900 to-slate-900",
    accent: "text-green-400",
    accentHover: "group-hover:text-green-300",
    textLight: "text-green-200",
    active: true,
  },
};

/** NBA and WNBA — rendered as full-width premium cards on the home page. */
export const PRIMARY_LEAGUES = ["nba", "wnba"];

/**
 * Secondary basketball leagues — grouped under "Other Basketball".
 * Summer League is shown only when it has active games.
 */
export const SECONDARY_LEAGUES = ["nbl", "nznbl", "fiba", "nba-summer"];

/** All basketball leagues used internally. Cricket is handled separately. */
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

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Games for a specific YYYYMMDD date.
 */
export async function fetchGamesByLeagueAndDate(league, dateStr) {
  const provider = getProvider(league);
  const fn = provider.getGamesByDate ?? provider.getTodayGames;
  return safeCall(() => fn(dateStr), [], `fetchGamesByLeagueAndDate(${league}, ${dateStr})`);
}

/**
 * Timezone-safe league overview: { live, upcoming, lastPlayed }.
 * For "cricket" — delegates to the cricket provider's auto-discovery.
 */
export async function fetchLeagueOverview(league, options) {
  const scan = options?.scan ?? false;
  const key = overviewCacheKey(league, scan);

  const cached = getOverviewFromCache(key);
  if (cached) return cached;

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

// ─── Cricket-specific exports ──────────────────────────────────────────────
//
// The cricket provider returns CricketGame objects (not basketball Game),
// so these functions are exported separately for cricket-aware UI components.

/**
 * Returns the merged cricket overview across all competitions.
 * Caches for 2 minutes. Live games refresh on demand via fetchCricketGame.
 */
export async function fetchCricketOverview() {
  const key = "cricket:overview";
  const cached = getOverviewFromCache(key);
  if (cached) return cached;

  if (OVERVIEW_IN_FLIGHT.has(key)) return OVERVIEW_IN_FLIGHT.get(key);

  const promise = cricketProvider.getLeagueOverview().then((result) => {
    OVERVIEW_IN_FLIGHT.delete(key);
    if (result) setOverviewCache(key, result);
    return result;
  }).catch((err) => {
    OVERVIEW_IN_FLIGHT.delete(key);
    console.error("[api] fetchCricketOverview failed:", err?.message ?? err);
    return { live: [], upcoming: [], lastPlayed: null, activeCompetitions: [] };
  });

  OVERVIEW_IN_FLIGHT.set(key, promise);
  return promise;
}

/**
 * Full cricket game detail (batting/bowling scorecard).
 * gameId format: "{competitionSlug}:{espnEventId}"
 */
export async function fetchCricketGame(gameId, { noCache = false } = {}) {
  return cricketProvider.fetchGameById(gameId, { noCache });
}

/**
 * Player roster + stats for a cricket match (used by cricket optimizer).
 */
export async function fetchCricketRoster(gameId) {
  return cricketProvider.fetchGameRoster(gameId);
}

// ── Game detail cache (basketball) ────────────────────────────────────────────

const GAME_TTL_MS = {
  in_progress: 30_000,
  final: 5 * 60_000,
  scheduled: 2 * 60_000,
};
const GAME_DEFAULT_TTL_MS = 30_000;

const GAME_MEM_CACHE = new Map();
const GAME_IN_FLIGHT = new Map();

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
 * For cricket games, use fetchCricketGame() instead.
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
 */
export async function fetchTeamSchedule(teamId, league) {
  return safeCall(
    () => getProvider(league).getTeamSchedule(teamId),
    [],
    `fetchTeamSchedule(${teamId}, ${league})`
  );
}
