import { InjuryBadge } from "./injury-badge";
import { inactiveStatusLabel, starterBadgeLabel } from "../lib/player-status";
import { Game, Player } from "../lib/types";

/**
 * Consistent status-badge rendering shared by Box Score, Fantasy Optimizer,
 * and Player Comparison: an availability badge (OUT/GTD/Questionable/
 * Probable/DNP) plus a lineup-role badge (Starter/Bench), shown side by
 * side. Renders nothing when neither is known for this player/game.
 */
export function PlayerStatusBadges({
  player,
  gameStatus,
  className = "",
}: {
  player: Player;
  gameStatus: Game["status"];
  className?: string;
}) {
  const status = inactiveStatusLabel(player, gameStatus);
  const starter = starterBadgeLabel(player);

  if (!status && !starter) return null;

  return (
    <span className={`inline-flex items-center gap-1 shrink-0 ${className}`}>
      <InjuryBadge status={status ?? undefined} />
      <InjuryBadge status={starter ?? undefined} />
    </span>
  );
}
