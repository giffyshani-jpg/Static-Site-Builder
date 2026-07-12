export type PlayerStats = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
};

export type Player = {
  id: string;
  name: string;
  number: string;
  position: string;
  stats: PlayerStats;
};

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  score: number | null;
  players: Player[];
};

export type GameStatus = "scheduled" | "in_progress" | "final";

export type Game = {
  id: string;
  league: "nba" | "wnba";
  homeTeam: Team;
  awayTeam: Team;
  startTime: string;
  status: GameStatus;
  period?: string;
  clock?: string;
};
