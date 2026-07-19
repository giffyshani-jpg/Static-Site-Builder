// Derived metrics computed from a real ESPN game log (lib/types.ts
// PlayerGameLogEntry[], newest-first). All numbers here are computed
// fresh from network data — nothing is stored beyond the cache in
// lib/game-log-cache.ts.

import { calculateFantasyPoints } from "./stats";
import { minutesValue } from "./player-status";
import { PlayerGameLogEntry } from "./types";

export type FormTrend = "Hot" | "Average" | "Cold";
export type ConsistencyRating = "Consistent" | "Somewhat Consistent" | "Volatile";

export type GameLogMetrics = {
  /** Fantasy points for each game, newest-first (parallel to the input array). */
  fptsByGame: number[];
  avgFptsLast5: number | null;
  avgFptsLast10: number | null;
  highFpts: number | null;
  lowFpts: number | null;
  /** Minutes for each game, newest-first. */
  minutesByGame: number[];
  avgMinutesLast5: number | null;
  avgMinutesLast10: number | null;
  /** "up" / "down" / "flat" comparing the most recent game's minutes to the prior average. */
  minutesTrend: "up" | "down" | "flat" | null;
  trend: FormTrend;
  consistency: ConsistencyRating | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values) ?? 0;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Hot/Average/Cold based on the most recent game vs. the average of the
 * rest of the window — same threshold convention as
 * components/recent-form-badge.tsx, just applied to real game-log data.
 */
function computeTrend(fptsNewestFirst: number[]): FormTrend {
  if (fptsNewestFirst.length < 2) return "Average";
  const [latest, ...rest] = fptsNewestFirst;
  const priorAvg = average(rest) ?? latest;
  if (latest > priorAvg + 1.5) return "Hot";
  if (latest < priorAvg - 1.5) return "Cold";
  return "Average";
}

/**
 * Consistency rating from the coefficient of variation (stdev / mean) of
 * fantasy points over the sampled window. Thresholds are a reasonable,
 * clearly-labeled heuristic rather than an official stat.
 */
function computeConsistency(fpts: number[]): ConsistencyRating | null {
  if (fpts.length < 3) return null;
  const mean = average(fpts) ?? 0;
  if (mean <= 0) return null;
  const cv = standardDeviation(fpts) / mean;
  if (cv < 0.25) return "Consistent";
  if (cv < 0.5) return "Somewhat Consistent";
  return "Volatile";
}

function computeMinutesTrend(minutesNewestFirst: number[]): "up" | "down" | "flat" | null {
  if (minutesNewestFirst.length < 2) return null;
  const [latest, ...rest] = minutesNewestFirst;
  const priorAvg = average(rest) ?? latest;
  if (latest > priorAvg + 3) return "up";
  if (latest < priorAvg - 3) return "down";
  return "flat";
}

/** entries must be newest-first, as returned by fetchPlayerGameLog. */
export function computeGameLogMetrics(entries: PlayerGameLogEntry[]): GameLogMetrics {
  const fptsByGame = entries.map((e) => calculateFantasyPoints(e.stats));
  const minutesByGame = entries.map((e) => minutesValue(e.stats));

  const last5 = fptsByGame.slice(0, 5);
  const last10 = fptsByGame.slice(0, 10);

  return {
    fptsByGame,
    avgFptsLast5: average(last5),
    avgFptsLast10: average(last10),
    highFpts: fptsByGame.length > 0 ? Math.max(...fptsByGame) : null,
    lowFpts: fptsByGame.length > 0 ? Math.min(...fptsByGame) : null,
    minutesByGame,
    avgMinutesLast5: average(minutesByGame.slice(0, 5)),
    avgMinutesLast10: average(minutesByGame.slice(0, 10)),
    minutesTrend: computeMinutesTrend(minutesByGame),
    trend: computeTrend(fptsByGame),
    consistency: computeConsistency(last10),
  };
}
