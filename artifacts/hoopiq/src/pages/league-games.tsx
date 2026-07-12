import React from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { getGamesByLeague } from "../lib/mock-data";

export default function LeagueGames() {
  const params = useParams();
  const league = params.league as "nba" | "wnba";
  
  if (league !== "nba" && league !== "wnba") {
    return (
      <MobileLayout showBack title="Not Found">
        <div className="p-8 text-center text-muted-foreground">League not found</div>
      </MobileLayout>
    );
  }

  const games = getGamesByLeague(league);

  return (
    <MobileLayout showBack title={league.toUpperCase() + " Today"}>
      <div className="p-4 bg-muted/30 min-h-full">
        {games.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No games scheduled for today.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {games.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
