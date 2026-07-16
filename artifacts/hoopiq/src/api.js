// API service layer.
//
// This is the adapter boundary between the UI and whichever provider
// backs each league. UI components only ever import from this file —
// never from a provider module directly. Adding support for another
// league means adding a new file under `providers/` and registering it
// in PROVIDERS below; nothing in the UI needs to change.

import * as nbaProvider from "./providers/nba";
import * as wnbaProvider from "./providers/wnba";
import * as nblProvider from "./providers/nbl";
import * as nznblProvider from "./providers/nznbl";
import * as fibaProvider from "./providers/fiba";
import * as ncaamProvider from "./providers/ncaam";
import * as ncaawProvider from "./providers/ncaaw";
import * as nbaSummerProvider from "./providers/nba-summer";

const PROVIDERS = {
  nba: nbaProvider,
  wnba: wnbaProvider,
  nbl: nblProvider,
  nznbl: nznblProvider,
  fiba: fibaProvider,
  ncaam: ncaamProvider,
  ncaaw: ncaawProvider,
  "nba-summer": nbaSummerProvider,
};

function getProvider(league) {
  const provider = PROVIDERS[league];
  if (!provider) {
    throw new Error(`No provider registered for league "${league}"`);
  }
  return provider;
}

/**
 * Static metadata for every supported league — used by the home page and
 * league selector to render cards, colours, and descriptions without a
 * network round-trip.
 *
 * `active` indicates whether this league's season is typically running now;
 * the home page uses this only as a hint — actual game counts come from the
 * network.
 */
export const LEAGUE_CONFIGS = {
  nba: {
    name: "NBA",
    fullName: "National Basketball Association",
    description: "Men's Professional Basketball",
    color: "blue",
    gradient: "from-blue-900 to-slate-900",
    accent: "text-blue-400",
    accentHover: "group-hover:text-blue-300",
    textLight: "text-blue-200",
    active: false, // Off-season; returns ~October
  },
  "nba-summer": {
    name: "NBA Summer",
    fullName: "NBA Summer League",
    description: "Summer League Basketball",
    color: "sky",
    gradient: "from-sky-900 to-slate-900",
    accent: "text-sky-400",
    accentHover: "group-hover:text-sky-300",
    textLight: "text-sky-200",
    active: true, // Runs July in Las Vegas
  },
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
  nbl: {
    name: "NBL",
    fullName: "National Basketball League",
    description: "Australian Pro Basketball",
    color: "emerald",
    gradient: "from-emerald-900 to-slate-900",
    accent: "text-emerald-400",
    accentHover: "group-hover:text-emerald-300",
    textLight: "text-emerald-200",
    active: false, // Pre-season starts Aug 2026
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
    active: false, // Season typically May–June
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
  ncaam: {
    name: "NCAA Men",
    fullName: "NCAA Men's Basketball",
    description: "Men's College Basketball",
    color: "red",
    gradient: "from-red-900 to-slate-900",
    accent: "text-red-400",
    accentHover: "group-hover:text-red-300",
    textLight: "text-red-200",
    active: false, // Off-season; returns ~November
  },
  ncaaw: {
    name: "NCAA Women",
    fullName: "NCAA Women's Basketball",
    description: "Women's College Basketball",
    color: "pink",
    gradient: "from-pink-900 to-slate-900",
    accent: "text-pink-400",
    accentHover: "group-hover:text-pink-300",
    textLight: "text-pink-200",
    active: false, // Off-season; returns ~November
  },
};

/**
 * Ordered list of leagues shown on the home page.
 *
 * ESPN public API availability (as of July 2026):
 *   ✅  nba, wnba, nbl, fiba, ncaam, ncaaw
 *   ❌  nba-summer-league → 400  (no public endpoint)
 *   ❌  nznbl → 400             (no public endpoint)
 *
 * Provider files for the unsupported leagues exist for future use but
 * are not listed here so they don't appear as permanent "No games soon"
 * cards on the home page.
 */
export const ALL_LEAGUES = [
  "wnba",
  "nba",
  "nbl",
  "fiba",
  "ncaam",
  "ncaaw",
];

// --- Fetch functions -----------------------------------------------------

/**
 * Fetch today's games for a given league.
 *
 * @param {string} league
 * @returns {Promise<object[]>}
 */
export async function fetchGamesByLeague(league) {
  const games = await getProvider(league).getTodayGames();
  return games ?? [];
}

/**
 * Fetch games for a given league and YYYYMMDD date string.
 *
 * @param {string} league
 * @param {string} dateStr  YYYYMMDD
 * @returns {Promise<object[]>}
 */
export async function fetchGamesByLeagueAndDate(league, dateStr) {
  const provider = getProvider(league);
  const fn = provider.getGamesByDate ?? provider.getTodayGames;
  const games = await fn(dateStr);
  return games ?? [];
}

/**
 * Timezone-safe league overview: { live, upcoming, lastPlayed }.
 *
 * Uses the provider's own `status` field — never local calendar dates —
 * so a currently-live game always appears as live regardless of the
 * viewer's timezone (IST, PST, etc.).
 *
 * `scan: true` (default) searches forward/backward up to 45 days to find
 * the next upcoming game and most recently completed game even during an
 * off-season gap. Use `scan: false` on the home page for a fast paint.
 *
 * @param {string} league
 * @param {{ scan?: boolean }} [options]
 * @returns {Promise<{ live: object[], upcoming: object[], lastPlayed: object | null }>}
 */
export async function fetchLeagueOverview(league, options) {
  const provider = getProvider(league);
  const result = await provider.getLeagueOverview(options);
  return result ?? { live: [], upcoming: [], lastPlayed: null };
}

/**
 * Fetch a single game (including full box score) by id.
 *
 * @param {string} gameId
 * @param {string} league
 * @returns {Promise<object | undefined>}
 */
export async function fetchGameById(gameId, league) {
  const game = await getProvider(league).getGame(gameId);
  return game ?? undefined;
}

/**
 * Fetch a player's historical game log (most recent first) by athlete id.
 *
 * @param {string} playerId
 * @param {string} league
 * @returns {Promise<object[]>}
 */
export async function fetchPlayerGameLog(playerId, league) {
  const games = await getProvider(league).getPlayerGameLog(playerId);
  return games ?? [];
}

/**
 * Fetch a team's schedule (id/date/state for every game this season).
 * Used by Pre-Game Intelligence to find a team's most recent completed
 * game and detect back-to-backs.
 *
 * @param {string} teamId
 * @param {string} league
 * @returns {Promise<object[]>}
 */
export async function fetchTeamSchedule(teamId, league) {
  const schedule = await getProvider(league).getTeamSchedule(teamId);
  return schedule ?? [];
}
