// Hook that fetches a game once and then polls every LIVE_POLL_INTERVAL_MS
// while the game is in_progress. Stops automatically when the game ends.
//
// Returns:
//   game        – null while loading, undefined if not found, Game otherwise
//   lastUpdated – Date of the most recent successful fetch (null until first)
//   isLive      – true when status === "in_progress" and polling is active
//   isStale     – true when 2+ consecutive polls return no data (network issue)
//                 resets automatically when the next poll succeeds

import { useEffect, useRef, useState } from "react";
import { fetchGameById } from "../api";
import { Game } from "../lib/types";

export const LIVE_POLL_INTERVAL_MS = 5_000;
// Pre-Game Intelligence requirement: lineups/injuries/starting status
// refresh automatically every 60 seconds until tipoff, then stop (the
// in-progress polling above takes over once the game actually starts).
export const PREGAME_POLL_INTERVAL_MS = 60_000;

/** Number of consecutive empty poll results before isStale becomes true. */
const STALE_THRESHOLD = 2;

export type LiveGameState = {
  game: Game | null | undefined;
  lastUpdated: Date | null;
  isLive: boolean;
  /** True when recent polls are returning no data — likely a network hiccup. */
  isStale: boolean;
};

export function useLiveGame(
  gameId: string | undefined,
  league: import("../lib/types").LeagueKey,
): LiveGameState {
  const [game, setGame] = useState<Game | null | undefined>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);

  // Tracks consecutive failed/empty poll results across both poll loops.
  const stallCount = useRef(0);

  function onPollSuccess(loaded: Game) {
    stallCount.current = 0;
    setIsStale(false);
    setGame(loaded);
    setLastUpdated(new Date());
  }

  function onPollMiss() {
    stallCount.current += 1;
    if (stallCount.current >= STALE_THRESHOLD) setIsStale(true);
  }

  // Initial fetch – resets state when gameId/league changes.
  useEffect(() => {
    let cancelled = false;
    setGame(null);
    setLastUpdated(null);
    setIsStale(false);
    stallCount.current = 0;

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
      // noCache: true — live polls must always hit the network, not a stale
      // cache entry. The result is still written to the cache so a component
      // remount right after a tick sees fresh data.
      const data = await fetchGameById(gameId, league, { noCache: true });
      if (cancelled) return;
      const loaded = (data as Game | undefined) ?? undefined;
      if (loaded) {
        onPollSuccess(loaded);
      } else {
        onPollMiss();
      }
    }, LIVE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [game?.status, gameId, league]);

  // Pregame polling – refreshes confirmed lineups / injury reports /
  // starting status every 60s while the game hasn't started yet. Stops
  // the moment the game flips to in_progress (the 5s live polling above
  // takes over) or final, matching the "stop refreshing after game
  // starts" requirement.
  useEffect(() => {
    if (!game || game.status !== "scheduled" || !gameId) return;

    let cancelled = false;
    const id = setInterval(async () => {
      // noCache: true — pregame polls should reflect the latest injury/lineup
      // updates from ESPN, not a 2-min-old cached entry.
      const data = await fetchGameById(gameId, league, { noCache: true });
      if (cancelled) return;
      const loaded = (data as Game | undefined) ?? undefined;
      if (loaded) {
        onPollSuccess(loaded);
      } else {
        onPollMiss();
      }
    }, PREGAME_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [game?.status, gameId, league]);

  const isLive = game?.status === "in_progress";
  return { game, lastUpdated, isLive, isStale };
}
