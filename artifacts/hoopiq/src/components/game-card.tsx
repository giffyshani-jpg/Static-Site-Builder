import React from "react";
import { Link } from "wouter";
import { Game } from "../lib/types";

const STATUS_PILL: Record<Game["status"], string> = {
  scheduled: "bg-muted/60 text-muted-foreground",
  in_progress: "bg-primary/15 text-primary",
  final: "bg-muted/40 text-muted-foreground",
};

function TeamRow({
  abbr,
  name,
  score,
  won,
  isLive,
}: {
  abbr: string;
  name: string;
  score: number | null;
  won: boolean;
  isLive: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border ${
            won ? "bg-foreground text-background border-transparent" : "bg-muted/50 text-muted-foreground border-border"
          }`}
        >
          {abbr}
        </div>
        <span className={`text-sm font-semibold truncate ${won ? "text-foreground" : "text-foreground/75"}`}>
          {name}
        </span>
      </div>
      <span
        className={`text-base font-bold tabular-nums shrink-0 ${
          won ? "text-foreground" : isLive ? "text-foreground/85" : "text-foreground/60"
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

export function GameCard({ game, showLeague = false }: { game: Game; showLeague?: boolean }) {
  const isScheduled = game.status === "scheduled";
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";

  const awayWon = isFinal && (game.awayTeam.score ?? 0) > (game.homeTeam.score ?? 0);
  const homeWon = isFinal && (game.homeTeam.score ?? 0) > (game.awayTeam.score ?? 0);

  return (
    <Link href={`/${game.league}/game/${game.id}`}>
      <div className="bg-card border border-border rounded-xl p-3.5 cursor-pointer active:scale-[0.97] hover:border-primary/30 hover:bg-card/80 transition-all shadow-sm flex flex-col gap-2.5">
        {/* Status row */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_PILL[game.status]}`}>
            {isLive ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {game.period} {game.clock ? `· ${game.clock}` : ""}
              </span>
            ) : isScheduled ? (
              game.startTime || "TODAY"
            ) : (
              "FINAL"
            )}
          </span>
          {showLeague && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              {game.league.toUpperCase()}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="flex flex-col gap-1.5">
          <TeamRow
            abbr={game.awayTeam.abbreviation}
            name={game.awayTeam.name}
            score={game.awayTeam.score}
            won={awayWon}
            isLive={isLive}
          />
          <TeamRow
            abbr={game.homeTeam.abbreviation}
            name={game.homeTeam.name}
            score={game.homeTeam.score}
            won={homeWon}
            isLive={isLive}
          />
        </div>
      </div>
    </Link>
  );
}
