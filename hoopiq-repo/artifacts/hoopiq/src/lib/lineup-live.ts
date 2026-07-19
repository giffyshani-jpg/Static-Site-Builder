// Live/projected stats for a *saved* lineup, computed from the game data
// that's already being polled on the Fantasy Optimizer page. This lets the
// Saved Lineups list show up-to-date totals without the user having to load
// a lineup first — it just re-derives from whatever `players` currently is,
// so it updates automatically whenever the live poll refreshes `game`.

import { Game, Player } from "./types";
import { LineupState, fptsMultiplier, getPlayerRole } from "./lineup-storage";
import { minutesValue } from "./player-status";

export type SavedLineupLiveStats = {
  /** How many of the saved lineup's player ids still exist on this game's roster. */
  rosteredCount: number;
  /** Current effective FPTS total (captain/VC multipliers applied) right now. */
  liveFpts: number;
  /**
   * Projected final FPTS total: uses each player's recent-form average as a
   * full-game estimate (never below what they've already scored live), and
   * collapses to the actual live total once the game is final.
   */
  projectedFpts: number;
  /** Rostered players currently on the floor accruing stats (game live, minutes > 0). */
  playersPlaying: number;
  /** Rostered players whose game is over. */
  playersFinished: number;
};

export function computeSavedLineupLiveStats(
  lineup: LineupState,
  players: (Player & { baseFpts: number })[],
  gameStatus: Game["status"],
  getFormAverage: (playerId: string) => number | null,
): SavedLineupLiveStats {
  const byId = new Map(players.map((p) => [p.id, p]));
  const rosteredIds = lineup.playerIds.filter((id) => byId.has(id));

  let liveFpts = 0;
  let projectedFpts = 0;
  let playersPlaying = 0;
  let playersFinished = 0;

  for (const id of rosteredIds) {
    const player = byId.get(id)!;
    const mult = fptsMultiplier(getPlayerRole(id, lineup));

    liveFpts += player.baseFpts * mult;

    const formAvg = getFormAverage(id);
    const projectedBase =
      gameStatus === "final"
        ? player.baseFpts
        : formAvg !== null
          ? Math.max(formAvg, player.baseFpts)
          : player.baseFpts;
    projectedFpts += projectedBase * mult;

    if (gameStatus === "final") {
      playersFinished += 1;
    } else if (gameStatus === "in_progress" && minutesValue(player.stats) > 0) {
      playersPlaying += 1;
    }
  }

  return {
    rosteredCount: rosteredIds.length,
    liveFpts,
    projectedFpts,
    playersPlaying,
    playersFinished,
  };
}
