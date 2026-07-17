// New Zealand NBL provider.
//
// The NZ NBL season typically runs May–August. ESPN returns HTTP 400 for the
// "nznbl" slug, so this provider uses TheSportsDB (free public API, no key)
// as its primary source, with ESPN as a graceful-empty fallback.
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

import { getLeagueOverviewFromTsdb, getTodayGamesFromTsdb, getGameFromTsdb } from "./thesportsdb";
import * as espn from "./espn";

const TSDB_LEAGUE_ID = 5066;
const LEAGUE_KEY = "nznbl";
const ESPN_SLUG = "nznbl"; // ESPN returns 400 for this, but kept for future

// ─── Public provider contract ─────────────────────────────────────────────────

export async function getTodayGames() {
  const tsdbGames = await getTodayGamesFromTsdb(TSDB_LEAGUE_ID, LEAGUE_KEY).catch(
    () => []
  );
  if (tsdbGames.length > 0) return tsdbGames;
  return espn.getTodayGames(ESPN_SLUG).catch(() => []);
}

export async function getGamesByDate(dateStr) {
  // TSDB doesn't support per-date queries in the free tier; delegate to ESPN
  // (which returns 400 and is handled gracefully).
  return espn.getGamesByDate(ESPN_SLUG, dateStr).catch(() => []);
}

export async function getGame(gameId) {
  // Primary: TheSportsDB lookupevent — works for TSDB event IDs (numeric
  // strings like "2467092"). Returns team names, scores, and final status.
  // TSDB free tier has no player-level box score, so players[] will be [].
  const tsdbGame = await getGameFromTsdb(gameId, LEAGUE_KEY);
  if (tsdbGame) return tsdbGame;

  // Fallback: ESPN — returns 400 for the "nznbl" slug but kept for future
  // compatibility if ESPN ever adds NZ NBL support.
  return espn.getGame(ESPN_SLUG, gameId).catch(() => null);
}

export async function getPlayerGameLog(athleteId) {
  return espn.getPlayerGameLog(ESPN_SLUG, athleteId).catch(() => []);
}

export async function getTeamSchedule(teamId) {
  return espn.getTeamSchedule(ESPN_SLUG, teamId).catch(() => []);
}

/**
 * Timezone-safe overview for the New Zealand NBL.
 *
 * TheSportsDB is the authoritative source for upcoming and last-played games.
 * It has no live scores, so `live` is always [] unless ESPN somehow returns
 * data in the future.
 */
export async function getLeagueOverview({ scan = true } = {}) {
  // Primary: TheSportsDB — has real NZ NBL schedule data
  const tsdbResult = await getLeagueOverviewFromTsdb(
    TSDB_LEAGUE_ID,
    LEAGUE_KEY
  ).catch((e) => {
    console.warn("[nznbl] TheSportsDB overview failed:", e.message);
    return null;
  });

  if (
    tsdbResult &&
    (tsdbResult.live.length > 0 ||
      tsdbResult.upcoming.length > 0 ||
      tsdbResult.lastPlayed)
  ) {
    return tsdbResult;
  }

  // Fallback: ESPN (will return empty due to 400, but doesn't crash)
  const espnResult = await espn
    .getLeagueOverview(ESPN_SLUG, { scan })
    .catch(() => null);

  return espnResult ?? tsdbResult ?? { live: [], upcoming: [], lastPlayed: null };
}
