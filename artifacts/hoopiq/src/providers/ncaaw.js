// NCAA Women's Basketball data provider adapter.
// ESPN slug: "womens-college-basketball"
// Source: site.api.espn.com/apis/site/v2/sports/basketball/womens-college-basketball
// Season typically runs November–April.

import * as espn from "./espn";

const LEAGUE = "womens-college-basketball";

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
