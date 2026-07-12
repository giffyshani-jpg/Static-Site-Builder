import { nbaGames } from "./nba";
import { wnbaGames } from "./wnba";
import { Game } from "../types";

export const allGames: Game[] = [...nbaGames, ...wnbaGames];

export function getGamesByLeague(league: "nba" | "wnba"): Game[] {
  return league === "nba" ? nbaGames : wnbaGames;
}

export function getGameById(id: string): Game | undefined {
  return allGames.find(game => game.id === id);
}
