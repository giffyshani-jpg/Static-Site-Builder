import React, { useEffect, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import {
  fetchGamesByLeagueAndDate,
  LEAGUE_CONFIGS,
  ALL_LEAGUES,
  getTodayDateStr,
  getTomorrowDateStr,
} from "../api";
import { Game } from "../lib/types";

type LeagueKey = keyof typeof LEAGUE_CONFIGS;

function isValidLeague(s: string): s is LeagueKey {
  return s in LEAGUE_CONFIGS;
}

function SectionHeader({ title, count }: { title: string; count: number | null }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-5 first:mt-0">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {count !== null && (
        <span className="text-xs font-semibold text-muted-foreground/60 bg-muted/40 rounded-full px-2 py-0.5">
          {count} {count === 1 ? "game" : "games"}
        </span>
      )}
    </div>
  );
}

function GameGrid({ games }: { games: Game[] }) {
  if (games.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground text-sm rounded-xl border border-border/50 border-dashed">
        No games scheduled.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

export default function LeagueGames() {
  const params = useParams();
  const league = params.league as string;

  const [todayGames, setTodayGames] = useState<Game[] | null>(null);
  const [tomorrowGames, setTomorrowGames] = useState<Game[] | null>(null);

  const valid = isValidLeague(league);
  const config = valid ? LEAGUE_CONFIGS[league] : null;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;

    setTodayGames(null);
    setTomorrowGames(null);

    const todayStr = getTodayDateStr();
    const tomorrowStr = getTomorrowDateStr();

    fetchGamesByLeagueAndDate(league, todayStr).then((data) => {
      if (!cancelled) setTodayGames(data as Game[]);
    });
    fetchGamesByLeagueAndDate(league, tomorrowStr).then((data) => {
      if (!cancelled) setTomorrowGames(data as Game[]);
    });

    return () => { cancelled = true; };
  }, [league, valid]);

  if (!valid || !config) {
    return (
      <MobileLayout showBack title="Not Found">
        <div className="p-8 text-center text-muted-foreground">League not found.</div>
      </MobileLayout>
    );
  }

  const title = `${config.name} Schedule`;

  return (
    <MobileLayout showBack title={title}>
      <div className="p-4 sm:p-6 pb-12 bg-muted/20 min-h-full">
        {/* Today */}
        <SectionHeader
          title="Today"
          count={todayGames?.length ?? null}
        />
        {todayGames === null ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <GameGrid games={todayGames} />
        )}

        {/* Tomorrow */}
        <SectionHeader
          title="Tomorrow"
          count={tomorrowGames?.length ?? null}
        />
        {tomorrowGames === null ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
        ) : (
          <GameGrid games={tomorrowGames} />
        )}
      </div>
    </MobileLayout>
  );
}
