// Home page — HoopIQ multi-sport hub.
//
// Layout:
//   ① LIVE NOW banner  — shown when any sport has live games
//   ② NBA & WNBA cards — full-width premium basketball cards
//   ③ Cricket section  — auto-discovered competitions, all T20 leagues
//   ④ Other Basketball — collapsible group (NBL, NZ NBL, FIBA, Summer)

import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { GameCard } from "../components/game-card";
import {
  LEAGUE_CONFIGS,
  PRIMARY_LEAGUES,
  SECONDARY_LEAGUES,
  ALL_LEAGUES,
  fetchLeagueOverview,
  fetchCricketOverview,
} from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";
import type { CricketGame, CricketLeagueOverview } from "../lib/cricket-types";

// ─── Icons ────────────────────────────────────────────────────────────────────

function ChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yest = new Date(now.getTime() - 86_400_000);
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return ""; }
}

function fmtTime(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(isoString));
  } catch { return ""; }
}

// ─── LIVE NOW banner ─────────────────────────────────────────────────────────

function LiveNowBanner({ allLiveGames }: { allLiveGames: Game[] }) {
  if (allLiveGames.length === 0) return null;
  const shown = allLiveGames.slice(0, 3);

  return (
    <div className="rounded-2xl overflow-hidden border border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
        </span>
        <h2 className="text-sm font-black uppercase tracking-widest text-primary">Live Now</h2>
        <span className="ml-auto text-xs font-semibold text-muted-foreground/60 bg-muted/40 rounded-full px-2 py-0.5">
          {allLiveGames.length} {allLiveGames.length === 1 ? "game" : "games"}
        </span>
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {shown.map((g) => <GameCard key={g.id} game={g} showLeague />)}
        {allLiveGames.length > shown.length && (
          <p className="text-center text-[11px] text-muted-foreground/50 pt-1">
            +{allLiveGames.length - shown.length} more games live
          </p>
        )}
      </div>
    </div>
  );
}

// ─── League status chip ───────────────────────────────────────────────────────

function LeagueStatusChip({ overview, loading }: { overview: LeagueOverview | null; loading: boolean }) {
  if (loading) return <span className="h-3 w-24 rounded-full skeleton-shimmer inline-block" />;
  if (!overview) return <span className="text-xs text-muted-foreground/40">Unavailable</span>;

  const liveCount = overview.live.length;
  const upcomingCount = overview.upcoming.length;

  if (liveCount === 0 && upcomingCount === 0 && !overview.lastPlayed) {
    return <span className="text-xs text-muted-foreground/40">No games soon</span>;
  }

  const lastDate = relativeDate(overview.lastPlayed?.startTimeIso);

  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      {liveCount > 0 && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
        </span>
      )}
      <span className="text-foreground/70">
        {liveCount > 0
          ? `${liveCount} live${upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ""}`
          : upcomingCount > 0
            ? `${upcomingCount} upcoming`
            : lastDate ? `Last played: ${lastDate}` : "Check schedule"}
      </span>
    </span>
  );
}

// ─── Mini game list ───────────────────────────────────────────────────────────

