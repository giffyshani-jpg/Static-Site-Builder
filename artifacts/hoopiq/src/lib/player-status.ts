// Shared "is this player actually available" logic.
//
// ESPN's box score athlete entries carry explicit `starter` and `didNotPlay`
// flags alongside an injury-report status ("OUT" / "GTD" / "Questionable" /
// "Probable") — see providers/espn.js. Both are undefined pregame, before a
// box score has been published.
//
// We derive "inactive" (covering OUT, DNP, Inactive, and Not-in-lineup, per
// the product ask) as: explicitly ruled OUT on the injury report, OR ESPN's
// own `didNotPlay` flag is true, OR — as a fallback for feed shapes that
// omit that flag — the game has started/finished and the player recorded
// zero minutes. Pregame ("scheduled"), nobody has "not played" yet, so
// nobody is inactive on that basis alone.

import { Game, Player } from "./types";

export function minutesValue(stats: Player["stats"]): number {
  const parsed = stats.minutes ? parseFloat(stats.minutes) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** True if the player should be treated as OUT / DNP / Inactive / Not-in-lineup. */
export function isPlayerInactive(player: Player, gameStatus: Game["status"]): boolean {
  if (player.injuryStatus === "OUT") return true;
  if (gameStatus === "scheduled") return false;
  if (player.didNotPlay === true) return true;
  if (player.didNotPlay === false) return false;
  return minutesValue(player.stats) === 0;
}

/**
 * Status label to surface as a badge. Explicit injury-report statuses take
 * priority (they're more specific); otherwise falls back to "DNP" once the
 * game is underway and the player is confirmed (or inferred) to not have
 * played.
 */
export function inactiveStatusLabel(
  player: Player,
  gameStatus: Game["status"],
): "OUT" | "GTD" | "Questionable" | "Probable" | "DNP" | null {
  if (player.injuryStatus) return player.injuryStatus;
  if (gameStatus === "scheduled") return null;
  if (player.didNotPlay === true) return "DNP";
  if (player.didNotPlay === false) return null;
  if (minutesValue(player.stats) === 0) return "DNP";
  return null;
}

/**
 * Starter/Bench label sourced directly from ESPN's per-athlete `starter`
 * flag. Returns null when unknown (pregame, no box score published yet) so
 * the UI can simply omit the badge rather than guessing.
 */
export function starterBadgeLabel(player: Player): "Starter" | "Bench" | null {
  if (typeof player.starter !== "boolean") return null;
  return player.starter ? "Starter" : "Bench";
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
