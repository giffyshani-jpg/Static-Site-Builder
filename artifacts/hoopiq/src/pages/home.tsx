// Home page — HoopIQ basketball hub.
//
// Layout philosophy (new product direction):
//   • NBA and WNBA are #1 and #2 priority — full-width premium cards at top.
//   • Everything else (NBL, NZ NBL, FIBA, Summer League) lives under a single
//     collapsible "Other Basketball" group so the primary leagues dominate.
//
// Summer League is hidden automatically when it has no live/upcoming games
// (Phase 2). Provider code is untouched — it reappears next season on its own.
//
// Data: fetchLeagueOverview({ scan: false }) — fast 3-date merge (yesterday /
// today / tomorrow UTC) for home-page paint. Per-league pages do the deeper
// scan when needed.

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
} from "../api";
import { Game, LeagueKey, LeagueOverview } from "../lib/types";

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChevronRight({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
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

function ChevronDown({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LiveDot() {
  return (
    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns "Today", "Yesterday", "Jul 15", etc. relative to now. */
function relativeDate(isoString: string | null | undefined): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const now = new Date();
    const todayStr = now.toDateString();
    const dStr = d.toDateString();
    if (dStr === todayStr) return "Today";
    const yest = new Date(now.getTime() - 86_400_000);
    if (dStr === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
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
    return <span className="text-xs text-muted-foreground/50">Unavailable</span>;
  }

  const liveCount = overview.live.length;
  const upcomingCount = overview.upcoming.length;
  const total = liveCount + upcomingCount;

  if (total === 0 && overview.lastPlayed === null) {
    return (
      <span className="text-xs text-muted-foreground/50">No games soon</span>
    );
  }

  const lastDate = relativeDate(overview.lastPlayed?.startTimeIso);

  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold">
      {liveCount > 0 && <LiveDot />}
      <span className="text-foreground/80">
        {liveCount > 0
          ? `${liveCount} live${upcomingCount > 0 ? ` · ${upcomingCount} upcoming` : ""}`
          : upcomingCount > 0
            ? `${upcomingCount} upcoming`
            : lastDate
              ? `Last played: ${lastDate}`
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

  const inlineGames: Game[] = [
    ...(overview?.live ?? []),
    ...(overview?.upcoming ?? []),
  ];
  const hasInline = inlineGames.length > 0;
  const hasLastPlayed = !hasInline && !!overview?.lastPlayed;
  const liveCount = overview?.live.length ?? 0;

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${cfg.gradient} border border-white/5 shadow-lg overflow-hidden`}
    >
      {/* Card header */}
      <Link href={`/${leagueKey}`}>
        <div className="flex items-start justify-between p-5 sm:p-6 cursor-pointer group">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-2xl leading-none select-none">{emoji}</span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tighter text-white">
                {cfg.name}
              </h2>
              {!loading && liveCount > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary rounded-full px-2 py-0.5 border border-primary/30">
                  <LiveDot /> LIVE
                </span>
              )}
            </div>
            <p className={`text-xs ${cfg.textLight} opacity-70 truncate`}>
              {cfg.description}
            </p>
            <div className="mt-2">
              <LeagueStatusChip overview={overview} loading={loading} />
            </div>
          </div>
          <span
            className={`${cfg.accentHover} transition-colors text-muted-foreground/40 shrink-0 mt-1`}
          >
            <ChevronRight size={16} />
          </span>
        </div>
      </Link>

      {/* Expandable inline games (live / upcoming) */}
      {!loading && hasInline && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
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
                ? `Show ${liveCount} live${overview!.upcoming.length > 0 ? ` + ${overview!.upcoming.length} upcoming` : ""}`
                : `Show ${inlineGames.length} upcoming`}
            </button>
          )}
        </div>
      )}

      {/* Last played game — shown when no upcoming/live games exist */}
      {!loading && hasLastPlayed && (
        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          {expanded ? (
            <>
              <GameCard game={overview!.lastPlayed!} />
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
              Show last played
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Secondary league row (inside "Other Basketball") ────────────────────────

/**
 * Human-readable labels for secondary leagues inside the "Other Basketball"
 * group. These override LEAGUE_CONFIGS[key].name when a clearer label is
 * needed in this context.
 */
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

  return (
    <Link href={`/${leagueKey}`}>
      <div className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors group cursor-pointer">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white/90">{label}</p>
          <div className="mt-0.5">
            <LeagueStatusChip overview={overview} loading={loading} />
          </div>
        </div>
        <span className="text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors shrink-0 ml-2">
          <ChevronRight />
        </span>
      </div>
    </Link>
  );
}

// ─── "Other Basketball" grouped card ─────────────────────────────────────────

/**
 * Groups all secondary leagues under one card. Summer League is shown only
 * when it has live or upcoming games (Phase 2 — auto-hide when inactive).
 */
function OtherBasketballCard({
  overviews,
  loadingSet,
}: {
  overviews: Partial<Record<LeagueKey, LeagueOverview>>;
  loadingSet: Set<LeagueKey>;
}) {
  const [expanded, setExpanded] = useState(true);

  // Determine which secondary leagues to render.
  // Summer League is hidden when it has no live or upcoming games.
  const summerOverview = overviews["nba-summer"];
  const summerActive =
    loadingSet.has("nba-summer") || // still loading → keep visible to avoid flicker
    (summerOverview &&
      (summerOverview.live.length > 0 || summerOverview.upcoming.length > 0));

  const visibleSecondary = (SECONDARY_LEAGUES as LeagueKey[]).filter((k) => {
    if (k === "nba-summer") return summerActive;
    return true;
  });

  // Aggregate live + upcoming count across visible secondary leagues for the summary line.
  const totalLive = visibleSecondary.reduce(
    (n, k) => n + (overviews[k]?.live.length ?? 0),
    0
  );
  const totalUpcoming = visibleSecondary.reduce(
    (n, k) => n + (overviews[k]?.upcoming.length ?? 0),
    0
  );
  const anyLoading = visibleSecondary.some((k) => loadingSet.has(k));

  const summaryText = anyLoading
    ? "Loading…"
    : totalLive > 0
      ? `${totalLive} live · ${totalUpcoming} upcoming`
      : totalUpcoming > 0
        ? `${totalUpcoming} upcoming`
        : "No games this week";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 shadow-lg overflow-hidden">
      {/* Group header */}
      <button
        className="w-full flex items-center justify-between p-4 sm:p-5 group"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none select-none">🌍</span>
          <div className="text-left">
            <h2 className="text-lg font-black tracking-tighter text-white leading-tight">
              Other Basketball
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{summaryText}</p>
          </div>
        </div>
        <span className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0">
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </span>
      </button>

      {/* League rows */}
      {expanded && (
        <div className="border-t border-white/5">
          {visibleSecondary.map((leagueKey, i) => (
            <React.Fragment key={leagueKey}>
              {i > 0 && <div className="h-px bg-white/5 mx-4" />}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [overviewByLeague, setOverviewByLeague] = useState<
    Partial<Record<LeagueKey, LeagueOverview>>
  >({});
  // Track which leagues are still fetching (absent from overviewByLeague).
  const [loadingSet, setLoadingSet] = useState<Set<LeagueKey>>(
    new Set(ALL_LEAGUES as LeagueKey[])
  );

  useEffect(() => {
    let cancelled = false;

    // Fetch all leagues in parallel. scan: false for fast home-page paint.
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

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Headline numbers shown in the page subtitle.
  const totalLive = (ALL_LEAGUES as LeagueKey[]).reduce(
    (n, l) => n + (overviewByLeague[l]?.live.length ?? 0),
    0
  );
  const totalUpcoming = (ALL_LEAGUES as LeagueKey[]).reduce(
    (n, l) => n + (overviewByLeague[l]?.upcoming.length ?? 0),
    0
  );
  const anyLoading = loadingSet.size > 0;

  return (
    <MobileLayout>
      <div className="p-4 sm:p-6 flex flex-col gap-4 pb-12">
        {/* Page header */}
        <div className="pt-2 sm:pt-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            HoopIQ
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {anyLoading
              ? "Loading games across all leagues…"
              : totalLive > 0
                ? `${totalLive} game${totalLive !== 1 ? "s" : ""} live now · ${totalUpcoming} upcoming`
                : totalUpcoming > 0
                  ? `${totalUpcoming} game${totalUpcoming !== 1 ? "s" : ""} upcoming across all leagues`
                  : "No games in the next 3 days — open a league to see the full schedule."}
          </p>
        </div>

        {/* ── Premium: NBA ── */}
        <PremiumLeagueCard
          leagueKey="nba"
          overview={overviewByLeague["nba"] ?? null}
          loading={loadingSet.has("nba")}
          emoji="🏀"
        />

        {/* ── Premium: WNBA ── */}
        <PremiumLeagueCard
          leagueKey="wnba"
          overview={overviewByLeague["wnba"] ?? null}
          loading={loadingSet.has("wnba")}
          emoji="🏀"
        />

        {/* ── Other Basketball (secondary leagues grouped) ── */}
        <OtherBasketballCard
          overviews={overviewByLeague}
          loadingSet={loadingSet}
        />

        {/* Source note */}
        <p className="text-[10px] text-muted-foreground/40 text-center pt-2">
          Data via ESPN (NBA · WNBA · NBL · FIBA · Summer League) · TheSportsDB (NZ NBL) · Scores update live
        </p>
      </div>
    </MobileLayout>
  );
}
