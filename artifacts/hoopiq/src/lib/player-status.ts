// Shared "is this player actually available" logic.
//
// The ESPN data this app ingests (see providers/espn.js) only ever gives us
// two explicit signals about availability: box score stats (which include
// minutes played) and an injury-report status ("OUT" / "GTD" / "Questionable"
// / "Probable"). There's no explicit "DNP" or "Inactive" flag in the feed.
//
// We derive "inactive" (covering OUT, DNP, Inactive, and Not-in-lineup, per
// the product ask) as: explicitly ruled OUT on the injury report, OR the
// game has actually started/finished and the player recorded zero minutes
// (they never took the floor — DNP-Coach's Decision, inactive, healthy
// scratch, etc. all look identical from the box score's point of view).
// Pregame ("scheduled"), nobody has "not played" yet, so nobody is inactive
// on that basis alone.

import { Game, Player } from "./types";

export function minutesValue(stats: Player["stats"]): number {
  const parsed = stats.minutes ? parseFloat(stats.minutes) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** True if the player should be treated as OUT / DNP / Inactive / Not-in-lineup. */
export function isPlayerInactive(player: Player, gameStatus: Game["status"]): boolean {
  if (player.injuryStatus === "OUT") return true;
  if (gameStatus === "scheduled") return false;
  return minutesValue(player.stats) === 0;
}

/**
 * Status label to surface as a badge. Explicit injury-report statuses take
 * priority (they're more specific); otherwise falls back to "DNP" once the
 * game is underway and the player still has zero minutes.
 */
export function inactiveStatusLabel(
  player: Player,
  gameStatus: Game["status"],
): "OUT" | "GTD" | "Questionable" | "Probable" | "DNP" | null {
  if (player.injuryStatus) return player.injuryStatus;
  if (gameStatus !== "scheduled" && minutesValue(player.stats) === 0) return "DNP";
  return null;
}

/**
 * Tier used to sort a player list: selected players always first, then
 * remaining active players, then inactive players always last — regardless
 * of whatever sort key/direction is otherwise applied.
 */
export function playerSortTier(
  player: Player,
  gameStatus: Game["status"],
  isSelected: boolean,
): number {
  if (isSelected) return 0;
  if (isPlayerInactive(player, gameStatus)) return 2;
  return 1;
}
