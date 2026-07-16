import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { LEAGUE_CONFIGS, ALL_LEAGUES, fetchGamesByLeagueAndDate, getTodayDateStr, getTomorrowDateStr } from "../api";
import { Game } from "../lib/types";

type LeagueKey = keyof typeof LEAGUE_CONFIGS;

// ─── Chevron icon ────────────────────────────────────────────────────────────
function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}

// ─── Live dot ────────────────────────────────────────────────────────────────
function LiveDot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />;
}

// ─── League status chip ──────────────────────────────────────────────────────
function LeagueStatusChip({
  todayGames,
  loading,
}: {
  todayGames: Game[] | null;
  loading: boolean;
}) {
  if (loading) {
    return <span className="text-xs text-muted-foreground/50">Loading…</span>;
  }
  if (!todayGames || todayGames.length === 0) {
    return <span className="text-xs text-muted-foreground/50">No games today</span>;
  }
  const live = todayGames.filter((g) => g.status === "in_progress").length;
  const total = todayGames.length;
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold">
      {live > 0 && <LiveDot />}
      <span className="text-foreground/80">
        {live > 0 ? `${live} live · ` : ""}
        {total} {total === 1 ? "game" : "games"} today
      </span>
    </span>
  );
}

// ─── Mini game list (2 games max, expandable via link) ───────────────────────
function MiniGameList({ games, league }: { games: Game[]; league: LeagueKey }) {
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

// ─── Single league card ──────────────────────────────────────────────────────
function LeagueCard({
  leagueKey,
  todayGames,
  tomorrowGames,
  loading,
}: {
  leagueKey: LeagueKey;
  todayGames: Game[] | null;
  tomorrowGames: Game[] | null;
  loading: boolean;
}) {
  const cfg = LEAGUE_CONFIGS[leagueKey];
  const [expanded, setExpanded] = useState(false);

  const hasToday = (todayGames?.length ?? 0) > 0;
  const tomorrowCount = tomorrowGames?.length ?? 0;

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cfg.gradient} border border-white/5 shadow-lg overflow-hidden`}>
      {/* Card header */}
      <Link href={`/${leagueKey}`}>
        <div className="flex items-start justify-between p-4 sm:p-5 cursor-pointer group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-xl font-black tracking-tighter text-white">{cfg.name}</h3>
              {!loading && (todayGames?.filter(g => g.status === "in_progress").length ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full px-2 py-0.5 border border-primary/30">
                  <LiveDot /> LIVE
                </span>
              )}
            </div>
            <p className={`text-xs font-medium ${cfg.textLight} opacity-80`}>{cfg.description}</p>
            <div className="mt-2">
              <LeagueStatusChip todayGames={todayGames} loading={loading} />
            </div>
          </div>
          <span className={`${cfg.accent} ${cfg.accentHover} transition-colors mt-1`}>
            <ChevronRight />
          </span>
        </div>
      </Link>

      {/* Inline games when there are games today */}
      {!loading && hasToday && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <MiniGameList games={todayGames!} league={leagueKey} />
        </div>
      )}

      {/* Tomorrow teaser */}
      {!loading && !hasToday && tomorrowCount > 0 && (
        <div className="px-4 pb-3 sm:px-5">
          <p className={`text-xs font-medium ${cfg.textLight} opacity-60`}>
            {tomorrowCount} {tomorrowCount === 1 ? "game" : "games"} tomorrow →
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Home page ───────────────────────────────────────────────────────────────
export default function Home() {
  const todayStr = getTodayDateStr();
  const tomorrowStr = getTomorrowDateStr();

  // Fetch games for all leagues in parallel, once on mount
  const [todayByLeague, setTodayByLeague] = useState<Partial<Record<LeagueKey, Game[]>>>({});
  const [tomorrowByLeague, setTomorrowByLeague] = useState<Partial<Record<LeagueKey, Game[]>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all(
      ALL_LEAGUES.map(async (league) => {
        const [today, tomorrow] = await Promise.all([
          fetchGamesByLeagueAndDate(league, todayStr).catch(() => [] as Game[]),
          fetchGamesByLeagueAndDate(league, tomorrowStr).catch(() => [] as Game[]),
        ]);
        return { league, today: today as Game[], tomorrow: tomorrow as Game[] };
      })
    ).then((results) => {
      if (cancelled) return;
      const td: Partial<Record<LeagueKey, Game[]>> = {};
      const tm: Partial<Record<LeagueKey, Game[]>> = {};
      for (const r of results) {
        td[r.league as LeagueKey] = r.today;
        tm[r.league as LeagueKey] = r.tomorrow;
      }
      setTodayByLeague(td);
      setTomorrowByLeague(tm);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalLive = ALL_LEAGUES.reduce(
    (n, l) => n + (todayByLeague[l as LeagueKey]?.filter((g) => g.status === "in_progress").length ?? 0),
    0
  );
  const totalToday = ALL_LEAGUES.reduce(
    (n, l) => n + (todayByLeague[l as LeagueKey]?.length ?? 0),
    0
  );

  return (
    <MobileLayout>
      <div className="p-4 sm:p-6 flex flex-col gap-4 pb-12">
        {/* Page header */}
        <div className="pt-2 sm:pt-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Basketball Hub</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {loading
              ? "Loading games across all leagues…"
              : totalLive > 0
                ? `${totalLive} game${totalLive !== 1 ? "s" : ""} live now · ${totalToday} today`
                : totalToday > 0
                  ? `${totalToday} game${totalToday !== 1 ? "s" : ""} today across all leagues`
                  : "No games today — check tomorrow's schedule below."}
          </p>
        </div>

        {/* League cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ALL_LEAGUES.map((league) => (
            <LeagueCard
              key={league}
              leagueKey={league as LeagueKey}
              todayGames={todayByLeague[league as LeagueKey] ?? null}
              tomorrowGames={tomorrowByLeague[league as LeagueKey] ?? null}
              loading={loading}
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
