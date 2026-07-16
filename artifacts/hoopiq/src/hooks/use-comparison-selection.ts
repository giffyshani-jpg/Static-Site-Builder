import { useCallback, useEffect, useState } from "react";
import {
  MAX_COMPARE_PLAYERS,
  getStoredComparisonIds,
  setStoredComparisonIds,
} from "../lib/comparison";

/**
 * Manages the set of player ids selected for comparison within a single
 * game, backed by localStorage (scoped per gameId). Shared by every page
 * that exposes a "Compare" action (box score, fantasy optimizer) and by
 * the comparison page itself.
 */
export function useComparisonSelection(gameId: string | undefined) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds(gameId ? getStoredComparisonIds(gameId) : []);
  }, [gameId]);

  const persist = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      if (gameId) setStoredComparisonIds(gameId, ids);
    },
    [gameId],
  );

  const isSelected = useCallback((playerId: string) => selectedIds.includes(playerId), [selectedIds]);

  const isFull = selectedIds.length >= MAX_COMPARE_PLAYERS;

  const add = useCallback(
    (playerId: string) => {
      if (selectedIds.includes(playerId) || selectedIds.length >= MAX_COMPARE_PLAYERS) return;
      persist([...selectedIds, playerId]);
    },
    [selectedIds, persist],
  );

  const remove = useCallback(
    (playerId: string) => {
      persist(selectedIds.filter((id) => id !== playerId));
    },
    [selectedIds, persist],
  );

  const toggle = useCallback(
    (playerId: string) => {
      if (selectedIds.includes(playerId)) {
        remove(playerId);
      } else {
        add(playerId);
      }
    },
    [selectedIds, add, remove],
  );

  return { selectedIds, isSelected, isFull, add, remove, toggle };
}
