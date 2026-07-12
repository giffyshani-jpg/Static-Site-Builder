import React, { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchGameById } from "../api";
import { Game, PlayByPlayEvent } from "../lib/types";

const LIVE_POLL_INTERVAL_MS = 15000;

function teamAbbreviationFor(game: Game, teamId: string | null): string {
  if (!teamId) return "";
  if (game.awayTeam.id === teamId) return game.awayTeam.abbreviation;
  if (game.homeTeam.id === teamId) return game.homeTeam.abbreviation;
  return "";
}

export default function PlayByPlay() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as "nba" | "wnba";

  const [game, setGame] = useState<Game | null | undefined>(null);
  const [showJump, setShowJump] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const prevPlayCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    prevPlayCount.current = 0;

    fetchGameById(gameId || "", league).then((data) => {
      if (cancelled) return;
      const loadedGame = (data as Game | undefined) ?? undefined;
      setGame(loadedGame ?? undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [gameId, league]);

  // While the game is live, poll for fresh play-by-play data so new
  // events show up automatically. Stops as soon as the game is no
  // longer in progress (e.g. it goes final).
  useEffect(() => {
    if (!game || game.status !== "in_progress") return;

    let cancelled = false;
    const intervalId = setInterval(async () => {
      const data = await fetchGameById(gameId || "", league);
      if (cancelled) return;
      const loadedGame = (data as Game | undefined) ?? undefined;
      if (loadedGame) setGame(loadedGame);
    }, LIVE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [game?.status, gameId, league]);

  const plays: PlayByPlayEvent[] = game?.playByPlay ?? [];
  // Newest first.
  const reversedPlays = [...plays].reverse();

  useEffect(() => {
    if (!game) return;
    const count = reversedPlays.length;
    if (count > prevPlayCount.current && prevPlayCount.current !== 0) {
      // New plays arrived since the last render — auto-scroll to the
      // newest event (top of the list, since it's newest-first).
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
        <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="text-sm font-semibold text-foreground">
            {game.awayTeam.abbreviation} {game.awayTeam.score ?? "-"} @ {game.homeTeam.abbreviation}{" "}
            {game.homeTeam.score ?? "-"}
          </div>
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {game.status === "scheduled" ? game.startTime : game.period}
            {game.clock && ` • ${game.clock}`}
          </div>
        </div>

        {/* Play list */}
        <div ref={listRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative px-4 py-3">
          {reversedPlays.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No play-by-play data available for this game yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-4">
              {reversedPlays.map((play) => {
                const teamAbbr = teamAbbreviationFor(game, play.teamId);
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
