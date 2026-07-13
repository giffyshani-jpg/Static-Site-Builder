import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { CompareBar } from "../components/compare-bar";
import { StarButton } from "../components/star-button";
import { fetchGameById } from "../api";
import { calculateFantasyPoints } from "../lib/stats";
import { useComparisonSelection } from "../hooks/use-comparison-selection";
import { useFavorites } from "../hooks/use-favorites";
import { Game } from "../lib/types";

export default function BoxScore() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as "nba" | "wnba";

  const [game, setGame] = useState<Game | null | undefined>(null);
  const [activeTab, setActiveTab] = useState<"away" | "home">("away");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const comparison = useComparisonSelection(gameId);
  const favorites = useFavorites();

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    fetchGameById(gameId || "", league).then((data) => {
      if (!cancelled) setGame((data as Game | undefined) ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, league]);

  const activeTeam = game ? (activeTab === "away" ? game.awayTeam : game.homeTeam) : undefined;

  const visiblePlayers = useMemo(() => {
    const teamPlayers = activeTeam?.players ?? [];
    const base = favoritesOnly
      ? teamPlayers.filter((p) => favorites.isFavorite(p.id))
      : teamPlayers;

    // Favorites always bubble to the top, otherwise preserve original order.
    return [...base].sort((a, b) => {
      const aFav = favorites.isFavorite(a.id) ? 1 : 0;
      const bFav = favorites.isFavorite(b.id) ? 1 : 0;
      return bFav - aFav;
    });
  }, [activeTeam, favorites, favoritesOnly]);

  if (game === null) {
    return (
      <MobileLayout showBack title="Loading">
        <div className="p-8 text-center text-muted-foreground">Loading game...</div>
      </MobileLayout>
    );
  }

  if (!game || !activeTeam) {
    return (
      <MobileLayout showBack title="Not Found">
        <div className="p-8 text-center text-muted-foreground">Game not found</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showBack title={`${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation}`}>
      
      {/* Scoreboard Header */}
      <div className="bg-card border-b border-border p-6 flex flex-col items-center">
        <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-4">
          {game.status === "scheduled" ? game.startTime : game.period}
          {game.clock && ` - ${game.clock}`}
        </div>
        
        <div className="flex justify-between items-center w-full max-w-[280px]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground border-2 border-border shadow-sm">
              {game.awayTeam.abbreviation}
            </div>
            <span className="font-bold text-2xl tabular-nums tracking-tight">
              {game.awayTeam.score ?? "-"}
            </span>
          </div>
          
          <div className="text-muted-foreground font-medium text-sm">
            AT
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground border-2 border-border shadow-sm">
              {game.homeTeam.abbreviation}
            </div>
            <span className="font-bold text-2xl tabular-nums tracking-tight">
              {game.homeTeam.score ?? "-"}
            </span>
          </div>
        </div>

        <div className="mt-5 w-full max-w-[280px] grid grid-cols-1 gap-2">
          <Link href={`/${game.league}/game/${game.id}/optimizer`}>
            <div className="rounded-xl bg-primary text-primary-foreground border border-primary-border py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20" />
                <path d="M2 12h20" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              Fantasy Optimizer
            </div>
          </Link>

          <Link href={`/${game.league}/game/${game.id}/plays`}>
            <div className="rounded-xl bg-secondary text-secondary-foreground border border-secondary-border py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" />
                <path d="M4 12h10" />
                <path d="M4 18h7" />
              </svg>
              Play-by-Play
            </div>
          </Link>
        </div>
      </div>

      {/* Team Tabs */}
      <div className="flex border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={() => setActiveTab("away")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "away" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {game.awayTeam.name}
        </button>
        <button
          onClick={() => setActiveTab("home")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "home" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {game.homeTeam.name}
        </button>
      </div>

      {/* Favorites filter */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
        <span className="text-xs font-medium text-muted-foreground">Favorites only</span>
        <button
          type="button"
          role="switch"
          aria-checked={favoritesOnly}
          onClick={() => setFavoritesOnly((v) => !v)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${favoritesOnly ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${favoritesOnly ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
      </div>

      {/* Stats Table */}
      <div className="w-full overflow-x-auto bg-card pb-12">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-muted-foreground bg-muted/40 uppercase sticky top-0">
            <tr>
              <th className="px-2 py-3 font-medium text-center w-10">Star</th>
              <th className="px-4 py-3 font-medium sticky left-10 bg-muted/95 z-10 shadow-[1px_0_0_0_var(--color-border)] min-w-[140px]">Player</th>
              <th className="px-3 py-3 font-medium text-right">FPTS</th>
              <th className="px-3 py-3 font-medium text-right">PTS</th>
              <th className="px-3 py-3 font-medium text-right">REB</th>
              <th className="px-3 py-3 font-medium text-right">AST</th>
              <th className="px-3 py-3 font-medium text-right">STL</th>
              <th className="px-3 py-3 font-medium text-right">BLK</th>
              <th className="px-3 py-3 font-medium text-right">TO</th>
              <th className="px-3 py-3 font-medium text-center">Compare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visiblePlayers.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  No favorited players on this team.
                </td>
              </tr>
            ) : (
            visiblePlayers.map((player) => {
              const fpts = calculateFantasyPoints(player.stats);
              const isComparing = comparison.isSelected(player.id);
              const disableAdd = comparison.isFull && !isComparing;
              const isFavorite = favorites.isFavorite(player.id);
              return (
                <tr key={player.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-2 py-3 text-center">
                    <StarButton
                      active={isFavorite}
                      onToggle={() => favorites.toggleFavorite(player.id)}
                      label={isFavorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
                    />
                  </td>
                  <td className="px-4 py-3 sticky left-10 bg-card z-10 shadow-[1px_0_0_0_var(--color-border)]">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground truncate max-w-[120px]">{player.name}</span>
                      <span className="text-xs text-muted-foreground">#{player.number} • {player.position}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-primary tabular-nums">
                    {fpts.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.points}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.rebounds}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.assists}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.steals}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.blocks}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{player.stats.turnovers}</td>
                  <td className="px-3 py-3 text-center">
                    <button
                      type="button"
                      disabled={disableAdd}
                      onClick={() => comparison.toggle(player.id)}
                      className={`text-xs font-semibold rounded-md px-2.5 py-1 border transition-colors ${
                        isComparing
                          ? "bg-primary text-primary-foreground border-primary-border"
                          : disableAdd
                            ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                            : "border-border text-foreground hover:bg-muted/40"
                      }`}
                    >
                      {isComparing ? "Added" : "Compare"}
                    </button>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>

      <CompareBar league={game.league} gameId={game.id} count={comparison.selectedIds.length} />
    </MobileLayout>
  );
}
