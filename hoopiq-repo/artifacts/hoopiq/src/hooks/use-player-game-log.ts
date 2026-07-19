import { useEffect, useState } from "react";
import { fetchPlayerGameLog } from "../api";
import { getCachedGameLog, setCachedGameLog } from "../lib/game-log-cache";
import { PlayerGameLogEntry } from "../lib/types";

export type PlayerGameLogState = {
  /** null while loading, [] if the player has no logged games this season. */
  games: PlayerGameLogEntry[] | null;
  /** True when the current `games` came from the cache rather than a fresh request. */
  fromCache: boolean;
  error: boolean;
};

/**
 * Loads a player's real game history from ESPN (via a 30–60 min
 * client-side cache — see lib/game-log-cache.ts), never from locally
 * viewed box scores. Re-fetches whenever playerId/league changes.
 */
export function usePlayerGameLog(playerId: string | undefined, league: import("../lib/types").LeagueKey): PlayerGameLogState {
  const [state, setState] = useState<PlayerGameLogState>({ games: null, fromCache: false, error: false });

  useEffect(() => {
    if (!playerId) {
      setState({ games: null, fromCache: false, error: false });
      return;
    }

    let cancelled = false;
    setState({ games: null, fromCache: false, error: false });

    const cached = getCachedGameLog(league, playerId);
    if (cached) {
      setState({ games: cached, fromCache: true, error: false });
      return;
    }

    fetchPlayerGameLog(playerId, league)
      .then((games: PlayerGameLogEntry[]) => {
        if (cancelled) return;
        setCachedGameLog(league, playerId, games);
        setState({ games, fromCache: false, error: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ games: [], fromCache: false, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [playerId, league]);

  return state;
}
