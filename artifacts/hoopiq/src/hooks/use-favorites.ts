import { useCallback, useEffect, useState } from "react";
import { getStoredFavoriteIds, setStoredFavoriteIds } from "../lib/favorites";

/**
 * Manages the global set of favorited player ids, backed by localStorage.
 * Shared by every page that shows a player row or column (box score,
 * fantasy optimizer, player comparison) so starring a player in one
 * place is reflected everywhere.
 */
export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    setFavoriteIds(getStoredFavoriteIds());
  }, []);

  const persist = useCallback((ids: string[]) => {
    setFavoriteIds(ids);
    setStoredFavoriteIds(ids);
  }, []);

  const isFavorite = useCallback((playerId: string) => favoriteIds.includes(playerId), [favoriteIds]);

  const toggleFavorite = useCallback(
    (playerId: string) => {
      if (favoriteIds.includes(playerId)) {
        persist(favoriteIds.filter((id) => id !== playerId));
      } else {
        persist([...favoriteIds, playerId]);
      }
    },
    [favoriteIds, persist],
  );

  return { favoriteIds, isFavorite, toggleFavorite };
}
