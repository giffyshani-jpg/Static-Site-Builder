// WNBA data provider adapter.
//
// Implements the provider contract consumed by api.js. Backed by ESPN's
// public Site API — all ESPN-specific handling lives in ./espn.js.
//
// WNBA is the most reliable ESPN league in July 2026 (active season).
// No additional fallback is needed, but ESPN is wrapped with retry logic.

import * as espn from "./espn";

const LEAGUE = "wnba";

export async function getTodayGames() {
  return espn.getTodayGames(LEAGUE);
}

export async function getGame(gameId) {
  return espn.getGame(LEAGUE, gameId);
}

export async function getPlayerGameLog(athleteId) {
  return espn.getPlayerGameLog(LEAGUE, athleteId);
}

export async function getGamesByDate(dateStr) {
  return espn.getGamesByDate(LEAGUE, dateStr);
}

export async function getTeamSchedule(teamId) {
  return espn.getTeamSchedule(LEAGUE, teamId);
}

export async function getLeagueOverview(options) {
  return espn.getLeagueOverview(LEAGUE, options);
}
