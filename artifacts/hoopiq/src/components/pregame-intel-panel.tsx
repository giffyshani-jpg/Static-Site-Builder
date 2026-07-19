import { InjuryBadge, BadgeStatus } from "./injury-badge";
import { RecommendationBadge } from "./recommendation-badge";
import { usePregameIntel } from "../hooks/use-pregame-intel";
import { PregamePlayerIntel, LineupStatus, TeamAvailabilitySummary, BlowoutRisk } from "../lib/pregame-intel";
import { Game } from "../lib/types";

// ── Badge helpers ─────────────────────────────────────────────────────────────

function lineupBadgeStatus(status: LineupStatus): BadgeStatus {
  if (status === "Confirmed Bench") return "Bench";
  return status as BadgeStatus;
}

// ── Style maps ────────────────────────────────────────────────────────────────

const TREND_ICON: Record<"up" | "down" | "flat", string> = { up: "↑", down: "↓", flat: "→" };
const TREND_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "text-emerald-400",
  down: "text-rose-400",
  flat: "text-muted-foreground",
};

const FORM_COLOR: Record<PregamePlayerIntel["formTrend"], string> = {
  Hot: "text-emerald-400",
  Cold: "text-rose-400",
  Average: "text-foreground",
};

const FORM_SUFFIX: Record<PregamePlayerIntel["formTrend"], string> = {
  Hot: " 🔥",
  Cold: " ❄️",
  Average: "",
};

const BLOWOUT_STYLES: Record<BlowoutRisk, string> = {
  Low: "bg-muted/40 text-muted-foreground border-border",
  Medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  High: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

// ── Confidence derivation ─────────────────────────────────────────────────────
//
// Aggregate confidence from consistency rating, starter status, back-to-back,
// and injury designation. Not an official metric — a heuristic for surfacing
// how reliable the projection is likely to be.

type Confidence = "High" | "Moderate" | "Low";

function deriveConfidence(p: PregamePlayerIntel): Confidence {
  if (p.status === "Out") return "Low";
  if (!p.consistency) return "Moderate";

  let score = 0;
  if (p.consistency === "Consistent") score += 2;
  else if (p.consistency === "Somewhat Consistent") score += 1;
  // Volatile = +0

  if (p.status === "Confirmed Starter") score += 1;
  if (p.backToBack) score -= 1;
  if (p.status === "Questionable" || p.status === "Game Time Decision") score -= 1;

  if (score >= 3) return "High";
  if (score >= 1) return "Moderate";
  return "Low";
}

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  High: "text-emerald-400",
  Moderate: "text-amber-400",
  Low: "text-rose-400",
};

// ── Format helpers ────────────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatTipoff(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ── PlayerIntelRow ────────────────────────────────────────────────────────────
//
// Redesigned for mobile clarity:
//   • Name + status badges in one line
//   • Key numbers below: Proj Min | FPTS (L5 with 🔥/❄️) | Confidence
//   • Recommendation badge right-aligned (only when not OUT)
//   • OUT players dimmed (opacity-60) and shown without projections

