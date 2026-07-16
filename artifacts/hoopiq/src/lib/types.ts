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

/**
 * One entry from a game summary's `injuries` block — ESPN's per-team
 * injury report, available even for scheduled (pregame) games. Distinct
 * from `Player.injuryStatus` (which is only populated once a player also
 * appears in a published box score) — this is available before any box
 * score exists, which is what Pre-Game Intelligence needs.
 */
export type InjuryReportEntry = {
  teamId: string;
  playerId: string;
  name: string;
  position: string;
  status: "OUT" | "GTD" | "Questionable" | "Probable";
};

/**
 * Pregame betting-market data from ESPN's `pickcenter` block (when a
 * market exists for the game). Used only as a "blowout risk" signal — a
 * large spread suggests a lopsided expected score, which can mean
 * reduced fourth-quarter minutes for likely-winning-team starters. Never
 * treated as fact, just a heuristic input alongside others.
 */
export type PregameOdds = {
  /** Absolute point spread (always >= 0) — magnitude only, not direction. */
  spread: number | null;
  favoriteTeamId: string | null;
  overUnder: number | null;
};

/** One entry from a team's schedule — used to detect back-to-backs. */
export type TeamScheduleEntry = {
  id: string;
  date: string;
  state: "pre" | "in" | "post";
};

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

/** All leagues supported by the app's provider registry. */
export type LeagueKey = "nba" | "wnba" | "nbl" | "fiba" | "ncaam";

export type Game = {
  id: string;
  league: LeagueKey;
  homeTeam: Team;
  awayTeam: Team;
  startTime: string;
  /** Raw ISO tipoff timestamp, when ESPN provided one (used for back-to-back detection). */
  startTimeIso?: string | null;
  status: GameStatus;
  period?: string;
  clock?: string;
  playByPlay?: PlayByPlayEvent[];
  /** Full per-team injury report, available pregame — see InjuryReportEntry. */
  injuryReport?: InjuryReportEntry[];
  /** Betting-market snapshot for blowout-risk estimation, when available. */
  pregameOdds?: PregameOdds;
};
