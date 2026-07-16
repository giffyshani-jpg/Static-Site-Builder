// Pre-Game Intelligence — heuristics for helping a user pick a fantasy
// lineup before lock, built entirely from real ESPN data:
//   - Lineups/roles: the target game's own box score once ESPN publishes
//     it ("Confirmed"), or the player's most recent completed game's
//     starter flag as a stand-in ("Expected") before that happens.
//   - Availability: the target game's pregame injury report (real,
//     available before any box score exists).
//   - Recent form / minutes: the player's real ESPN game log (see
//     lib/game-log-metrics.ts).
//   - Back-to-back: the team's real schedule (games on consecutive
//     nights).
//   - Blowout risk: the target game's real betting-market spread, when a
//     market has been posted.
//
// Every score/tier below is a documented, transparent heuristic — never
// presented as an official projection. Thresholds were chosen to be
// reasonable for this app's fantasy formula (lib/stats.ts) but are not
// derived from any external model.

import { GameLogMetrics } from "./game-log-metrics";
import { Game, InjuryReportEntry, TeamScheduleEntry } from "./types";

export type LineupStatus =
  | "Confirmed Starter"
  | "Confirmed Bench"
  | "Expected Starter"
  | "Bench"
  | "Out"
  | "Questionable"
  | "Game Time Decision";

export type BlowoutRisk = "Low" | "Medium" | "High";

export type RecommendationTier = "Elite Play" | "Strong Play" | "Safe Value" | "Risky" | "Avoid";

export const RECOMMENDATION_EMOJI: Record<RecommendationTier, string> = {
  "Elite Play": "🔥",
  "Strong Play": "✅",
  "Safe Value": "👍",
  Risky: "⚠️",
  Avoid: "❌",
};

const TIER_ORDER: RecommendationTier[] = ["Avoid", "Risky", "Safe Value", "Strong Play", "Elite Play"];

function clampTier(index: number): RecommendationTier {
  return TIER_ORDER[Math.max(0, Math.min(TIER_ORDER.length - 1, index))];
}

function shiftTier(tier: RecommendationTier, delta: number): RecommendationTier {
  return clampTier(TIER_ORDER.indexOf(tier) + delta);
}

/**
 * Back-to-back detection: the team's most recent game (by schedule)
 * finished within ~30 hours of tonight's tipoff. 30h (not a strict 24h)
 * gives a little slack for early-afternoon-to-evening scheduling while
 * still only catching true consecutive-night sets.
 */
export function isBackToBack(schedule: TeamScheduleEntry[], gameDateIso: string): boolean {
  const gameDate = new Date(gameDateIso).getTime();
  if (!Number.isFinite(gameDate)) return false;

  const priorCompleted = schedule
    .filter((e) => e.state === "post" && new Date(e.date).getTime() < gameDate)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  if (!priorCompleted) return false;
  const hoursSince = (gameDate - new Date(priorCompleted.date).getTime()) / (1000 * 60 * 60);
  return hoursSince > 0 && hoursSince <= 30;
}

/** Finds a team's most recently completed game id from its schedule, before a given date. */
export function findPreviousCompletedGameId(schedule: TeamScheduleEntry[], gameDateIso: string): string | null {
  const gameDate = new Date(gameDateIso).getTime();
  const completed = schedule
    .filter((e) => e.state === "post" && (!Number.isFinite(gameDate) || new Date(e.date).getTime() < gameDate))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return completed[0]?.id ?? null;
}

/**
 * Blowout risk from the absolute betting spread, when a market exists.
 * Returns undefined when no market has been posted — the UI should omit
 * the badge rather than guessing ("if available", per spec).
 */
export function deriveBlowoutRisk(spread: number | null | undefined): BlowoutRisk | undefined {
  if (spread === null || spread === undefined) return undefined;
  if (spread >= 12) return "High";
  if (spread >= 7) return "Medium";
  return "Low";
}

/**
 * Determines this player's lineup status for tonight's game.
 *
 * @param injuryStatus  from the target game's pregame injury report
 * @param confirmedStarter  the target game's own box score starter flag, once published (undefined = not published yet)
 * @param expectedStarter  starter flag from the player's most recent completed game
 */
export function buildLineupStatus(
  injuryStatus: InjuryReportEntry["status"] | undefined,
  confirmedStarter: boolean | undefined,
  expectedStarter: boolean | undefined,
): LineupStatus {
  if (injuryStatus === "OUT") return "Out";
  if (confirmedStarter !== undefined) return confirmedStarter ? "Confirmed Starter" : "Confirmed Bench";
  if (injuryStatus === "Questionable") return "Questionable";
  if (injuryStatus === "GTD") return "Game Time Decision";
  if (expectedStarter) return "Expected Starter";
  return "Bench";
}

