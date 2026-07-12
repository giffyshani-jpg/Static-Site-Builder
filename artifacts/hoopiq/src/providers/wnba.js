// WNBA data provider adapter.
//
// Implements the provider contract consumed by api.js: getTodayGames()
// and getGame(gameId). Backed by ESPN's public Site API — all
// ESPN-specific request/response handling lives in ./espn.js.

import * as espn from "./espn";

const LEAGUE = "wnba";

/**
 * @returns {Promise<object[]>}
 */
export async function getTodayGames() {
  return espn.getTodayGames(LEAGUE);
}

/**
 * @param {string} gameId
 * @returns {Promise<object | undefined>}
 */
export async function getGame(gameId) {
  return espn.getGame(LEAGUE, gameId);
}
