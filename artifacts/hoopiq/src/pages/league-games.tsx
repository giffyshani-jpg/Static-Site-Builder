import React, { useEffect, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { fetchGamesByLeague } from "../api";
import { Game } from "../lib/types";

export default function LeagueGames() {
  const params = useParams();
  const league = params.league as "nba" | "wnba";

  const [games, setGames] = useState<Game[] | null>(null);

  useEffect(() => {
    if (league !== "nba" && league !== "wnba") return;
    let cancelled = false;
    setGames(null);
    fetchGamesByLeague(league).then((data) => {
      if (!cancelled) setGames(data as Game[]);
    });
    return () => {
      cancelled = true;
    };
  }, [league]);

  if (league !== "nba" && league !== "wnba") {
    return (
      <MobileLayout showBack title="Not Found">
        <div className="p-8 text-center text-muted-foreground">League not found</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showBack title={league.toUpperCase() + " Today"}>
      <div className="p-4 sm:p-6 bg-muted/30 min-h-full">
        {games === null ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Loading games...
          </div>
        ) : games.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No games scheduled for today.
          </div>
        ) : (
          <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-1 sm:gap-3">
            {games.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
