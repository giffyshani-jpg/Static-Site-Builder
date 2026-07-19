// New Zealand NBL provider.
//
// The NZ NBL season typically runs May–August. ESPN returns HTTP 400 for the
// "nznbl" slug, so this provider uses TheSportsDB (free public API, no key)
// as its primary source.
//
// TheSportsDB league ID for New Zealand NBL: 5066
// Confirmed returning live-season data (July 2026 games verified).
//
// TheSportsDB limitations:
//   - No live scores (status is always "scheduled" or "final")
//   - No play-by-play or detailed box scores
//   - Upcoming & past 15 events available
//
// Source chain (in priority order):
//   1. TheSportsDB ID 5066 — schedule, upcoming, last played
//   2. ESPN nznbl — graceful empty (ESPN returns 400, kept for future use)

import {
  getLeagueOverviewFromTsdb,
  getTodayGamesFromTsdb,
  getGameFromTsdb,
  getGamesByDateFromTsdb,
} from "./thesportsdb";
import * as espn from "./espn";

const TSDB_LEAGUE_ID = 5066;
const LEAGUE_KEY = "nznbl";
const ESPN_SLUG = "nznbl"; // ESPN returns 400 for this, kept for future use

// ─── Public provider contract ─────────────────────────────────────────────────

export async function getTodayGames() {
  const tsdbGames = await getTodayGamesFromTsdb(TSDB_LEAGUE_ID, LEAGUE_KEY).catch(() => []);
  if (tsdbGames.length > 0) return tsdbGames;
  return espn.getTodayGames(ESPN_SLUG).catch(() => []);
}

export async function getGamesByDate(dateStr) {
  // Convert YYYYMMDD → YYYY-MM-DD for TSDB comparison
  const tsdbDate = dateStr && dateStr.length === 8
    ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
    : dateStr;

  // Use TSDB which has real NZ NBL data (ESPN returns 400 for nznbl)
  const tsdbGames = await getGamesByDateFromTsdb(TSDB_LEAGUE_ID, LEAGUE_KEY, tsdbDate).catch(() => []);
  if (tsdbGames.length > 0) return tsdbGames;

  return espn.getGamesByDate(ESPN_SLUG, dateStr).catch(() => []);
}

export async function getGame(gameId) {
  // Primary: TheSportsDB lookupevent — works for TSDB event IDs.
  const tsdbGame = await getGameFromTsdb(gameId, LEAGUE_KEY);
  if (tsdbGame) return tsdbGame;

  // Fallback: ESPN (returns 400 for nznbl but kept for future compatibility).
  return espn.getGame(ESPN_SLUG, gameId).catch(() => null);
}

export async function getPlayerGameLog(athleteId) {
  return espn.getPlayerGameLog(ESPN_SLUG, athleteId).catch(() => []);
}

export async function getTeamSchedule(teamId) {
  return espn.getTeamSchedule(ESPN_SLUG, teamId).catch(() => []);
}

export async function getLeagueOverview({ scan = true } = {}) {
  // Primary: TheSportsDB — has real NZ NBL schedule data
  const tsdbResult = await getLeagueOverviewFromTsdb(TSDB_LEAGUE_ID, LEAGUE_KEY).catch(() => null);

  if (
    tsdbResult &&
    (tsdbResult.live.length > 0 ||
      tsdbResult.upcoming.length > 0 ||
      tsdbResult.lastPlayed)
  ) {
    return tsdbResult;
  }

  // Fallback: ESPN (will return empty due to 400, but doesn't crash)
  const espnResult = await espn.getLeagueOverview(ESPN_SLUG, { scan }).catch(() => null);

  return espnResult ?? tsdbResult ?? { live: [], upcoming: [], lastPlayed: null };
}
