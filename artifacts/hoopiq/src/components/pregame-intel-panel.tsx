import { InjuryBadge, BadgeStatus } from "./injury-badge";
import { RecommendationBadge } from "./recommendation-badge";
import { usePregameIntel } from "../hooks/use-pregame-intel";
import { PregamePlayerIntel, LineupStatus, TeamAvailabilitySummary, BlowoutRisk } from "../lib/pregame-intel";
import { Game } from "../lib/types";

// Lineup statuses map 1:1 onto InjuryBadge's BadgeStatus keys except for
// the plain "Bench"/"Confirmed Bench" case, which we render with the
// existing "Bench" style either way (both mean "not starting").
function lineupBadgeStatus(status: LineupStatus): BadgeStatus {
  if (status === "Confirmed Bench") return "Bench";
  return status as BadgeStatus;
}

const TREND_ICON: Record<"up" | "down" | "flat", string> = { up: "↑", down: "↓", flat: "→" };
const TREND_LABEL: Record<"up" | "down" | "flat", string> = { up: "Increasing", down: "Decreasing", flat: "Stable" };
const TREND_COLOR: Record<"up" | "down" | "flat", string> = {
  up: "text-emerald-400",
  down: "text-rose-400",
  flat: "text-muted-foreground",
};

const FORM_COLOR: Record<PregamePlayerIntel["formTrend"], string> = {
  Hot: "text-emerald-400",
  Cold: "text-rose-400",
  Average: "text-muted-foreground",
};

const BLOWOUT_STYLES: Record<BlowoutRisk, string> = {
  Low: "bg-muted/40 text-muted-foreground border-border",
  Medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  High: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function PlayerIntelRow({ player }: { player: PregamePlayerIntel }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{player.name}</span>
          <InjuryBadge status={lineupBadgeStatus(player.status)} />
          {player.backToBack && (
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 border shrink-0 bg-purple-500/15 text-purple-400 border-purple-500/30"
              title="Team is playing on a back-to-back (games on consecutive nights)"
            >
              B2B
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">{player.position || "—"}</p>

        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Min L5/L10</span>
            <span className="text-xs font-bold tabular-nums text-foreground">
              {player.avgMinutesLast5 !== null ? player.avgMinutesLast5.toFixed(1) : "—"} /{" "}
              {player.avgMinutesLast10 !== null ? player.avgMinutesLast10.toFixed(1) : "—"}
            </span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Proj. Min</span>
            <span className="text-xs font-bold tabular-nums text-primary">
              {player.projectedMinutes !== null ? player.projectedMinutes.toFixed(1) : "—"}
            </span>
          </div>
          {player.minutesTrend && (
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Trend</span>
              <span className={`text-xs font-bold ${TREND_COLOR[player.minutesTrend]}`}>
                {TREND_ICON[player.minutesTrend]} {TREND_LABEL[player.minutesTrend]}
              </span>
            </div>
          )}
          <div className="flex flex-col leading-tight">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">FPTS L5</span>
            <span className={`text-xs font-bold tabular-nums ${FORM_COLOR[player.formTrend]}`}>
              {player.avgFptsLast5 !== null ? player.avgFptsLast5.toFixed(1) : "—"} ({player.formTrend})
            </span>
          </div>
          {player.consistency && (
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Consistency</span>
              <span className="text-xs font-bold text-foreground">{player.consistency}</span>
            </div>
          )}
        </div>
      </div>

      <RecommendationBadge tier={player.recommendation} className="shrink-0 mt-0.5" />
    </div>
  );
}

function TeamAvailabilityCard({
  teamAbbreviation,
  availability,
}: {
  teamAbbreviation: string;
  availability: TeamAvailabilitySummary;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1.5 flex-1 min-w-0">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{teamAbbreviation}</span>
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
      <p className="text-[10px] text-muted-foreground truncate" title={availability.out.join(", ")}>
        <span className="font-semibold text-rose-400">Out:</span>{" "}
        {availability.out.length > 0 ? availability.out.join(", ") : "None"}
      </p>
      <p className="text-[10px] text-muted-foreground truncate" title={availability.questionable.join(", ")}>
        <span className="font-semibold text-amber-400">Questionable/GTD:</span>{" "}
        {availability.questionable.length > 0 ? availability.questionable.join(", ") : "None"}
      </p>
      <p className="text-[10px] text-muted-foreground truncate" title={availability.probable.join(", ")}>
        <span className="font-semibold text-emerald-400">Probable:</span>{" "}
        {availability.probable.length > 0 ? availability.probable.join(", ") : "None"}
      </p>
    </div>
  );
}

/**
 * The whole Pre-Game Intelligence experience for a scheduled game — all
 * on the Box Score page, no extra taps required. Renders nothing (returns
 * null) once the game has started; box-score.tsx falls back to its
 * normal live/final rendering in that case.
 */
export function PregameIntelPanel({
  game,
  league,
  lastUpdated,
}: {
  game: Game;
  league: "nba" | "wnba";
  lastUpdated: Date | null;
}) {
  const intel = usePregameIntel(game, league);

  if (game.status !== "scheduled") return null;

  const loading = intel.away === null || intel.home === null;

  return (
    <div className="bg-muted/20 pb-12">
      {/* Refresh status */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          Pre-Game Intelligence
        </span>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground">Auto-updating · Updated {formatTime(lastUpdated)}</span>
        )}
      </div>

      {intel.blowoutRisk && (
        <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-[11px] font-semibold ${BLOWOUT_STYLES[intel.blowoutRisk]}`}>
          Blowout Risk: {intel.blowoutRisk}
          {game.pregameOdds?.spread != null && ` · Spread ${game.pregameOdds.spread.toFixed(1)} pts`}
          {" — large projected margins can mean reduced fourth-quarter minutes for favored-team starters."}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Loading lineups &amp; injury reports...</div>
      ) : (
        <>
          {/* Team availability at a glance */}
          <div className="flex gap-2 px-4 pt-3">
            <TeamAvailabilityCard teamAbbreviation={game.awayTeam.abbreviation} availability={intel.awayAvailability!} />
            <TeamAvailabilityCard teamAbbreviation={game.homeTeam.abbreviation} availability={intel.homeAvailability!} />
          </div>

          {/* Away roster */}
          <div className="mt-4">
            <div className="px-4 py-2 bg-background border-y border-border">
              <span className="text-xs font-bold text-foreground">{game.awayTeam.name}</span>
            </div>
            <div className="bg-card">
              {intel.away!.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No rotation data available yet.</p>
              ) : (
                intel.away!.map((p) => <PlayerIntelRow key={p.playerId} player={p} />)
              )}
            </div>
          </div>

          {/* Home roster */}
          <div className="mt-4">
            <div className="px-4 py-2 bg-background border-y border-border">
              <span className="text-xs font-bold text-foreground">{game.homeTeam.name}</span>
            </div>
            <div className="bg-card">
              {intel.home!.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">No rotation data available yet.</p>
              ) : (
                intel.home!.map((p) => <PlayerIntelRow key={p.playerId} player={p} />)
              )}
            </div>
          </div>

          <p className="px-4 pt-4 text-[10px] text-muted-foreground leading-relaxed">
            Starter status is <strong>Confirmed</strong> once ESPN publishes tonight's box score, and{" "}
            <strong>Expected</strong> (a heuristic from each player's most recent game) before that. Minutes
            projections and recommendation badges are derived from real recent game logs — not an official
            projection.
          </p>
        </>
      )}
    </div>
  );
}
