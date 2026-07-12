import React from "react";
import { Link } from "wouter";
import { Game } from "../lib/types";

export function GameCard({ game }: { game: Game }) {
  const isScheduled = game.status === "scheduled";
  const inProgress = game.status === "in_progress";

  return (
    <Link href={`/${game.league}/game/${game.id}`}>
      <div className="bg-background border border-border rounded-xl p-4 mb-3 active:scale-[0.98] transition-transform shadow-sm flex flex-col gap-3 cursor-pointer">
        <div className="flex justify-between items-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>{isScheduled ? game.startTime : game.period} {game.clock && `- ${game.clock}`}</span>
          <span className={inProgress ? "text-primary" : ""}>
            {inProgress ? "LIVE" : isScheduled ? "TODAY" : "FINAL"}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Away Team */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground border border-border">
                {game.awayTeam.abbreviation}
              </div>
              <span className={`font-semibold text-lg ${game.status === 'final' && game.awayTeam.score! > game.homeTeam.score! ? 'text-foreground' : 'text-foreground/90'}`}>
                {game.awayTeam.name}
              </span>
            </div>
            <span className={`font-bold text-xl tabular-nums ${game.status === 'final' && game.awayTeam.score! > game.homeTeam.score! ? 'text-foreground' : 'text-foreground/80'}`}>
              {game.awayTeam.score ?? "-"}
            </span>
          </div>

          {/* Home Team */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground border border-border">
                {game.homeTeam.abbreviation}
              </div>
              <span className={`font-semibold text-lg ${game.status === 'final' && game.homeTeam.score! > game.awayTeam.score! ? 'text-foreground' : 'text-foreground/90'}`}>
                {game.homeTeam.name}
              </span>
            </div>
            <span className={`font-bold text-xl tabular-nums ${game.status === 'final' && game.homeTeam.score! > game.awayTeam.score! ? 'text-foreground' : 'text-foreground/80'}`}>
              {game.homeTeam.score ?? "-"}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
