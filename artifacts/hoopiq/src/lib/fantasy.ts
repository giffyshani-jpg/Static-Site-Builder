import { PlayerStats } from "./types";
import { calculateFantasyPoints } from "./stats";

/**
 * A simple, deterministic starting credit value derived from a player's
 * fantasy points in the selected game. This exists only so the credits
 * list isn't blank by default — the user can freely overwrite every
 * value. It is not a projection, ranking, or optimization algorithm.
 */
export function baselineCredits(stats: PlayerStats): number {
  const fpts = calculateFantasyPoints(stats);
  const raw = Math.round(fpts / 2);
  return Math.min(40, Math.max(4, raw || 4));
}
