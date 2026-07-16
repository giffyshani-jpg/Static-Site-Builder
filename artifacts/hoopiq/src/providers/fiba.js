// FIBA international basketball — ESPN provider wrapper.
// ESPN slug: "fiba"  Source: site.api.espn.com/apis/site/v2/sports/basketball/fiba
// Covers FIBA World Cup and other international windows on ESPN's public API.
// Note: club-level European competitions (EuroLeague, EuroCup) are NOT available
// via ESPN (returns HTTP 400) and their own live.euroleague.net API no longer
// provides public JSON endpoints — those leagues cannot be supported without
// authenticated access. This provider covers the FIBA events ESPN does carry.

import * as espn from "./espn";

const LEAGUE = "fiba";

export async function getTodayGames() {
  return espn.getTodayGames(LEAGUE);
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
