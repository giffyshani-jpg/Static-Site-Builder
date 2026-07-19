// GameCard — premium sports score card.
//
// Visual hierarchy: status badge → team matchup with scores → time/period.
// Cards link to the full game detail page (box score, play-by-play, pregame intel).
//
// States:
//   scheduled   → start time, dim team names, no score
//   in_progress → live pulse dot, period + clock, bold leading score
//   final       → winning team highlighted, score in full

import React from "react";
import { Link } from "wouter";
import { Game } from "../lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function leagueColor(league: Game["league"]): string {
  const map: Record<string, string> = {
    nba: "from-blue-500 to-blue-700",
    wnba: "from-orange-500 to-orange-700",
    "nba-summer": "from-sky-500 to-sky-700",
    nbl: "from-emerald-500 to-emerald-700",
    nznbl: "from-teal-500 to-teal-700",
    fiba: "from-violet-500 to-violet-700",
  };
  return map[league] ?? "from-slate-500 to-slate-700";
}

function leagueLabel(league: Game["league"]): string {
  const map: Record<string, string> = {
    nba: "NBA",
    wnba: "WNBA",
    "nba-summer": "SL",
    nbl: "NBL",
    nznbl: "NZ",
    fiba: "FIBA",
  };
  return map[league] ?? league.toUpperCase();
}

// ─── Atoms ───────────────────────────────────────────────────────────────────

function LivePulse() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
    </span>
  );
}

function TeamBadge({
  abbr,
  won,
  isLive,
  leading,
}: {
  abbr: string;
  won: boolean;
  isLive: boolean;
  leading: boolean;
}) {
  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 transition-colors ${
        won
          ? "bg-foreground text-background"
          : leading && isLive
            ? "bg-primary/20 text-primary border border-primary/30"
            : "bg-muted/60 text-muted-foreground border border-border"
      }`}
    >
      {abbr.slice(0, 3)}
    </div>
  );
}

function TeamRow({
  abbr,
  name,
  score,
  won,
  isLive,
  leading,
  isScheduled,
}: {
  abbr: string;
  name: string;
  score: number | null;
  won: boolean;
  isLive: boolean;
  leading: boolean;
  isScheduled: boolean;
}) {
  const hasScore = score !== null && !isScheduled;

  return (
    <div className="flex items-center justify-between gap-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <TeamBadge abbr={abbr} won={won} isLive={isLive} leading={leading} />
        <span
          className={`text-sm font-semibold truncate leading-tight ${
            won
              ? "text-foreground"
              : leading && isLive
                ? "text-foreground"
                : isScheduled
                  ? "text-foreground/70"
                  : "text-foreground/75"
          }`}
        >
          {name}
        </span>
      </div>
      {hasScore && (
        <span
          className={`tabular-nums shrink-0 font-bold transition-colors ${
            won
              ? "text-xl text-foreground"
              : leading && isLive
                ? "text-xl text-primary"
                : "text-lg text-foreground/60"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function GameCard({ game, showLeague = false }: { game: Game; showLeague?: boolean }) {
  const isScheduled = game.status === "scheduled";
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";

  const awayScore = game.awayTeam.score ?? 0;
  const homeScore = game.homeTeam.score ?? 0;
  const awayWon = isFinal && awayScore > homeScore;
  const homeWon = isFinal && homeScore > awayScore;
  const awayLeading = (isLive) && awayScore > homeScore;
  const homeLeading = (isLive) && homeScore > awayScore;

  return (
    <Link href={`/${game.league}/game/${game.id}`}>
      <div
        className={`
          relative bg-card border rounded-xl overflow-hidden cursor-pointer
          transition-all duration-200 shadow-sm group
          hover:border-primary/40 hover:shadow-md hover:shadow-primary/5
          active:scale-[0.98]
          ${isLive ? "border-primary/25" : "border-border"}
        `}
      >
        {/* Live accent stripe */}
        {isLive && (
          <div className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-primary/80 via-primary to-primary/40" />
        )}

        {/* Status row */}
        <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
          {/* Left: status pill */}
          <div className="flex items-center gap-1.5">
            {isLive ? (
              <>
                <LivePulse />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                  {game.period}
                  {game.clock ? ` · ${game.clock}` : ""}
                </span>
              </>
            ) : isScheduled ? (
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                {game.startTime || "TODAY"}
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                FINAL
              </span>
            )}
          </div>

          {/* Right: league badge + link indicator */}
          <div className="flex items-center gap-2">
            {showLeague && (
              <span
                className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-gradient-to-r ${leagueColor(game.league)} text-white`}
              >
                {leagueLabel(game.league)}
              </span>
            )}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>

        {/* Teams + scores */}
        <div className="flex flex-col gap-1.5 px-3.5 pb-3.5">
          <TeamRow
            abbr={game.awayTeam.abbreviation}
            name={game.awayTeam.name}
            score={game.awayTeam.score}
            won={awayWon}
            isLive={isLive}
            leading={awayLeading}
            isScheduled={isScheduled}
          />
          {/* Divider */}
          <div className="h-px bg-border/50 ml-10.5" />
          <TeamRow
            abbr={game.homeTeam.abbreviation}
            name={game.homeTeam.name}
            score={game.homeTeam.score}
            won={homeWon}
            isLive={isLive}
            leading={homeLeading}
            isScheduled={isScheduled}
          />
        </div>

        {/* Blowout risk / odds footer (when available and scheduled) */}
        {isScheduled && game.pregameOdds?.spread && (
          <div className="border-t border-border/40 px-3.5 py-1.5">
            <span className="text-[10px] text-muted-foreground/50">
              Spread {game.pregameOdds.spread > 0 ? `+${game.pregameOdds.spread}` : game.pregameOdds.spread} pts
              {game.pregameOdds.overUnder ? ` · O/U ${game.pregameOdds.overUnder}` : ""}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
