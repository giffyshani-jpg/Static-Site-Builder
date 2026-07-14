// Hook that fetches a game once and then polls every LIVE_POLL_INTERVAL_MS
// while the game is in_progress. Stops automatically when the game ends.
//
// Returns:
//   game       – null while loading, undefined if not found, Game otherwise
//   lastUpdated – Date of the most recent successful fetch (null until first)
//   isLive      – true when status === "in_progress" and polling is active

import { useEffect, useState } from "react";
import { fetchGameById } from "../api";
import { Game } from "../lib/types";

export const LIVE_POLL_INTERVAL_MS = 5_000;

export type LiveGameState = {
  game: Game | null | undefined;
  lastUpdated: Date | null;
  isLive: boolean;
};

export function useLiveGame(
  gameId: string | undefined,
  league: "nba" | "wnba",
): LiveGameState {
  const [game, setGame] = useState<Game | null | undefined>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Initial fetch – resets state when gameId/league changes.
  useEffect(() => {
    let cancelled = false;
    setGame(null);
    setLastUpdated(null);

    fetchGameById(gameId ?? "", league).then((data) => {
      if (cancelled) return;
      const loaded = (data as Game | undefined) ?? undefined;
      setGame(loaded ?? undefined);
      if (loaded) setLastUpdated(new Date());
    });

    return () => {
      cancelled = true;
    };
  }, [gameId, league]);

  // Live polling – only active while the game is in progress.
  useEffect(() => {
    if (!game || game.status !== "in_progress" || !gameId) return;

    let cancelled = false;
    const id = setInterval(async () => {
      const data = await fetchGameById(gameId, league);
      if (cancelled) return;
      const loaded = (data as Game | undefined) ?? undefined;
      if (loaded) {
        setGame(loaded);
        setLastUpdated(new Date());
      }
    }, LIVE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [game?.status, gameId, league]);

  const isLive = game?.status === "in_progress";
  return { game, lastUpdated, isLive };
}
