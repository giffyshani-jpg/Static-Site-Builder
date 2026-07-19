// NBA data provider — ESPN primary, NBA CDN fallback.
//
// Source chain (in priority order):
//   1. ESPN NBA Site API (primary — live scores, box scores, pregame odds)
//   2. NBA.com CDN todaysScoreboard_00.json (fallback for scoreboard only)
//
// Box scores (getGame) always use ESPN — the NBA CDN box score URL
// (boxscore_{id}.json) requires an NBA-specific gameId format and
// is out of scope for the current CDN wrapper.

import * as espn from "./espn";
import * as nbadotcom from "./nbadotcom";

const LEAGUE = "nba";

export async function getTodayGames() {
  const espnGames = await espn.getTodayGames(LEAGUE);
  if (espnGames.length > 0) return espnGames;

  // Fallback: NBA CDN live scoreboard (filters out Summer League)
  return nbadotcom.getNbaTodayGames().catch(() => []);
}

export async function getGamesByDate(dateStr) {
  return espn.getGamesByDate(LEAGUE, dateStr);
}

export async function getGame(gameId) {
  return espn.getGame(LEAGUE, gameId);
}

export async function getPlayerGameLog(athleteId) {
  return espn.getPlayerGameLog(LEAGUE, athleteId);
}

export async function getTeamSchedule(teamId) {
  return espn.getTeamSchedule(LEAGUE, teamId);
}

export async function getLeagueOverview(options) {
  // ESPN primary — handles live, upcoming, off-season forward/backward scan.
  const espnResult = await espn.getLeagueOverview(LEAGUE, options).catch(() => null);

  if (
    espnResult &&
    (espnResult.live.length > 0 ||
      espnResult.upcoming.length > 0 ||
      espnResult.lastPlayed)
  ) {
    return espnResult;
  }

  // Fallback: NBA CDN overview (live + today's schedule).
  // Useful when ESPN returns empty due to rate-limiting or a stale cache.
  const cdnResult = await nbadotcom.getNbaOverview(options).catch(() => null);

  if (
    cdnResult &&
    (cdnResult.live.length > 0 ||
      cdnResult.upcoming.length > 0 ||
      cdnResult.lastPlayed)
  ) {
    return cdnResult;
  }

  return espnResult ?? { live: [], upcoming: [], lastPlayed: null };
}