function MiniGameList({ games, league }: { games: Game[]; league: LeagueKey }) {
  const shown = games.slice(0, 2);
  const more = games.length - shown.length;
  return (
    <div className="flex flex-col gap-2 mt-3">
      {shown.map((g) => <GameCard key={g.id} game={g} />)}
      {more > 0 && (
        <Link href={`/${league}`}>
          <div className="text-center text-xs font-semibold text-muted-foreground hover:text-primary/80 transition-colors py-2 rounded-xl border border-border/40 border-dashed hover:border-primary/30">
            +{more} more {more === 1 ? "game" : "games"}
          </div>
        </Link>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PremiumCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-full skeleton-shimmer" />
          <div className="h-7 w-24 rounded-lg skeleton-shimmer" />
        </div>
        <div className="h-3 w-32 rounded-full skeleton-shimmer mb-2" />
        <div className="h-4 w-20 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}

// ─── Premium league card (NBA / WNBA) ────────────────────────────────────────

function PremiumLeagueCard({
  leagueKey,
  overview,
  loading,
  emoji,
}: {
  leagueKey: LeagueKey;
  overview: LeagueOverview | null;
  loading: boolean;
  emoji: string;
}) {
  const cfg = LEAGUE_CONFIGS[leagueKey];
  if (!cfg) return null;
  const [expanded, setExpanded] = useState(false);

  if (loading) return <PremiumCardSkeleton />;

  const inlineGames: Game[] = [
    ...(overview?.live ?? []),
    ...(overview?.upcoming ?? []),
  ];
  const hasInline = inlineGames.length > 0;
  const hasLastPlayed = !hasInline && !!overview?.lastPlayed;
  const liveCount = overview?.live.length ?? 0;

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cfg.gradient} border border-white/8 shadow-lg overflow-hidden`}>
      <Link href={`/${leagueKey}`}>
        <div className="flex items-start justify-between p-5 sm:p-6 cursor-pointer group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-2xl leading-none select-none">{emoji}</span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">{cfg.name}</h2>
              {liveCount > 0 && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </div>
            <p className={`text-xs ${cfg.textLight} opacity-60 mb-2`}>{cfg.description}</p>
            <LeagueStatusChip overview={overview} loading={false} />
          </div>
          <span className="text-white/25 group-hover:text-white/50 transition-colors shrink-0 ml-3 mt-1">
            <ChevronRight />
          </span>
        </div>
      </Link>

      {hasInline && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <MiniGameList games={inlineGames.slice(0, 3)} league={leagueKey} />
        </div>
      )}

      {hasLastPlayed && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {expanded ? (
            <>
              <GameCard game={overview!.lastPlayed!} />
              <button onClick={() => setExpanded(false)} className="mt-2 w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors py-1">
                Show less
              </button>
            </>
          ) : (
            <button onClick={() => setExpanded(true)} className={`text-xs font-bold ${cfg.accent} hover:opacity-80 transition-opacity`}>
              Show last played
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Cricket game card ────────────────────────────────────────────────────────

function CricketGameCard({ game }: { game: CricketGame }) {
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";
  const link = `/cricket/${game.competitionSlug}/game/${encodeURIComponent(game.id)}`;

  return (
    <Link href={link}>
      <div className="rounded-xl border border-green-800/30 bg-green-900/10 hover:bg-green-900/20 transition-colors p-3 cursor-pointer">
        {/* Competition name */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold uppercase tracking-widest text-green-400/60 truncate">
            {game.competitionName}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isLive && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
            )}
            <span className={`text-[10px] font-bold ${isLive ? "text-primary" : isFinal ? "text-muted-foreground/50" : "text-muted-foreground/50"}`}>
              {isLive ? "LIVE" : isFinal ? "FT" : fmtTime(game.startTimeIso)}
            </span>
          </div>
        </div>

        {/* Teams + scores */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{game.homeTeam.abbreviation}</p>
            {game.homeTeam.score && (
              <p className="text-xs text-green-300 font-semibold">{game.homeTeam.score}</p>
            )}
          </div>
          <span className="text-xs text-muted-foreground/40 flex-shrink-0">vs</span>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-bold text-foreground truncate">{game.awayTeam.abbreviation}</p>
            {game.awayTeam.score && (
              <p className="text-xs text-green-300 font-semibold">{game.awayTeam.score}</p>
            )}
          </div>
        </div>

        {/* Status detail */}
        {(game.statusDetail || game.result) && (
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 truncate">
            {game.result ?? game.statusDetail}
          </p>
        )}
      </div>
    </Link>
  );
}

// ─── Cricket section ──────────────────────────────────────────────────────────

function CricketSection({
  overview,
  loading,
}: {
  overview: CricketLeagueOverview | null;
  loading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const liveCount = overview?.live.length ?? 0;
  const upcomingCount = overview?.upcoming.length ?? 0;
  const totalGames = liveCount + upcomingCount;
  const competitionCount = overview?.activeCompetitions.length ?? 0;

  const summaryText = loading
    ? "Discovering leagues…"
    : liveCount > 0
      ? `${liveCount} live · ${upcomingCount} upcoming`
      : upcomingCount > 0
        ? `${upcomingCount} upcoming · ${competitionCount} competition${competitionCount !== 1 ? "s" : ""}`
        : overview?.lastPlayed
          ? `Last played: ${relativeDate(overview.lastPlayed.startTimeIso)}`
          : "No active competitions";

  // Collect display games — live first, then upcoming, then last played
  const displayGames: CricketGame[] = [
    ...(overview?.live ?? []).slice(0, 4),
    ...(liveCount === 0 ? (overview?.upcoming ?? []).slice(0, 3) : []),
  ];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-green-950/90 to-slate-900 border border-green-800/30 shadow-lg overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-4 sm:p-5 group"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none select-none">🏏</span>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black tracking-tight text-white leading-tight">Cricket</h2>
              {liveCount > 0 && (
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                </span>
              )}
            </div>
            <p className="text-xs text-green-400/60 mt-0.5">{summaryText}</p>
          </div>
        </div>
        <span className="text-white/25 group-hover:text-white/50 transition-colors shrink-0">
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-green-800/20">
          {loading ? (
            <div className="flex flex-col gap-2 p-3">
              {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}
            </div>
          ) : displayGames.length > 0 ? (
            <div className="flex flex-col gap-2 p-3">
              {displayGames.map((g) => (
                <CricketGameCard key={g.id} game={g} />
              ))}
              {totalGames > displayGames.length && (
                <p className="text-center text-[11px] text-muted-foreground/50 pt-1">
                  +{totalGames - displayGames.length} more matches
                </p>
              )}
            </div>
          ) : overview?.lastPlayed ? (
            <div className="p-3">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2 px-1">Last Played</p>
              <CricketGameCard game={overview.lastPlayed} />
            </div>
          ) : (
            <div className="py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground/60">No active cricket competitions found</p>
              <p className="text-xs text-muted-foreground/40 mt-1">Competitions auto-discover when active — check back during a tournament window</p>
            </div>
          )}

          {/* Browse all competitions */}
          {competitionCount > 0 && (
            <div className="border-t border-green-800/20 px-4 py-2.5 flex items-center justify-between">
              <span className="text-[10px] text-green-400/50">
                {competitionCount} active competition{competitionCount !== 1 ? "s" : ""}
              </span>
              <Link href="/cricket/icc-cricket">
                <span className="text-[11px] font-bold text-green-400/70 hover:text-green-300 transition-colors">
                  All matches →
                </span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Secondary league row ─────────────────────────────────────────────────────

const SECONDARY_LABEL: Partial<Record<LeagueKey, string>> = {
  nbl: "Australia NBL",
  "nba-summer": "Summer League",
};

function SecondaryLeagueRow({
  leagueKey,
  overview,
  loading,
}: {
  leagueKey: LeagueKey;
  overview: LeagueOverview | null;
  loading: boolean;
}) {
  const cfg = LEAGUE_CONFIGS[leagueKey];
  if (!cfg) return null;
  const label = SECONDARY_LABEL[leagueKey] ?? cfg.name;
  const liveCount = overview?.live.length ?? 0;

  return (
    <Link href={`/${leagueKey}`}>
      <div className="flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors group cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white/90">{label}</p>
            {liveCount > 0 && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
              </span>
            )}
          </div>
          <div className="mt-0.5">
            <LeagueStatusChip overview={overview} loading={loading} />
          </div>
        </div>
        <span className="text-white/20 group-hover:text-white/50 transition-colors shrink-0 ml-2">
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}

// ─── "Other Basketball" grouped card ─────────────────────────────────────────

function OtherBasketballCard({
  overviews,
  loadingSet,
}: {
  overviews: Partial<Record<LeagueKey, LeagueOverview>>;
  loadingSet: Set<LeagueKey>;
}) {
  const [expanded, setExpanded] = useState(false);

  const summerOverview = overviews["nba-summer"];
  const summerActive =
    loadingSet.has("nba-summer") ||
    (summerOverview && (summerOverview.live.length > 0 || summerOverview.upcoming.length > 0));

  const visibleSecondary = (SECONDARY_LEAGUES as LeagueKey[]).filter((k) => {
    if (k === "nba-summer") return summerActive;
    return true;
  });

  const totalLive = visibleSecondary.reduce((n, k) => n + (overviews[k]?.live.length ?? 0), 0);
  const totalUpcoming = visibleSecondary.reduce((n, k) => n + (overviews[k]?.upcoming.length ?? 0), 0);
  const anyLoading = visibleSecondary.some((k) => loadingSet.has(k));

  const summaryText = anyLoading
    ? "Loading…"
    : totalLive > 0
      ? `${totalLive} live · ${totalUpcoming} upcoming`
      : totalUpcoming > 0
        ? `${totalUpcoming} upcoming`
        : "Off-season";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/8 shadow-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 sm:p-5 group"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none select-none">🌍</span>
          <div className="text-left">
            <h2 className="text-base font-black tracking-tight text-white leading-tight">Other Basketball</h2>
            <p className="text-xs text-slate-400 mt-0.5">{summaryText}</p>
          </div>
        </div>
        <span className="text-white/25 group-hover:text-white/50 transition-colors shrink-0">
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/8">
          {visibleSecondary.map((leagueKey, i) => (
            <React.Fragment key={leagueKey}>
              {i > 0 && <div className="h-px bg-white/6 mx-4" />}
              <SecondaryLeagueRow
                leagueKey={leagueKey}
                overview={overviews[leagueKey] ?? null}
                loading={loadingSet.has(leagueKey)}
              />
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({
  totalLive,
  totalUpcoming,
  anyLoading,
}: {
  totalLive: number;
  totalUpcoming: number;
  anyLoading: boolean;
}) {
  const now = new Date();
  const dayLabel = now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  return (
    <div className="pt-2 sm:pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tighter">Today's Games</h1>
        <span className="text-xs text-muted-foreground/50 shrink-0">{dayLabel}</span>
      </div>
      <p className="text-muted-foreground text-sm mt-1">
        {anyLoading
          ? "Loading across all sports…"
          : totalLive > 0
            ? `${totalLive} game${totalLive !== 1 ? "s" : ""} in progress · ${totalUpcoming} upcoming`
            : totalUpcoming > 0
              ? `${totalUpcoming} game${totalUpcoming !== 1 ? "s" : ""} upcoming`
              : "No games today — check individual leagues for schedules."}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [overviewByLeague, setOverviewByLeague] = useState<Partial<Record<LeagueKey, LeagueOverview>>>({});
  const [loadingSet, setLoadingSet] = useState<Set<LeagueKey>>(new Set(ALL_LEAGUES as LeagueKey[]));

  // Cricket state (separate from basketball)
  const [cricketOverview, setCricketOverview] = useState<CricketLeagueOverview | null>(null);
  const [cricketLoading, setCricketLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Basketball leagues
    (ALL_LEAGUES as LeagueKey[]).forEach((league) => {
      fetchLeagueOverview(league, { scan: false }).then((data) => {
        if (!cancelled) {
          setOverviewByLeague((prev) => ({ ...prev, [league]: data as LeagueOverview }));
          setLoadingSet((prev) => {
            const next = new Set(prev);
            next.delete(league);
            return next;
          });
        }
      });
    });

    // Cricket (auto-discovers all competitions)
    fetchCricketOverview().then((data) => {
      if (!cancelled) {
        setCricketOverview(data as CricketLeagueOverview);
        setCricketLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setCricketLoading(false);
    });

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalLive = (ALL_LEAGUES as LeagueKey[]).reduce((n, l) => n + (overviewByLeague[l]?.live.length ?? 0), 0)
    + (cricketOverview?.live.length ?? 0);
  const totalUpcoming = (ALL_LEAGUES as LeagueKey[]).reduce((n, l) => n + (overviewByLeague[l]?.upcoming.length ?? 0), 0)
    + (cricketOverview?.upcoming.length ?? 0);
  const anyLoading = loadingSet.size > 0 || cricketLoading;

  // Live NOW banner — basketball games only (cricket has own card)
  const allLiveGames: Game[] = (ALL_LEAGUES as LeagueKey[]).flatMap(
    (l) => overviewByLeague[l]?.live ?? []
  );

  return (
    <MobileLayout>
      <div className="p-4 sm:p-5 flex flex-col gap-3.5 pb-12">
        <PageHeader totalLive={totalLive} totalUpcoming={totalUpcoming} anyLoading={anyLoading} />

        {/* ① Live now banner (basketball) */}
        {!anyLoading && allLiveGames.length > 0 && (
          <LiveNowBanner allLiveGames={allLiveGames} />
        )}

        {/* ② NBA */}
        <PremiumLeagueCard
          leagueKey="nba"
          overview={overviewByLeague["nba"] ?? null}
          loading={loadingSet.has("nba")}
          emoji="🏀"
        />

        {/* ③ WNBA */}
        <PremiumLeagueCard
          leagueKey="wnba"
          overview={overviewByLeague["wnba"] ?? null}
          loading={loadingSet.has("wnba")}
          emoji="🏀"
        />

        {/* ④ Cricket — auto-discovered competitions */}
        <CricketSection overview={cricketOverview} loading={cricketLoading} />

        {/* ⑤ Other Basketball (collapsible) */}
        <OtherBasketballCard overviews={overviewByLeague} loadingSet={loadingSet} />

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 pt-2">
          <p className="text-[10px] text-muted-foreground/35 text-center">
            ESPN · TheSportsDB · NBA CDN · Scores update live
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
