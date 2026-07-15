import { Link } from "wouter";
import { calculateFantasyPoints } from "../lib/stats";
import { getAllTrackedGames, PlayerGameEntry } from "../lib/player-history";
import { inactiveStatusLabel, minutesValue, starterBadgeLabel } from "../lib/player-status";
import { averageFpts, computeTrend, RecentFormBadge } from "./recent-form-badge";
import { InjuryBadge } from "./injury-badge";
import { Game, Player } from "../lib/types";

interface PlayerDetailSheetProps {
  player: Player;
  teamAbbreviation: string;
  gameStatus: Game["status"];
  recentForm: PlayerGameEntry[];
  onClose: () => void;
  /** Enables the "Full Game Log" link to the network-backed player detail page. */
  league?: "nba" | "wnba";
}

/**
 * Full player detail overlay: position, team, starter/bench status,
 * minutes, live fantasy points, last 5 tracked fantasy games, and a
 * "season" average derived from every game tracked locally for this
 * player (see lib/player-history.ts — there's no real season-log
 * endpoint, so this is clearly labeled as app-tracked rather than a true
 * season stat).
 */
export function PlayerDetailSheet({ player, teamAbbreviation, gameStatus, recentForm, onClose, league }: PlayerDetailSheetProps) {
  const liveFpts = calculateFantasyPoints(player.stats);
  const statusLabel = inactiveStatusLabel(player, gameStatus);
  const starterLabel = starterBadgeLabel(player);
  const allTracked = getAllTrackedGames(player.id);
  const trackedAvg = allTracked.length > 0 ? averageFpts(allTracked) : null;
  const trend = recentForm.length > 0 ? computeTrend(recentForm) : null;

  const gameLogHref = league
    ? `/${league}/player/${player.id}?${new URLSearchParams({
        name: player.name,
        team: teamAbbreviation,
        number: player.number,
        position: player.position,
        ...(statusLabel ? { injuryStatus: statusLabel } : {}),
      }).toString()}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">{player.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {teamAbbreviation} · #{player.number} · {player.position || "—"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player details"
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* Status badges */}
          {(statusLabel || starterLabel) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <InjuryBadge status={statusLabel ?? undefined} />
              <InjuryBadge status={starterLabel ?? undefined} />
            </div>
          )}

          {/* Key stats grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Minutes</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {player.stats.minutes ?? (gameStatus === "scheduled" ? "—" : minutesValue(player.stats).toString())}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Live FPTS</span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {gameStatus === "scheduled" ? "—" : liveFpts.toFixed(1)}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Season Avg*</span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {trackedAvg !== null ? trackedAvg.toFixed(1) : "—"}
              </span>
            </div>
          </div>

          {/* Box score line */}
          <div>
            <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">This Game</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {[
                { label: "PTS", value: player.stats.points },
                { label: "REB", value: player.stats.rebounds },
                { label: "AST", value: player.stats.assists },
                { label: "STL", value: player.stats.steals },
                { label: "BLK", value: player.stats.blocks },
                { label: "TO", value: player.stats.turnovers },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-muted/30 py-2">
                  <div className="text-sm font-bold tabular-nums text-foreground">{stat.value}</div>
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent form */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Last {recentForm.length || 5} Fantasy Games
              </p>
              {trend && <RecentFormBadge entries={recentForm} />}
            </div>
            {recentForm.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No games tracked yet — this builds up as you view box scores for this player.
              </p>
            ) : (
              <div className="flex items-end gap-1.5 h-16">
                {recentForm.map((entry, i) => {
                  const max = Math.max(...recentForm.map((e) => e.fpts), 1);
                  const heightPct = Math.max((entry.fpts / max) * 100, 6);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 h-full">
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${heightPct}%` }}
                        title={`${entry.fpts.toFixed(1)} FPTS`}
                      />
                      <span className="text-[9px] text-muted-foreground tabular-nums">{entry.fpts.toFixed(0)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border pt-3">
            *Season Avg is the average fantasy score across every game for this player tracked while using
            this app ({allTracked.length} game{allTracked.length === 1 ? "" : "s"} so far), not an official
            league season average.
          </p>

          {gameLogHref && (
            <Link href={gameLogHref}>
              <div
                onClick={onClose}
                className="rounded-lg bg-primary text-primary-foreground border border-primary-border py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform"
              >
                View Full Game Log
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
