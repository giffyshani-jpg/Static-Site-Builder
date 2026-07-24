// Cricket-specific TypeScript types.
//
// Kept separate from types.ts (basketball) so neither bleeds into the other.
// The UI imports from here when rendering cricket-specific components.

// ─── Match format ──────────────────────────────────────────────────────────
export type MatchFormat =
  | "T20"
  | "ODI"
  | "Test"
  | "T10"
  | "The Hundred"
  | "Other";

// ─── Player role ───────────────────────────────────────────────────────────
/** Broad role used for fantasy selection and player card display. */
export type CricketRole = "bat" | "bowl" | "all" | "wk";

// ─── Per-game stats ────────────────────────────────────────────────────────

export type CricketBattingStats = {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  /** Calculated SR = (runs / balls) * 100, null if no balls faced. */
  strikeRate: number | null;
  dismissed: boolean;
  /** Dismissal description e.g. "c Maxwell b Hazlewood" or "run out (Smith)". */
  dismissal: string | null;
  /** True when the dismissal was LBW or clean bowled — triggers bowling bonus. */
  isLbwOrBowled?: boolean;
};

export type CricketBowlingStats = {
  /** Full overs (integer portion), e.g. 4 for "4.2 overs". */
  overs: number;
  /** Extra balls in current partial over (0–5). */
  extraBalls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  /** lbw + bowled wickets for this bowler — triggers +8 bonus each. */
  lbwBowledWickets: number;
  /** Economy = runsConceded / total_overs_as_decimal, null if overs === 0. */
  economy: number | null;
};

export type CricketFieldingStats = {
  catches: number;
  stumpings: number;
  /** Clean direct hit run-out. */
  runOutsDirect: number;
  /** Indirect run-out (contribution, not the thrower who broke the stumps). */
  runOutsIndirect: number;
};

/** Combined stats for a single player in a match (all sections optional). */
export type CricketPlayerStats = {
  batting?: CricketBattingStats;
  bowling?: CricketBowlingStats;
  fielding?: CricketFieldingStats;
};

// ─── Player ───────────────────────────────────────────────────────────────

export type CricketPlayer = {
  id: string;
  name: string;
  shortName?: string;
  role: CricketRole;
  /** Fantasy credit value from fantasy providers (null if not available). */
  credits: number | null;
  /** Whether the player is in the confirmed playing XI. */
  isPlaying: boolean;
  /** Team abbreviation this player belongs to. */
  teamAbbreviation: string;
  stats: CricketPlayerStats;
  /** Calculated fantasy points (null before calculation). */
  fantasyPoints?: number | null;
};

// ─── Team ─────────────────────────────────────────────────────────────────

export type CricketTeam = {
  id: string;
  name: string;
  abbreviation: string;
  /** Current innings score (e.g. "185/4"). */
  score: string | null;
  /** Current overs (e.g. "20.0"). */
  overs: string | null;
  players: CricketPlayer[];
};

// ─── Innings ──────────────────────────────────────────────────────────────

export type CricketInnings = {
  inningsNumber: number;
  battingTeam: CricketTeam;
  bowlingTeam: CricketTeam;
  totalRuns: number;
  totalWickets: number;
  totalOvers: string;
  /** "in_progress" | "completed" | "not_started" */
  status: "in_progress" | "completed" | "not_started";
};

// ─── Game ─────────────────────────────────────────────────────────────────

export type CricketGameStatus = "scheduled" | "in_progress" | "final";

export type CricketGame = {
  id: string;
  /** ESPN competition slug (e.g. "ipl", "big-bash"). */
  competitionSlug: string;
  /** Human-readable competition name (e.g. "Indian Premier League"). */
  competitionName: string;
  format: MatchFormat;
  homeTeam: CricketTeam;
  awayTeam: CricketTeam;
  startTime: string;
  startTimeIso?: string | null;
  status: CricketGameStatus;
  /** E.g. "1st Innings", "2nd Innings", "Day 2, Session 1". */
  period?: string;
  /** Status detail from ESPN — e.g. "RR: 9.25" or "Rain delay". */
  statusDetail?: string;
  innings: CricketInnings[];
  /** Result text shown when status === "final", e.g. "MI won by 6 wickets". */
  result?: string | null;
  venue?: string | null;
};

// ─── Overview (mirrors basketball LeagueOverview) ─────────────────────────

export type CricketLeagueOverview = {
  live: CricketGame[];
  upcoming: CricketGame[];
  lastPlayed: CricketGame | null;
  /** Competitions that returned at least one game. */
  activeCompetitions: string[];
};

// ─── Fantasy metadata from external providers ─────────────────────────────

export type PlayerFantasyMeta = {
  /** Provider name (e.g. "FantasyWala", "Calc11", "DafaFantasy"). */
  source: string;
  credits: number | null;
  role: CricketRole | null;
  /** Whether this player is recommended/popular pick on that platform. */
  isRecommended: boolean;
  /** Ownership % if available. */
  ownershipPct: number | null;
};