function PlayerIntelRow({
  player,
  isHome,
  opponentAbbr,
}: {
  player: PregamePlayerIntel;
  /** True when this player's team is the home team tonight. */
  isHome: boolean;
  /** Abbreviation of the opponent (e.g. "LAL", "BOS"). */
  opponentAbbr: string;
}) {
  const confidence = deriveConfidence(player);
  const isOut = player.status === "Out";

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0 transition-opacity ${
        isOut ? "opacity-55" : ""
      }`}
    >
      {/* Left: player info */}
      <div className="flex-1 min-w-0">
        {/* Name + status badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate max-w-[160px] sm:max-w-[220px]">
            {player.name}
          </span>
          <InjuryBadge status={lineupBadgeStatus(player.status)} />
          {player.backToBack && (
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 border shrink-0 bg-purple-500/15 text-purple-400 border-purple-500/30"
              title="Team plays on back-to-back nights — starters often see fewer minutes"
            >
              B2B
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <span>{player.position || "—"}</span>
          <span className="text-[10px] font-medium text-muted-foreground/60">
            {isHome ? `vs ${opponentAbbr}` : `@ ${opponentAbbr}`}
          </span>
        </p>

        {/* Metrics row — omit for OUT players (projections are meaningless) */}
        {!isOut && (
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {/* Projected minutes — dominant number */}
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Proj Min
              </span>
              <span className="text-sm font-bold tabular-nums text-primary">
                {player.projectedMinutes !== null ? Math.round(player.projectedMinutes) : "—"}
              </span>
            </div>

            {/* FPTS last 5 with hot/cold suffix */}
            {player.avgFptsLast5 !== null && (
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  FPTS (L5)
                </span>
                <span className={`text-sm font-bold tabular-nums ${FORM_COLOR[player.formTrend]}`}>
                  {player.avgFptsLast5.toFixed(1)}
                  {FORM_SUFFIX[player.formTrend]}
                </span>
              </div>
            )}

            {/* Minutes trend — only when rising or falling (skip flat) */}
            {player.minutesTrend && player.minutesTrend !== "flat" && (
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Min Trend
                </span>
                <span className={`text-xs font-bold ${TREND_COLOR[player.minutesTrend]}`}>
                  {TREND_ICON[player.minutesTrend]} {player.minutesTrend === "up" ? "Rising" : "Falling"}
                </span>
              </div>
            )}

            {/* Confidence — derived from consistency + status */}
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                Confidence
              </span>
              <span className={`text-xs font-semibold ${CONFIDENCE_COLOR[confidence]}`}>
                {confidence}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right: recommendation badge (or OUT marker) */}
      {isOut ? (
        <span className="shrink-0 mt-0.5 text-[10px] text-rose-400 font-semibold border border-rose-500/30 bg-rose-500/10 rounded-md px-1.5 py-0.5">
          OUT
        </span>
      ) : (
        <RecommendationBadge tier={player.recommendation} className="shrink-0 mt-0.5" />
      )}
    </div>
  );
}

// ── TeamAvailabilityCard ──────────────────────────────────────────────────────
//
// Compact summary card for one team's availability before the game starts.
// Only shows "Out" and "GTD" rows when there actually are relevant players —
// avoids cluttering the card with "Out: None" lines.

function TeamAvailabilityCard({
  teamAbbreviation,
  availability,
  isBackToBack,
}: {
  teamAbbreviation: string;
  availability: TeamAvailabilitySummary;
  isBackToBack: boolean;
}) {
  const clean = availability.out.length === 0 && availability.questionable.length === 0;

  return (
    <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-foreground">{teamAbbreviation}</span>
          {isBackToBack && (
            <span className="text-[9px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 rounded px-1 py-0.5">
              B2B
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-bold tabular-nums rounded px-1.5 py-0.5 ${
            availability.lineupConfirmed
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-muted/40 text-muted-foreground"
          }`}
        >
          {availability.confirmedStarters}/5 confirmed
        </span>
      </div>

      {clean ? (
        <p className="text-[10px] text-emerald-400/80 font-medium">No injury concerns</p>
      ) : (
        <>
          {availability.out.length > 0 && (
            <p className="text-[10px] text-muted-foreground truncate" title={availability.out.join(", ")}>
              <span className="font-semibold text-rose-400">Out:</span>{" "}
              {availability.out.join(", ")}
            </p>
          )}
          {availability.questionable.length > 0 && (
            <p className="text-[10px] text-muted-foreground truncate" title={availability.questionable.join(", ")}>
              <span className="font-semibold text-amber-400">GTD:</span>{" "}
              {availability.questionable.join(", ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ── PregameIntelPanel ─────────────────────────────────────────────────────────

/**
 * Pre-Game Intelligence panel — renders on the Box Score page while a game
 * is still scheduled, replacing the (otherwise empty) roster table. Returns
 * null the moment the game starts; the live box score takes over.
 *
 * Layout:
 *   1. Header strip with panel label + tip-off time + last-refreshed stamp
 *   2. Blowout risk banner (only when Medium or High — Low is noise)
 *   3. Two team availability cards side-by-side
 *   4. Away roster — each player as a PlayerIntelRow
 *   5. Home roster
 *   6. Methodology footnote
 */
export function PregameIntelPanel({
  game,
  league,
  lastUpdated,
}: {
  game: Game;
  league: import("../lib/types").LeagueKey;
  lastUpdated: Date | null;
}) {
  const intel = usePregameIntel(game, league);

  if (game.status !== "scheduled") return null;

  const loading = intel.away === null || intel.home === null;

  // Back-to-back flag per team — derived from any player in that team's intel
  // (all players on the same team share the same backToBack value).
  const awayB2B = intel.away?.[0]?.backToBack ?? false;
  const homeB2B = intel.home?.[0]?.backToBack ?? false;

  return (
    <div className="bg-muted/20 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Pre-Game Intel
        </span>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          {game.startTimeIso && (
            <span>Tip-off {formatTipoff(game.startTimeIso)}</span>
          )}
          {game.startTimeIso && lastUpdated && (
            <span className="text-muted-foreground/40">·</span>
          )}
          {lastUpdated && (
            <span className="text-muted-foreground/60">{formatTimestamp(lastUpdated)}</span>
          )}
        </div>
      </div>

      {/* Blowout risk — only shown for Medium and High (Low is noise) */}
      {intel.blowoutRisk && intel.blowoutRisk !== "Low" && (
        <div
          className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs font-semibold flex items-center gap-2 ${
            BLOWOUT_STYLES[intel.blowoutRisk]
          }`}
        >
          <span aria-hidden>⚡</span>
          <span>
            {intel.blowoutRisk} blowout risk
            {game.pregameOdds?.spread != null &&
              ` · ${game.pregameOdds.spread.toFixed(1)} pt spread`}
            {" · Favored team's starters may rest in Q4"}
          </span>
        </div>
      )}

      {loading ? (
        <div className="p-4 flex flex-col gap-3">
          {/* Skeleton for team availability cards */}
          <div className="flex gap-2">
            <div className="flex-1 h-16 rounded-lg bg-muted/40 animate-pulse" />
            <div className="flex-1 h-16 rounded-lg bg-muted/40 animate-pulse" />
          </div>
          {/* Skeleton for player rows */}
          <div className="rounded-xl border border-border overflow-hidden">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
              >
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted/50 animate-pulse" />
                  <div className="h-3 w-48 rounded bg-muted/40 animate-pulse" />
                </div>
                <div className="h-6 w-14 rounded-md bg-muted/40 animate-pulse shrink-0" />
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground/50">Loading lineups &amp; injury reports…</p>
        </div>
      ) : (
        <>
          {/* Team availability summary — side-by-side cards */}
          <div className="flex gap-2 px-4 pt-3">
            <TeamAvailabilityCard
              teamAbbreviation={game.awayTeam.abbreviation}
              availability={intel.awayAvailability!}
              isBackToBack={awayB2B}
            />
            <TeamAvailabilityCard
              teamAbbreviation={game.homeTeam.abbreviation}
              availability={intel.homeAvailability!}
              isBackToBack={homeB2B}
            />
          </div>

          {/* Away roster */}
          <div className="mt-4">
            <div className="px-4 py-2 bg-background border-y border-border flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">{game.awayTeam.name}</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Away</span>
            </div>
            <div className="bg-card">
              {intel.away!.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No rotation data available yet.
                </p>
              ) : (
                intel.away!.map((p) => (
                  <PlayerIntelRow
                    key={p.playerId}
                    player={p}
                    isHome={false}
                    opponentAbbr={game.homeTeam.abbreviation}
                  />
                ))
              )}
            </div>
          </div>

          {/* Home roster */}
          <div className="mt-4">
            <div className="px-4 py-2 bg-background border-y border-border flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">{game.homeTeam.name}</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Home</span>
            </div>
            <div className="bg-card">
              {intel.home!.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  No rotation data available yet.
                </p>
              ) : (
                intel.home!.map((p) => (
                  <PlayerIntelRow
                    key={p.playerId}
                    player={p}
                    isHome={true}
                    opponentAbbr={game.awayTeam.abbreviation}
                  />
                ))
              )}
            </div>
          </div>

          {/* Methodology footnote */}
          <p className="px-4 pt-4 pb-2 text-[10px] text-muted-foreground leading-relaxed">
            <strong>Confirmed</strong> = ESPN has published tonight's lineup.{" "}
            <strong>Expected</strong> = heuristic from each player's last game.{" "}
            Projections are estimates — not official forecasts.
          </p>
        </>
      )}
    </div>
  );
}
