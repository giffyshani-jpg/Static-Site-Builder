// NBA Summer League data provider adapter.
// ESPN slug: "nba-summer-league"
// Source: site.api.espn.com/apis/site/v2/sports/basketball/nba-summer-league
// Season typically runs early–mid July in Las Vegas.

import * as espn from "./espn";

const LEAGUE = "nba-summer-league";

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
