// League schedule page.
//
// Three sections always populated regardless of timezone or whether games
// fall on today's calendar date:
//
//   Live Games    — all games currently in progress (status === "in_progress").
//   Upcoming Games — next scheduled game(s), even if months away.
//   Last Played   — single most-recently-completed game.
//
// Data comes from fetchLeagueOverview(), which uses ESPN's raw status field
// (never local date arithmetic) so a LIVE game is always detected as live
// no matter what timezone the viewer is in.
//
// Task 2 additions:
//   - Off-season banner for leagues with active: false in LEAGUE_CONFIGS.
//   - Live auto-refresh every 30s while at least one game is in_progress.
//   - Next-game date label in the Upcoming section header.
//   - Accurate scan-window message ("next 6 months").
//   - Friendlier empty states with league-specific context.

import React, { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import { fetchLeagueOverview, LEAGUE_CONFIGS } from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";

function isValidLeague(s: string): s is LeagueKey {
  return s in LEAGUE_CONFIGS;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format an ISO date string as a human-readable label (e.g. "Jul 18 at 7:30 PM"). */
function formatGameDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const now = new Date();
    const todayStr = now.toDateString();
    const dStr = d.toDateString();
    const yest = new Date(now.getTime() - 86_400_000);
    const tom  = new Date(now.getTime() + 86_400_000);

    let dayLabel: string;
    if (dStr === todayStr) dayLabel = "Today";
    else if (dStr === yest.toDateString()) dayLabel = "Yesterday";
    else if (dStr === tom.toDateString()) dayLabel = "Tomorrow";
    else dayLabel = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    const timeLabel = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${dayLabel} at ${timeLabel}`;
  } catch {
    return "";
  }
}

/** Returns how many days until a future ISO date (0 = today, negative = past). */
function daysUntil(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  try {
    const now = new Date();
    const d   = new Date(isoString);
    return Math.round((d.getTime() - now.getTime()) / 86_400_000);
  } catch {
    return null;
  }
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
  subtitle,
}: {
  title: string;
  count: number | null;
  pill?: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start justify-between mb-3 mt-6 first:mt-0 gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
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

/** Off-season banner shown for leagues whose `active` flag is false. */
function OffSeasonBanner({ leagueName }: { leagueName: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3">
      <span className="text-base leading-none select-none shrink-0 mt-0.5">💤</span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">Off-Season</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          {leagueName} is currently in the off-season. The next scheduled game is shown below
          when available — check back closer to the season start.
        </p>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LeagueGames() {
  const params = useParams();
  const league = params.league as string;

  const [overview, setOverview] = useState<LeagueOverview | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const valid  = isValidLeague(league);
  const config = valid ? LEAGUE_CONFIGS[league] : null;

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!valid) return;
    let cancelled = false;

    setOverview(null);
    setFetchError(null);

    // scan: true — searches up to 180 UTC days forward/back so off-season
    // leagues (e.g. NBA / NBL in July) still show the next scheduled game.
    fetchLeagueOverview(league, { scan: true })
      .then((data) => {
        if (!cancelled) {
          setOverview(data as LeagueOverview);
          setLastRefreshed(new Date());
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err?.message ?? "Unknown error");
          setOverview({ live: [], upcoming: [], lastPlayed: null });
        }
      });

    return () => { cancelled = true; };
  }, [league, valid]);

  // ── Live auto-refresh (30 s) while games are in progress ─────────────────
  const overviewRef = useRef(overview);
  overviewRef.current = overview;

  useEffect(() => {
    if (!valid) return;

    const tick = async () => {
      const current = overviewRef.current;
      // Only refresh when there are known live games.
      if (!current || current.live.length === 0) return;

      try {
        const data = await fetchLeagueOverview(league, { scan: false });
        setOverview(data as LeagueOverview);
        setLastRefreshed(new Date());
      } catch {
        // Silently ignore refresh errors; the initial data stays visible.
      }
    };

    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
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

  const loading        = overview === null;
  const liveGames      = overview?.live ?? [];
  const upcomingGames  = overview?.upcoming ?? [];
  const lastPlayedGame = overview?.lastPlayed ?? null;

  // Compute a subtitle for the Upcoming section when the next game is far out.
  const nextGame     = upcomingGames[0] ?? null;
  const nextGameDate = formatGameDate(nextGame?.startTimeIso);
  const daysAway     = daysUntil(nextGame?.startTimeIso);
  const isOffSeason  = !(config as { active?: boolean }).active;

  let upcomingSubtitle: string | undefined;
  if (!loading && nextGame && nextGameDate) {
    if (daysAway !== null && daysAway > 7) {
      upcomingSubtitle = `Next game: ${nextGameDate}`;
    }
  }

  return (
    <MobileLayout showBack title={`${config.name} Schedule`}>
      <div className="p-4 sm:p-6 pb-12 bg-muted/20 min-h-full">

        {/* Off-season banner */}
        {!loading && isOffSeason && (
          <OffSeasonBanner leagueName={config.name} />
        )}

        {/* Provider error banner — shown only when every source failed */}
        {fetchError && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
            Data unavailable from providers — retrying automatically on next visit.
          </div>
        )}

        {/* Auto-refresh indicator */}
        {liveGames.length > 0 && lastRefreshed && (
          <div className="mb-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            Auto-refreshing · Updated{" "}
            {lastRefreshed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </div>
        )}

        {/* ── Live Games ──────────────────────────────────────────────── */}
        {/* Only render the section when loading OR when there are live games. */}
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
        <SectionHeader
          title="Upcoming Games"
          count={loading ? null : upcomingGames.length}
          subtitle={upcomingSubtitle}
        />
        {loading ? (
          <Skeleton />
        ) : upcomingGames.length === 0 ? (
          league === "fiba" ? (
            <div className="py-6 flex flex-col items-center gap-3 rounded-xl border border-border/50 border-dashed text-center px-4">
              <p className="text-sm text-muted-foreground">
                No FIBA events scheduled in the current window.
              </p>
              <p className="text-xs text-muted-foreground/60 max-w-[280px] leading-relaxed">
                FIBA competitions run during designated international windows
                (typically February, June, August, and November). Check back
                closer to the next window.
              </p>
            </div>
          ) : (
            <EmptySection
              message={
                isOffSeason
                  ? `No ${config.name} games scheduled in the next 6 months.`
                  : `No upcoming ${config.name} games found in the next 6 months.`
              }
            />
          )
        ) : (
          <GameGrid games={upcomingGames} />
        )}

        {/* ── Last Played ─────────────────────────────────────────────── */}
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
