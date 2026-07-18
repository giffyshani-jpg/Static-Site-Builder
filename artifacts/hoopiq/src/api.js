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
  return safeCall(
    () => getProvider(league).getLeagueOverview(options),
    EMPTY_OVERVIEW,
    `fetchLeagueOverview(${league})`
  );
}

/**
 * Full game detail (box score) by game ID.
 * @param {string} gameId
 * @param {string} league
 */
export async function fetchGameById(gameId, league) {
  return safeCall(
    () => getProvider(league).getGame(gameId),
    undefined,
    `fetchGameById(${gameId}, ${league})`
  );
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
