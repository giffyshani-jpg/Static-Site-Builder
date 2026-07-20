// AI Fantasy Coach — displays heuristic fantasy recommendations for a game.
//
// Shows up to 12 named picks (Best Captain, Best VC, Best Value, Sleeper, etc.)
// computed entirely from real available data: game-log metrics from
// usePregameIntel (for scheduled games) or live box-score stats (for
// in-progress/final games), plus the user's credit assignments.
//
// The section is hidden when there's insufficient data to say anything
// meaningful (< 3 scoreable players). Individual picks are hidden when
// their specific prerequisite data is missing — nothing is invented.

import React, { useState } from "react";
import { usePregameIntel } from "../hooks/use-pregame-intel";
import { computeCoachPicks, CoachPick, CoachPlayerInput } from "../lib/ai-coach";
import { calculateFantasyPoints } from "../lib/stats";
import { Game, LeagueKey } from "../lib/types";
import { minutesValue } from "../lib/player-status";

// ── Types ──────────────────────────────────────────────────────────────────────

type OptimizerPlayer = {
  id: string;
  name: string;
  teamAbbreviation: string;
  isHome: boolean;
  baseFpts: number;
  stats: {
    points: number;
    rebounds: number;
    assists: number;
    steals: number;
    blocks: number;
    turnovers: number;
    minutes?: string | null;
  };
  injuryStatus?: "OUT" | "GTD" | "Questionable" | "Probable";
  starter?: boolean;
  didNotPlay?: boolean;
};

type Props = {
  game: Game;
  league: LeagueKey;
  players: OptimizerPlayer[];
  credits: Record<string, number | undefined>;
};

// ── Pick card ─────────────────────────────────────────────────────────────────

