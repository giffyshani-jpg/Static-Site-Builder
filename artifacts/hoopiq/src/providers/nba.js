// NBA data provider adapter.
//
// Implements the provider contract consumed by api.js: getTodayGames()
// and getGame(gameId). Fill these in once a real NBA data source is
// chosen and wired up (e.g. using API_BASE_URL from ../config).

/**
 * @returns {Promise<object[]>}
 */
export async function getTodayGames() {
  // TODO: fetch today's NBA games from the NBA data provider
}

/**
 * @param {string} gameId
 * @returns {Promise<object | undefined>}
 */
export async function getGame(gameId) {
  // TODO: fetch a single NBA game (box score) by id from the NBA data provider
}
