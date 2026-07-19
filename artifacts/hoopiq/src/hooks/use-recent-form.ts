import { useCallback } from "react";
import { getRecentForm, recordPlayerGames, PlayerGameEntry } from "../lib/player-history";

/**
 * Thin wrapper around the local player-history store. Unlike favorites
 * and comparisons, recent-form data doesn't need to drive re-renders on
 * its own — pages call `recordGame` once after a box score loads, and
 * read `getForm` per-row at render time.
 */
export function useRecentForm() {
  const recordGame = useCallback(
    (players: { id: string; fpts: number }[], gameId: string, timestamp: number) => {
      recordPlayerGames(
        players.map((p) => ({ playerId: p.id, fpts: p.fpts })),
        gameId,
        timestamp,
      );
    },
    [],
  );

  const getForm = useCallback((playerId: string): PlayerGameEntry[] => getRecentForm(playerId), []);

  return { recordGame, getForm };
}
