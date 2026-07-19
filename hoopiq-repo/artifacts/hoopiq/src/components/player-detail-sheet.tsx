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
  league?: import("../lib/types").LeagueKey;
}

/**
 * Full player detail overlay — shows status, live stats, a color-coded
 * recent-form bar chart, and a link to the full ESPN-sourced game log.
 *
 * Recent form bars:
 *   • Green  — ≥ 10% above the average for those games
 *   • Red    — ≥ 10% below the average
 *   • Purple — within ±10% of the average
 *
 * An average reference line sits across the bars so the user can read
 * each bar's relative height at a glance.
 */
export function PlayerDetailSheet({
  player,
  teamAbbreviation,
  gameStatus,
  recentForm,
  onClose,
  league,
}: PlayerDetailSheetProps) {
  const liveFpts = calculateFantasyPoints(player.stats);
  const statusLabel = inactiveStatusLabel(player, gameStatus);
  const starterLabel = starterBadgeLabel(player);
  const allTracked = getAllTrackedGames(player.id);
  const trackedAvg = allTracked.length > 0 ? averageFpts(allTracked) : null;
  const trend = recentForm.length >= 2 ? computeTrend(recentForm) : null;

  const gameLogHref = league
    ? `/${league}/player/${player.id}?${new URLSearchParams({
        name: player.name,
        team: teamAbbreviation,
        number: player.number,
        position: player.position,
        ...(statusLabel ? { injuryStatus: statusLabel } : {}),
      }).toString()}`
    : null;

  // Only show "This Game" stats when the game is live or final — scheduled
  // games have all-zero stats which is misleading.
  const showGameStats = gameStatus !== "scheduled";

  // Bar chart computations (only run when there are form entries).
  const formMax = recentForm.length > 0 ? Math.max(...recentForm.map((e) => e.fpts), 1) : 1;
  const formAvg = recentForm.length > 0 ? averageFpts(recentForm) : 0;
  const avgLinePct = recentForm.length > 0 ? (formAvg / formMax) * 100 : 0;

  function barColor(fpts: number): string {
    if (formAvg <= 0) return "bg-primary/70";
    if (fpts >= formAvg * 1.1) return "bg-emerald-500/80";
    if (fpts <= formAvg * 0.9) return "bg-rose-500/70";
    return "bg-primary/70";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* ── Status badges ─────────────────────────────────────────── */}
          {(statusLabel || starterLabel) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <InjuryBadge status={statusLabel ?? undefined} />
              <InjuryBadge status={starterLabel ?? undefined} />
            </div>
          )}

          {/* ── View Full Game Log — prominent, near top ───────────────── */}
          {gameLogHref && (
            <Link href={gameLogHref}>
              <div
                onClick={onClose}
                className="rounded-lg border border-primary/40 text-primary py-2 px-4 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer active:scale-[0.98] transition-transform hover:bg-primary/5"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3h6l3 9-6 2.5" />
                  <path d="M21 3h-6l-3 9 6 2.5" />
                  <path d="M12 22v-8" />
                </svg>
                View Full Game Log (ESPN)
              </div>
            </Link>
          )}

          {/* ── Key stats grid ─────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                Minutes
              </span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {gameStatus === "scheduled"
                  ? "—"
                  : (player.stats.minutes ?? minutesValue(player.stats).toString())}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {gameStatus === "scheduled" ? "Proj FPTS" : "Live FPTS"}
              </span>
              <span className="text-lg font-bold tabular-nums text-primary">
                {gameStatus === "scheduled" ? "—" : liveFpts.toFixed(1)}
              </span>
            </div>
            <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                App Avg
              </span>
              <span className="text-lg font-bold tabular-nums text-foreground">
                {trackedAvg !== null ? trackedAvg.toFixed(1) : "—"}
              </span>
              {allTracked.length > 0 && (
                <span className="text-[9px] text-muted-foreground/60">{allTracked.length} tracked</span>
              )}
            </div>
          </div>

          {/* ── This Game stats — hidden when scheduled (all zeros = misleading) ── */}
          {showGameStats && (
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                {gameStatus === "final" ? "Final Stats" : "Live Stats"}
              </p>
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
                    <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent form chart ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                {recentForm.length > 0
                  ? `Last ${recentForm.length} Viewed Games`
                  : "Recent Form"}
              </p>
              {trend && (
                <div className="flex items-center gap-1.5">
                  <RecentFormBadge entries={recentForm} />
                  <span className="text-[10px] text-muted-foreground/60">
                    {trend === "Hot" ? "above avg" : trend === "Cold" ? "below avg" : "on avg"}
                  </span>
                </div>
              )}
            </div>

            {recentForm.length === 0 ? (
              <div className="rounded-lg bg-muted/20 border border-border/50 border-dashed py-5 text-center">
                <p className="text-xs text-muted-foreground">
                  No games tracked yet.
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  Builds up as you view box scores for this player.
                </p>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 h-20 relative">
                {/* Average reference line */}
                <div
                  className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/30 pointer-events-none z-10"
                  style={{ bottom: `${Math.max(avgLinePct, 4)}%` }}
                  title={`Avg: ${formAvg.toFixed(1)} FPTS`}
                />

                {recentForm.map((entry, i) => {
                  const heightPct = Math.max((entry.fpts / formMax) * 100, 6);
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center justify-end gap-1 h-full"
                    >
                      <div
                        className={`w-full rounded-t transition-all ${barColor(entry.fpts)}`}
                        style={{ height: `${heightPct}%` }}
                        title={`${entry.fpts.toFixed(1)} FPTS`}
                      />
                      <span className="text-[9px] text-muted-foreground tabular-nums">
                        {entry.fpts.toFixed(0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 mt-2 leading-relaxed">
              From box scores viewed in this app ({allTracked.length} total game
              {allTracked.length === 1 ? "" : "s"} tracked) — not an official season average.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
