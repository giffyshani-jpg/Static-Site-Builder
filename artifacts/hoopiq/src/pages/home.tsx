// Home page — HoopIQ basketball hub.
//
// Shows a card for every supported league. Each card displays:
//   • A LIVE pill + live game count when games are in progress.
//   • Live games inline (up to 2), then upcoming.
//   • A "View all" link to the full league schedule page.
//
// Data is fetched via fetchLeagueOverview({ scan: false }) — the fast
// 3-date merge (yesterday/today/tomorrow in UTC) without forward scanning.
// This gives correct live detection even in IST / other UTC-offset zones
// while keeping the home page load fast. The per-league page does the
// deeper scan when needed.

import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { LEAGUE_CONFIGS, ALL_LEAGUES, fetchLeagueOverview } from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function LiveDot() {
  return (
    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
  );
}

// ─── Status chip ─────────────────────────────────────────────────────────────

function LeagueStatusChip({
  overview,
  loading,
}: {
  overview: LeagueOverview | null;
  loading: boolean;
}) {
  if (loading) {
    return <span className="text-xs text-muted-foreground/50">Loading…</span>;
  }
  if (!overview) {
    return <span className="text-xs text-muted-foreground/50">No data</span>;
  }

  const liveCount = overview.live.length;
  const upcomingCount = overview.upcoming.length;
  const total = liveCount + upcomingCount;

  if (total === 0 && overview.lastPlayed === null) {
    return (
      <span className="text-xs text-muted-foreground/50">No games soon</span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold">
      {liveCount > 0 && <LiveDot />}
      <span className="text-foreground/80">
        {liveCount > 0
          ? `${liveCount} live${upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ""}`
          : upcomingCount > 0
            ? `${upcomingCount} upcoming`
            : "Check schedule"}
      </span>
    </span>
  );
}

// ─── Mini game list ───────────────────────────────────────────────────────────

function MiniGameList({
  games,
  league,
}: {
  games: Game[];
  league: LeagueKey;
}) {
  const shown = games.slice(0, 2);
  const more = games.length - shown.length;
  return (
    <div className="flex flex-col gap-2 mt-3">
      {shown.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
      {more > 0 && (
        <Link href={`/${league}`}>
          <div className="text-center text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1.5 rounded-lg border border-border/50 border-dashed">
            +{more} more {more === 1 ? "game" : "games"}
          </div>
        </Link>
      )}
    </div>
  );
}

// ─── League card ─────────────────────────────────────────────────────────────

function LeagueCard({
  leagueKey,
  overview,
  loading,
}: {
  leagueKey: LeagueKey;
  overview: LeagueOverview | null;
  loading: boolean;
}) {
  const cfg = LEAGUE_CONFIGS[leagueKey];
  // Guard: if the config doesn't exist for this key (e.g. stale cache from
  // a previous session), skip rendering silently rather than crashing.
  if (!cfg) return null;
  const [expanded, setExpanded] = useState(false);

  // Combine live + upcoming for the mini inline list.
  const inlineGames: Game[] = [
    ...(overview?.live ?? []),
    ...(overview?.upcoming ?? []),
  ];
  const hasInline = inlineGames.length > 0;

  const liveCount = overview?.live.length ?? 0;

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${cfg.gradient} border border-white/5 shadow-lg overflow-hidden`}
    >
      {/* Card header */}
      <Link href={`/${leagueKey}`}>
        <div className="flex items-start justify-between p-4 sm:p-5 cursor-pointer group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-xl font-black tracking-tighter text-white">
                {cfg.name}
              </h3>
              {!loading && liveCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full px-2 py-0.5 border border-primary/30">
                  <LiveDot /> LIVE
                </span>
              )}
            </div>
            <p className={`text-xs ${cfg.textLight} opacity-70 truncate`}>
              {cfg.description}
            </p>
            <div className="mt-1.5">
              <LeagueStatusChip overview={overview} loading={loading} />
            </div>
          </div>
          <span
            className={`${cfg.accentHover} transition-colors text-muted-foreground/40 shrink-0 mt-1`}
          >
            <ChevronRight />
          </span>
        </div>
      </Link>

      {/* Expandable inline games */}
      {!loading && hasInline && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          {expanded ? (
            <>
              <MiniGameList games={inlineGames} league={leagueKey} />
              <button
                onClick={() => setExpanded(false)}
                className="mt-2 w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1"
              >
                Show less
              </button>
            </>
          ) : (
            <button
              onClick={() => setExpanded(true)}
              className={`text-xs font-semibold ${cfg.accent} hover:opacity-80 transition-opacity`}
            >
              {liveCount > 0
                ? `Show ${liveCount} live + ${overview!.upcoming.length} upcoming`
                : `Show ${inlineGames.length} upcoming`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [overviewByLeague, setOverviewByLeague] = useState<
    Partial<Record<LeagueKey, LeagueOverview>>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Fetch all leagues in parallel. scan: false for fast home-page paint.
    const promises = ALL_LEAGUES.map((league) =>
      fetchLeagueOverview(league, { scan: false }).then((data) => {
        if (!cancelled) {
          setOverviewByLeague((prev) => ({
            ...prev,
            [league]: data as LeagueOverview,
          }));
        }
      })
    );

    Promise.all(promises).then(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalLive = ALL_LEAGUES.reduce(
    (n, l) =>
      n + (overviewByLeague[l as LeagueKey]?.live.length ?? 0),
    0
  );

  const totalUpcoming = ALL_LEAGUES.reduce(
    (n, l) =>
      n + (overviewByLeague[l as LeagueKey]?.upcoming.length ?? 0),
    0
  );

  return (
    <MobileLayout>
      <div className="p-4 sm:p-6 flex flex-col gap-4 pb-12">
        {/* Page header */}
        <div className="pt-2 sm:pt-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            HoopIQ
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {loading
              ? "Loading games across all leagues…"
              : totalLive > 0
                ? `${totalLive} game${totalLive !== 1 ? "s" : ""} live now · ${totalUpcoming} upcoming`
                : totalUpcoming > 0
                  ? `${totalUpcoming} game${totalUpcoming !== 1 ? "s" : ""} upcoming across all leagues`
                  : "No games in the next 3 days — open a league to see the full schedule."}
          </p>
        </div>

        {/* League cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ALL_LEAGUES.map((league) => (
            <LeagueCard
              key={league}
              leagueKey={league as LeagueKey}
              overview={overviewByLeague[league as LeagueKey] ?? null}
              loading={!(league in overviewByLeague)}
            />
          ))}
        </div>

        {/* Source note */}
        <p className="text-[10px] text-muted-foreground/40 text-center pt-2">
          Data via ESPN public API · EuroLeague / EuroCup not available via public sources
        </p>
      </div>
    </MobileLayout>
  );
}
