// New Zealand NBL data provider adapter.
// ESPN slug: "nznbl"
// Source: site.api.espn.com/apis/site/v2/sports/basketball/nznbl
// Season typically runs May–June.
//
// Note: If ESPN does not carry this league, getGamesByDate returns [] and the
// league page will show "No upcoming games found" rather than crashing. The
// provider contract is the same regardless.

import * as espn from "./espn";

const LEAGUE = "nznbl";

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

export async function getLeagueOverview(options) {
  return espn.getLeagueOverview(LEAGUE, options);
}