/**
 * Today's projected minutes: starts from the player's real recent-minutes
 * average (last 5, falling back to last 10, then their most recent
 * game's minutes) and scales down for availability uncertainty. This is
 * a transparent heuristic, not an official projection.
 */
export function projectMinutes(
  status: LineupStatus,
  metrics: Pick<GameLogMetrics, "avgMinutesLast5" | "avgMinutesLast10">,
  lastGameMinutes: number | null,
): number | null {
  if (status === "Out") return 0;

  const baseline = metrics.avgMinutesLast5 ?? metrics.avgMinutesLast10 ?? lastGameMinutes;
  if (baseline === null) return null;

  switch (status) {
    case "Questionable":
      return Math.round(baseline * 0.8 * 10) / 10;
    case "Game Time Decision":
      return Math.round(baseline * 0.85 * 10) / 10;
    case "Confirmed Bench":
    case "Bench":
      // Bench players' minutes are far less predictable; shade down
      // slightly from their recent average rather than assuming a
      // starter-caliber workload.
      return Math.round(baseline * 0.9 * 10) / 10;
    default:
      return Math.round(baseline * 10) / 10;
  }
}

export type RecommendationInputs = {
  status: LineupStatus;
  avgFptsLast5: number | null;
  minutesTrend: "up" | "down" | "flat" | null;
  backToBack: boolean;
  blowoutRisk: BlowoutRisk | undefined;
  /** True if this player's team is the game's betting favorite (only meaningful for blowout risk). */
  isFavorite: boolean;
};

/**
 * Fantasy recommendation badge. Starts from a production baseline (real
 * recent fantasy output) and applies documented adjustments for
 * availability, role, minutes trend, rest, and blowout risk. Clamped to
 * the five tiers below — never presented as more precise than "a
 * reasonable starting point for your decision."
 */
export function computeRecommendation(inputs: RecommendationInputs): RecommendationTier {
  if (inputs.status === "Out") return "Avoid";

  const fpts = inputs.avgFptsLast5 ?? 0;
  let tier: RecommendationTier;
  if (fpts >= 45) tier = "Elite Play";
  else if (fpts >= 32) tier = "Strong Play";
  else if (fpts >= 20) tier = "Safe Value";
  else if (fpts >= 10) tier = "Risky";
  else tier = "Avoid";

  // Unconfirmed bench role with modest production is inherently harder to
  // trust — cap it rather than letting a single big recent game overrate it.
  const isBenchRole = inputs.status === "Bench" || inputs.status === "Confirmed Bench";
  if (isBenchRole && tier !== "Avoid" && TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf("Risky")) {
    tier = "Risky";
  }

  if (inputs.status === "Questionable" || inputs.status === "Game Time Decision") {
    tier = shiftTier(tier, -1);
  }

  if (inputs.minutesTrend === "down") tier = shiftTier(tier, -1);
  if (inputs.minutesTrend === "up" && !isBenchRole) tier = shiftTier(tier, 1);

  if (inputs.backToBack) tier = shiftTier(tier, -1);

  if (inputs.blowoutRisk === "High" && inputs.isFavorite) tier = shiftTier(tier, -1);

  return tier;
}

/** Confirmed-starter counts + availability lists for a "5/5 confirmed" style summary. */
export type TeamAvailabilitySummary = {
  confirmedStarters: number;
  lineupConfirmed: boolean;
  out: string[];
  questionable: string[];
  probable: string[];
};

export function buildTeamAvailabilitySummary(
  players: { name: string; status: LineupStatus; injuryStatus?: InjuryReportEntry["status"] }[],
): TeamAvailabilitySummary {
  const confirmedStarters = players.filter((p) => p.status === "Confirmed Starter").length;
  return {
    confirmedStarters,
    lineupConfirmed: confirmedStarters >= 5,
    out: players.filter((p) => p.status === "Out").map((p) => p.name),
    questionable: players
      .filter((p) => p.status === "Questionable" || p.status === "Game Time Decision")
      .map((p) => p.name),
    probable: players.filter((p) => p.injuryStatus === "Probable").map((p) => p.name),
  };
}

/** True when a game's own status/clock indicate it has actually started. */
export function gameHasStarted(status: Game["status"]): boolean {
  return status !== "scheduled";
}

/** Full Pre-Game Intelligence card for one player in tonight's game. */
export type PregamePlayerIntel = {
  playerId: string;
  name: string;
  position: string;
  teamId: string;
  teamAbbreviation: string;
  status: LineupStatus;
  injuryStatus?: InjuryReportEntry["status"];
  avgMinutesLast5: number | null;
  avgMinutesLast10: number | null;
  projectedMinutes: number | null;
  minutesTrend: "up" | "down" | "flat" | null;
  avgFptsLast5: number | null;
  avgFptsLast10: number | null;
  formTrend: GameLogMetrics["trend"];
  consistency: GameLogMetrics["consistency"];
  recommendation: RecommendationTier;
  backToBack: boolean;
};
