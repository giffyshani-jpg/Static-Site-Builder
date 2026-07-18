// NBA Summer League provider.
//
// Summer League runs 2–3 weeks in July in Las Vegas. ESPN does not expose a
// dedicated public scoreboard for it, but Summer League games DO appear in
// the regular ESPN NBA scoreboard under season.type === 3.
//
// Source chain (in priority order):
//   1. ESPN NBA scoreboard filtered to season.type === 3
//      → most reliable for live scores / box scores
//   2. NBA.com CDN live scoreboard (todaysScoreboard_00.json)
//      → works from the browser (CORS open), blocked server-side
//      → identifies Summer League by gameLabel or gameId prefix "001"
//
// Both sources return the same normalized Game shape. The provider picks
// whichever yields non-empty results; callers never see a blank page.

import * as espn from "./espn";
import * as nbadotcom from "./nbadotcom";

// ESPN season type 3 = Summer League in July context.
const IS_SUMMER = (rawEvent) => rawEvent.season?.type === 3;
const NBA_SLUG = "nba";

// ─── Public provider contract ─────────────────────────────────────────────────

export async function getTodayGames() {
  const games = await espn.getGamesByDateFiltered(NBA_SLUG, null, IS_SUMMER);
  return games.map((g) => ({ ...g, league: "nba-summer" }));
}

export async function getGamesByDate(dateStr) {
  const games = await espn.getGamesByDateFiltered(NBA_SLUG, dateStr, IS_SUMMER);
  return games.map((g) => ({ ...g, league: "nba-summer" }));
}

export async function getGame(gameId) {
  // Box scores are per game-id; delegate to ESPN which handles the summary URL.
  // ESPN normalises game objects with its own "nba" slug, so we must override
  // the league field to keep "nba-summer" throughout the entire app flow.
  const game = await espn.getGame(NBA_SLUG, gameId);
  if (game) game.league = "nba-summer";
  return game;
}

export async function getPlayerGameLog(athleteId) {
  return espn.getPlayerGameLog(NBA_SLUG, athleteId);
}

export async function getTeamSchedule(teamId) {
  return espn.getTeamSchedule(NBA_SLUG, teamId);
}

/**
 * Timezone-safe overview for the NBA Summer League.
 *
 * Tries ESPN first (filtered to season type 3); falls back to the NBA CDN
 * live scoreboard if ESPN yields nothing.
 */
export async function getLeagueOverview({ scan = true } = {}) {
  // Primary: ESPN NBA scoreboard filtered for Summer League season type.
  // Summer League lasts ~3 weeks so scan window of 21 days is enough.
  const espnResult = await espn
    .getLeagueOverviewFiltered(NBA_SLUG, "nba-summer", IS_SUMMER, {
      scan,
      scanDays: 21,
    })
    .catch((e) => {
      console.warn("[nba-summer] ESPN filtered overview failed:", e.message);
      return null;
    });

  if (
    espnResult &&
    (espnResult.live.length > 0 ||
      espnResult.upcoming.length > 0 ||
      espnResult.lastPlayed)
  ) {
    return espnResult;
  }

  // Fallback: NBA.com CDN (works from browser, may 403 server-side).
  const cdnResult = await nbadotcom
    .getSummerLeagueOverview({ scan })
    .catch((e) => {
      console.warn("[nba-summer] NBA CDN overview failed:", e.message);
      return null;
    });

  if (
    cdnResult &&
    (cdnResult.live.length > 0 ||
      cdnResult.upcoming.length > 0 ||
      cdnResult.lastPlayed)
  ) {
    return cdnResult;
  }

  // Both sources empty — return whatever ESPN gave (may be empty object).
  return espnResult ?? { live: [], upcoming: [], lastPlayed: null };
}
