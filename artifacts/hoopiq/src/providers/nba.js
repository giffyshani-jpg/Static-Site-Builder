// NBA data provider adapter.
//
// Implements the provider contract consumed by api.js: getTodayGames()
// and getGame(gameId). Backed by ESPN's public Site API — all
// ESPN-specific request/response handling lives in ./espn.js.

import * as espn from "./espn";

const LEAGUE = "nba";

/**
 * @returns {Promise<object[]>}
 */
export async function getTodayGames() {
  return espn.getTodayGames(LEAGUE);
}

/**
 * @param {string} dateStr  YYYYMMDD
 * @returns {Promise<object[]>}
 */
export async function getGamesByDate(dateStr) {
  return espn.getGamesByDate(LEAGUE, dateStr);
}

/**
 * @param {string} gameId
 * @returns {Promise<object | undefined>}
 */
export async function getGame(gameId) {
  return espn.getGame(LEAGUE, gameId);
}

/**
 * @param {string} athleteId
 * @returns {Promise<object[]>}
 */
export async function getPlayerGameLog(athleteId) {
  return espn.getPlayerGameLog(LEAGUE, athleteId);
}

/**
 * @param {string} teamId
 * @returns {Promise<object[]>}
 */
export async function getTeamSchedule(teamId) {
  return espn.getTeamSchedule(LEAGUE, teamId);
}

export async function getLeagueOverview(options) {
  return espn.getLeagueOverview(LEAGUE, options);
}
