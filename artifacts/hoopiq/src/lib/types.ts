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

/**
 * A single historical game entry from ESPN's player gamelog endpoint
 * (see providers/espn.js). Distinct from `Player` (a snapshot within one
 * game's box score) — this is one row of a player's real game history.
 */
export type PlayerGameLogEntry = {
  gameId: string;
  /** ISO date string, or null if ESPN didn't provide one. */
  date: string | null;
  opponentAbbreviation: string;
  opponentName: string;
  homeAway: "home" | "away";
  /** "W" | "L", or null if the game hasn't finished / result is unknown. */
  result: "W" | "L" | null;
  teamScore: string | number | null;
  opponentScore: string | number | null;
  stats: PlayerStats;
  /**
   * Starter/bench status and plus/minus aren't available from the
   * gamelog endpoint (only a specific game's live summary has them) —
   * always null here. Kept on the type so callers don't need optional
   * chaining and so the limitation is visible at the type level.
   */
  starter: null;
  plusMinus: null;
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
