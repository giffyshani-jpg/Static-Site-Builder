import { PlayerStats } from "./types";

export function calculateFantasyPoints(stats: PlayerStats): number {
  return (
    stats.points * 1 +
    stats.rebounds * 1.2 +
    stats.assists * 1.5 +
    stats.steals * 3 +
    stats.blocks * 3 +
    stats.turnovers * -1
  );
}
