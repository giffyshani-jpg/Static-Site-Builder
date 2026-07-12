// API service layer.
//
// This is the adapter boundary between the UI and whichever provider
// backs each league. UI components only ever import from this file —
// never from a provider module directly. Adding support for another
// league means adding a new file under `providers/` and registering it
// in PROVIDERS below; nothing in the UI needs to change.

import * as nbaProvider from "./providers/nba";
import * as wnbaProvider from "./providers/wnba";

const PROVIDERS = {
  nba: nbaProvider,
  wnba: wnbaProvider,
};

function getProvider(league) {
  const provider = PROVIDERS[league];
  if (!provider) {
    throw new Error(`No provider registered for league "${league}"`);
  }
  return provider;
}

/**
 * Fetch today's games for a given league.
 *
 * @param {"nba" | "wnba"} league
 * @returns {Promise<object[]>}
 */
export async function fetchGamesByLeague(league) {
  const games = await getProvider(league).getTodayGames();
  return games ?? [];
}

/**
 * Fetch a single game (including full box score) by id.
 *
 * @param {string} gameId
 * @param {"nba" | "wnba"} league
 * @returns {Promise<object | undefined>}
 */
export async function fetchGameById(gameId, league) {
  const game = await getProvider(league).getGame(gameId);
  return game ?? undefined;
}
