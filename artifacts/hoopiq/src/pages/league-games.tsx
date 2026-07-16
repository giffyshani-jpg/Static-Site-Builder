// League schedule page.
//
// Replaces the old Today / Tomorrow date-based approach with three sections
// that are always populated regardless of the viewer's timezone or whether
// there happen to be games on the current calendar day:
//
//   Live Games    — all games currently in progress (status === "in_progress").
//   Upcoming Games — next scheduled game(s), even if weeks away.
//   Last Played   — single most-recently-completed game.
//
// Data comes from fetchLeagueOverview(), which uses ESPN's raw status field
// (never local date arithmetic) so a LIVE game is always detected as live
// no matter what timezone the viewer is in.

import React, { useEffect, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { fetchLeagueOverview, LEAGUE_CONFIGS } from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";

function isValidLeague(s: string): s is LeagueKey {
  return s in LEAGUE_CONFIGS;
}

// ─── Small UI atoms ──────────────────────────────────────────────────────────

function LivePill() {
  return (
    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full px-2 py-0.5 border border-primary/30 animate-in fade-in">
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      LIVE
    </span>
  );
}

function SectionHeader({
  title,
  count,
  pill,
}: {
  title: string;
  count: number | null;
  pill?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-3 mt-6 first:mt-0">
      <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {pill}
        {count !== null && (
          <span className="text-xs font-semibold text-muted-foreground/60 bg-muted/40 rounded-full px-2 py-0.5">
            {count} {count === 1 ? "game" : "games"}
          </span>
        )}
      </div>
    </div>
  );
}

function GameGrid({ games }: { games: Game[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-24 rounded-xl bg-muted/40 animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="py-7 text-center text-muted-foreground text-sm rounded-xl border border-border/50 border-dashed">
      {message}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LeagueGames() {
  const params = useParams();
  const league = params.league as string;

  const [overview, setOverview] = useState<LeagueOverview | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const valid = isValidLeague(league);
  const config = valid ? LEAGUE_CONFIGS[league] : null;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;

    setOverview(null);
    setFetchError(null);

    // scan: true — searches up to 180 UTC days forward/back so off-season
    // leagues (e.g. NBL in July, season starts October) still show next game.
    fetchLeagueOverview(league, { scan: true })
      .then((data) => {
        if (!cancelled) setOverview(data as LeagueOverview);
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err?.message ?? "Unknown error");
          setOverview({ live: [], upcoming: [], lastPlayed: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [league, valid]);

  if (!valid || !config) {
    return (
      <MobileLayout showBack title="Not Found">
        <div className="p-8 text-center text-muted-foreground">
          League not found.
        </div>
      </MobileLayout>
    );
  }

  const loading = overview === null;
  const liveGames = overview?.live ?? [];
  const upcomingGames = overview?.upcoming ?? [];
  const lastPlayedGame = overview?.lastPlayed ?? null;

  return (
    <MobileLayout showBack title={`${config.name} Schedule`}>
      <div className="p-4 sm:p-6 pb-12 bg-muted/20 min-h-full">

        {/* Provider error banner — shown only when every source failed */}
        {fetchError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            Data unavailable from providers — retrying automatically on next visit.
          </div>
        )}

        {/* ── Live Games ──────────────────────────────────────────────── */}
        {/* Only render the section when loading OR when there are live games.
            Hides the section entirely when the league has no live games. */}
        {(loading || liveGames.length > 0) && (
          <>
            <SectionHeader
              title="Live Games"
              count={loading ? null : liveGames.length}
              pill={liveGames.length > 0 ? <LivePill /> : undefined}
            />
            {loading ? <Skeleton /> : <GameGrid games={liveGames} />}
          </>
        )}

        {/* ── Upcoming Games ──────────────────────────────────────────── */}
        {/* Always rendered — shows the next game even if weeks away. */}
        <SectionHeader
          title="Upcoming Games"
          count={loading ? null : upcomingGames.length}
        />
        {loading ? (
          <Skeleton />
        ) : upcomingGames.length === 0 ? (
          <EmptySection message="No upcoming games found in the next 45 days." />
        ) : (
          <GameGrid games={upcomingGames} />
        )}

        {/* ── Last Played ─────────────────────────────────────────────── */}
        {/* Always rendered — shows the most recently completed game. */}
        <SectionHeader title="Last Played" count={null} />
        {loading ? (
          <Skeleton />
        ) : lastPlayedGame === null ? (
          <EmptySection message="No recently completed games found." />
        ) : (
          <GameGrid games={[lastPlayedGame]} />
        )}
      </div>
    </MobileLayout>
  );
}
