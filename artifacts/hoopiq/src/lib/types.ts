export type PlayerStats = {
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  // Bonus fields parsed by the ESPN provider beyond the six
  // fantasy-relevant stats above. Not guaranteed present for every
  // player/game (e.g. pre-game rosters), so all optional.
  minutes?: string | null;
  fieldGoals?: string | null;
  threePointers?: string | null;
  freeThrows?: string | null;
  offensiveRebounds?: number;
  defensiveRebounds?: number;
  personalFouls?: number;
  plusMinus?: number;
};

export type Player = {
  id: string;
  name: string;
  number: string;
  position: string;
  stats: PlayerStats;
  // Populated from the same per-game summary response (ESPN includes an
  // injury report alongside the box score) — no extra request. Absent
  // when the player isn't listed on any team's injury report.
  injuryStatus?: "OUT" | "GTD" | "Questionable" | "Probable";
  // Explicit starter/DNP flags from ESPN's box score athlete entries.
  // Undefined for scheduled games (no box score published yet).
  starter?: boolean;
  didNotPlay?: boolean;
};

export type Team = {
  id: string;
  name: string;
  abbreviation: string;
  score: number | null;
  players: Player[];
  totals?: Record<string, unknown>;
};

export type GameStatus = "scheduled" | "in_progress" | "final";

export type PlayByPlayEvent = {
  id: string;
  description: string;
  period: string;
  clock: string;
  awayScore: number | null;
  homeScore: number | null;
  scoringPlay: boolean;
  isSubstitution: boolean;
  type: string;
  teamId: string | null;
};

export type Game = {
  id: string;
  league: "nba" | "wnba";
  homeTeam: Team;
  awayTeam: Team;
  startTime: string;
  status: GameStatus;
  period?: string;
  clock?: string;
  playByPlay?: PlayByPlayEvent[];
};