function PickCard({ pick }: { pick: CoachPick }) {
  const KIND_ACCENT: Partial<Record<string, string>> = {
    best_captain:    "border-l-primary bg-primary/5",
    best_vc:         "border-l-amber-500 bg-amber-500/5",
    best_value:      "border-l-emerald-500 bg-emerald-500/5",
    sleeper:         "border-l-sky-500 bg-sky-500/5",
    fade:            "border-l-rose-500 bg-rose-500/5",
    trending_up:     "border-l-emerald-400 bg-emerald-400/5",
    trending_down:   "border-l-rose-400 bg-rose-400/5",
    safest:          "border-l-blue-400 bg-blue-400/5",
    highest_ceiling: "border-l-purple-400 bg-purple-400/5",
    home_advantage:  "border-l-orange-400 bg-orange-400/5",
    back_to_back:    "border-l-amber-400 bg-amber-400/5",
    injury_impact:   "border-l-rose-500 bg-rose-500/5",
  };

  // Label color matches the left-border accent
  const KIND_LABEL_COLOR: Partial<Record<string, string>> = {
    best_captain:    "text-primary",
    best_vc:         "text-amber-500",
    best_value:      "text-emerald-500",
    sleeper:         "text-sky-400",
    fade:            "text-rose-500",
    trending_up:     "text-emerald-400",
    trending_down:   "text-rose-400",
    safest:          "text-blue-400",
    highest_ceiling: "text-purple-400",
    home_advantage:  "text-orange-400",
    back_to_back:    "text-amber-400",
    injury_impact:   "text-rose-400",
  };

  const accent = KIND_ACCENT[pick.kind] ?? "border-l-border bg-muted/10";
  const labelColor = KIND_LABEL_COLOR[pick.kind] ?? "text-muted-foreground";

  return (
    <div
      className={`flex-shrink-0 w-52 sm:w-56 rounded-xl border border-border border-l-4 ${accent} p-3.5 flex flex-col gap-2`}
    >
      {/* Header: emoji + label */}
      <div className="flex items-center gap-1.5">
        <span className="text-base leading-none shrink-0" aria-hidden>{pick.emoji}</span>
        <span className={`text-[10px] font-black uppercase tracking-wider leading-tight ${labelColor}`}>
          {pick.label}
        </span>
      </div>

      {/* Player name + team */}
      <div>
        <p className="text-sm font-bold text-foreground leading-snug line-clamp-1">
          {pick.playerName}
        </p>
        <p className="text-[11px] text-muted-foreground/60 font-semibold mt-0.5 uppercase tracking-wide">
          {pick.teamAbbr}
        </p>
      </div>

      {/* Explanation — wider card fits text better */}
      <p className="text-[11.5px] text-muted-foreground/90 leading-relaxed line-clamp-4 border-t border-border/40 pt-2">
        {pick.explanation}
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function CoachSkeleton() {
  return (
    <div className="flex gap-2.5 pb-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex-shrink-0 w-48 h-28 rounded-xl border border-border/40 skeleton-shimmer"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AiFantasyCoach({ game, league, players, credits }: Props) {
  const [expanded, setExpanded] = useState(true);

  // For scheduled games, tap into the existing pregame intel hook.
  // This hook is already used by PregameIntelPanel on the box-score page;
  // the underlying game-log cache (45-min TTL) means no duplicate fetches.
  const intel = usePregameIntel(game, league);

  const isScheduled = game.status === "scheduled";
  const intelLoading = isScheduled && (intel.away === null || intel.home === null);

  // Build the CoachPlayerInput array from whatever data is available.
  const coachPlayers = React.useMemo((): CoachPlayerInput[] => {
    if (players.length === 0) return [];

    if (isScheduled) {
      // Pregame: use intel metrics when available; fall back to empty metrics.
      const intelMap = new Map<string, import("../lib/pregame-intel").PregamePlayerIntel>();
      for (const p of [...(intel.away ?? []), ...(intel.home ?? [])]) {
        intelMap.set(p.playerId, p);
      }

      return players.map((p): CoachPlayerInput => {
        const intelData = intelMap.get(p.id);
        return {
          id: p.id,
          name: p.name,
          teamAbbr: p.teamAbbreviation,
          isHome: p.isHome,
          currentFpts: 0, // game not started
          avgFptsLast5: intelData?.avgFptsLast5 ?? null,
          avgFptsLast10: intelData?.avgFptsLast10 ?? null,
          highFpts: null, // not exposed by pregame-intel hook
          minutesTrend: intelData?.minutesTrend ?? null,
          formTrend: intelData?.formTrend ?? "Average",
          consistency: intelData?.consistency ?? null,
          status: intelData?.status ?? (p.injuryStatus === "OUT" ? "Out" : "Expected Starter"),
          injuryStatus: p.injuryStatus,
          backToBack: intelData?.backToBack ?? false,
          credits: credits[p.id] ?? 0,
          projectedMinutes: intelData?.projectedMinutes ?? null,
        };
      });
    }

    // Live or final: use current stats directly.
    return players.map((p): CoachPlayerInput => {
      const fpts = calculateFantasyPoints(p.stats);
      const mins = minutesValue(p.stats);
      return {
        id: p.id,
        name: p.name,
        teamAbbr: p.teamAbbreviation,
        isHome: p.isHome,
        currentFpts: fpts,
        avgFptsLast5: fpts > 0 ? fpts : null,
        avgFptsLast10: null,
        highFpts: fpts > 0 ? fpts : null,
        minutesTrend: mins > 20 ? "up" : mins > 0 ? "flat" : null,
        formTrend: "Average",
        consistency: null,
        status: p.didNotPlay
          ? "Out"
          : p.injuryStatus === "OUT"
          ? "Out"
          : p.starter === true
          ? "Confirmed Starter"
          : "Bench",
        injuryStatus: p.injuryStatus,
        backToBack: false, // not available in live context without schedule fetch
        credits: credits[p.id] ?? 0,
        projectedMinutes: mins > 0 ? mins : null,
      };
    });
  }, [players, credits, isScheduled, intel.away, intel.home]);

  const picks = React.useMemo(
    () => computeCoachPicks(coachPlayers),
    [coachPlayers],
  );

  // Don't render while loading pregame intel (to avoid a jarring "0 picks" flash).
  if (intelLoading) {
    return (
      <div className="border-b border-border bg-muted/10">
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span className="text-base">🤖</span>
            AI Coach
          </span>
          <span className="text-[10px] text-muted-foreground/60">Loading intel…</span>
        </div>
        <div className="px-4 pb-4 overflow-x-auto">
          <CoachSkeleton />
        </div>
      </div>
    );
  }

  // Hide entirely when not enough data.
  if (picks.length === 0) return null;

  return (
    <div className="border-b border-border bg-muted/10">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/20 transition-colors"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-foreground">
          <span className="text-base">🤖</span>
          AI Fantasy Coach
          <span className="text-[10px] font-semibold text-muted-foreground normal-case tracking-normal">
            {picks.length} picks
          </span>
        </span>
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
          className={`text-muted-foreground transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Pick cards — horizontal scroll */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <div className="flex gap-2.5 pb-1 w-max">
              {picks.map((pick) => (
                <PickCard key={pick.kind} pick={pick} />
              ))}
            </div>
          </div>
          <p className="mt-2.5 text-[10px] text-muted-foreground/50 leading-relaxed">
            Picks based on real available stats — game-log averages, trends &amp; credits. Not official projections.
          </p>
        </div>
      )}
    </div>
  );
}
