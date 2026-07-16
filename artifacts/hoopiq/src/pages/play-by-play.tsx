import React, { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { useLiveGame } from "../hooks/use-live-game";
import { PlayByPlayEvent } from "../lib/types";

function teamAbbreviationFor(
  awayId: string,
  awayAbbr: string,
  homeId: string,
  homeAbbr: string,
  teamId: string | null,
): string {
  if (!teamId) return "";
  if (awayId === teamId) return awayAbbr;
  if (homeId === teamId) return homeAbbr;
  return "";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function PlayByPlay() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as import("../lib/types").LeagueKey;

  const { game, lastUpdated, isLive } = useLiveGame(gameId, league);

  const [showJump, setShowJump] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const prevPlayCount = useRef(0);

  const plays: PlayByPlayEvent[] = game?.playByPlay ?? [];
  // Newest first.
  const reversedPlays = [...plays].reverse();

  // Auto-scroll to top (newest) when new plays arrive.
  useEffect(() => {
    if (!game) return;
    const count = reversedPlays.length;
    if (count > prevPlayCount.current && prevPlayCount.current !== 0) {
      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevPlayCount.current = count;
  }, [reversedPlays.length, game]);

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setShowJump(el.scrollTop > 200);
  };

  const jumpToLatest = () => {
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (game === null) {
    return (
      <MobileLayout showBack title="Play-by-Play">
        <div className="p-8 text-center text-muted-foreground">Loading game...</div>
      </MobileLayout>
    );
  }

  if (!game) {
    return (
      <MobileLayout showBack title="Play-by-Play">
        <div className="p-8 text-center text-muted-foreground">Game not found</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showBack title="Play-by-Play">
      <div className="flex flex-col h-full">
        {/* Game context strip */}
        <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0 gap-3">
          <div className="text-sm font-semibold text-foreground">
            {game.awayTeam.abbreviation} {game.awayTeam.score ?? "-"} @{" "}
            {game.homeTeam.abbreviation} {game.homeTeam.score ?? "-"}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLive && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            )}
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {game.status === "scheduled" ? game.startTime : game.period}
              {game.clock && ` • ${game.clock}`}
            </div>
          </div>
        </div>

        {/* Last updated bar */}
        {lastUpdated && (
          <div className="px-4 py-1.5 bg-muted/30 border-b border-border shrink-0">
            <p className="text-[10px] text-muted-foreground">
              {isLive ? "Auto-updating every 5s · " : ""}
              Last updated {formatTime(lastUpdated)}
            </p>
          </div>
        )}

        {/* Play list */}
        <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative px-4 py-3">
          {reversedPlays.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No play-by-play data available for this game yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-4">
              {reversedPlays.map((play) => {
                const teamAbbr = teamAbbreviationFor(
                  game.awayTeam.id,
                  game.awayTeam.abbreviation,
                  game.homeTeam.id,
                  game.homeTeam.abbreviation,
                  play.teamId,
                );
                const isScoring = play.scoringPlay;
                const isSub = play.isSubstitution;

                let rowClasses =
                  "rounded-xl border p-3 flex items-start gap-3 transition-colors ";
                if (isScoring) {
                  rowClasses += "border-primary bg-primary/10";
                } else if (isSub) {
                  rowClasses += "border-accent-border bg-accent/40";
                } else {
                  rowClasses += "border-border bg-card";
                }

                return (
                  <div key={play.id} className={rowClasses}>
                    <div className="flex flex-col items-center w-12 shrink-0 text-center">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase leading-tight">
                        {play.period}
                      </span>
                      <span className="text-xs font-bold tabular-nums text-foreground leading-tight">
                        {play.clock}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {teamAbbr && (
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground shrink-0">
                            {teamAbbr}
                          </span>
                        )}
                        {isScoring && (
                          <span className="text-[10px] font-bold uppercase text-primary shrink-0">
                            Score
                          </span>
                        )}
                        {isSub && (
                          <span className="text-[10px] font-bold uppercase text-accent-foreground shrink-0">
                            Sub
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground leading-snug">{play.description}</p>
                    </div>

                    <div className="flex flex-col items-end shrink-0 text-right">
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {play.awayScore ?? "-"}-{play.homeScore ?? "-"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showJump && (
            <button
              type="button"
              onClick={jumpToLatest}
              className="absolute bottom-4 right-4 rounded-full bg-primary text-primary-foreground border border-primary-border shadow-lg px-4 py-2 flex items-center gap-2 text-sm font-semibold active:scale-[0.97] transition-transform z-20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5" />
                <path d="m5 12 7-7 7 7" />
              </svg>
              Jump to Latest
            </button>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
