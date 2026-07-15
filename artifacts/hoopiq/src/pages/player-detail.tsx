import React from "react";
import { useParams, useSearch, Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { InjuryBadge } from "../components/injury-badge";
import { FantasyTrendChart, MinutesTrendChart } from "../components/game-log-chart";
import { usePlayerGameLog } from "../hooks/use-player-game-log";
import { calculateFantasyPoints } from "../lib/stats";
import { computeGameLogMetrics } from "../lib/game-log-metrics";
import { minutesValue } from "../lib/player-status";
import type { BadgeStatus } from "../components/injury-badge";

const TREND_COLOR: Record<string, string> = {
  Hot: "text-emerald-400",
  Cold: "text-rose-400",
  Average: "text-muted-foreground",
};

const CONSISTENCY_COLOR: Record<string, string> = {
  Consistent: "text-emerald-400",
  "Somewhat Consistent": "text-amber-400",
  Volatile: "text-rose-400",
};

function formatGameDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return "-";
  }
}

export default function PlayerDetail() {
  const params = useParams();
  const league = params.league as "nba" | "wnba";
  const playerId = params.playerId as string;

  // Display-only context passed from the page that linked here (box
  // score / comparison already hold the full Player object) — this page
  // is about historical trend, so it doesn't need to re-fetch a live
  // game just to show the player's name/team/position header.
  const search = new URLSearchParams(useSearch());
  const name = search.get("name") ?? "Player";
  const team = search.get("team") ?? "";
  const number = search.get("number") ?? "";
  const position = search.get("position") ?? "";
  const injuryStatus = (search.get("injuryStatus") as BadgeStatus | null) ?? undefined;

  const { games, error } = usePlayerGameLog(playerId, league);
  const loading = games === null;

  const metrics = games ? computeGameLogMetrics(games) : null;
  const last5 = games?.slice(0, 5) ?? [];

  // Charts read oldest → newest (left to right), so reverse the
  // newest-first game log for the chart-point arrays.
  const chartPoints = [...last5].reverse().map((g) => ({
    label: formatGameDate(g.date),
    fpts: calculateFantasyPoints(g.stats),
    minutes: minutesValue(g.stats),
  }));

  return (
    <MobileLayout showBack title="Player Detail">
      <div className="p-4 sm:p-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {[team, number && `#${number}`, position].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          {injuryStatus && <InjuryBadge status={injuryStatus} />}
        </div>

        {/* Loading / error / empty states */}
        {loading && (
          <div className="py-10 text-center text-muted-foreground text-sm">Loading game log from ESPN...</div>
        )}

        {!loading && error && (
          <div className="py-10 text-center text-muted-foreground text-sm">
            Couldn't load this player's game log right now. Try again shortly.
          </div>
        )}

        {!loading && !error && games && games.length === 0 && (
          <div className="py-10 text-center text-muted-foreground text-sm">
            No game history found for this player yet this season.
          </div>
        )}

        {!loading && !error && games && games.length > 0 && metrics && (
          <>
            {/* Key derived metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Avg FPTS (L5)</span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {metrics.avgFptsLast5?.toFixed(1) ?? "-"}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Avg FPTS (L10)</span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {metrics.avgFptsLast10?.toFixed(1) ?? "-"}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">High / Low</span>
                <span className="text-lg font-bold tabular-nums text-foreground">
                  {metrics.highFpts?.toFixed(0) ?? "-"} / {metrics.lowFpts?.toFixed(0) ?? "-"}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 flex flex-col gap-1">
                <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Trend</span>
                <span className={`text-lg font-bold ${TREND_COLOR[metrics.trend]}`}>{metrics.trend}</span>
              </div>
            </div>

            {metrics.consistency && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Consistency:</span>
                <span className={`font-semibold ${CONSISTENCY_COLOR[metrics.consistency]}`}>{metrics.consistency}</span>
                {metrics.minutesTrend && metrics.minutesTrend !== "flat" && (
                  <span className="text-muted-foreground">
                    · Minutes trending {metrics.minutesTrend === "up" ? "up" : "down"}
                  </span>
                )}
              </div>
            )}

            {/* Fantasy trend chart */}
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                Fantasy Points — Last {last5.length}
              </p>
              <FantasyTrendChart points={chartPoints.map((p) => ({ label: p.label, value: p.fpts }))} />
            </div>

            {/* Minutes trend chart */}
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                Minutes — Last {last5.length}
              </p>
              <MinutesTrendChart points={chartPoints.map((p) => ({ label: p.label, value: p.minutes }))} />
            </div>

            {/* Last 5 games table */}
            <div>
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase mb-2">
                Last {last5.length} Games
              </p>
              <div className="w-full overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs text-left whitespace-nowrap">
                  <thead className="text-muted-foreground bg-muted/40 uppercase">
                    <tr>
                      <th className="px-2 py-2 font-medium">Date</th>
                      <th className="px-2 py-2 font-medium">Opp</th>
                      <th className="px-2 py-2 font-medium text-center">W/L</th>
                      <th className="px-2 py-2 font-medium text-right">MIN</th>
                      <th className="px-2 py-2 font-medium text-right">FPTS</th>
                      <th className="px-2 py-2 font-medium text-right">PTS</th>
                      <th className="px-2 py-2 font-medium text-right">REB</th>
                      <th className="px-2 py-2 font-medium text-right">AST</th>
                      <th className="px-2 py-2 font-medium text-right">STL</th>
                      <th className="px-2 py-2 font-medium text-right">BLK</th>
                      <th className="px-2 py-2 font-medium text-right">TO</th>
                      <th className="px-2 py-2 font-medium text-right">FG</th>
                      <th className="px-2 py-2 font-medium text-right">3PT</th>
                      <th className="px-2 py-2 font-medium text-right">FT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {last5.map((g) => (
                      <tr key={g.gameId}>
                        <td className="px-2 py-2">{formatGameDate(g.date)}</td>
                        <td className="px-2 py-2">
                          {g.homeAway === "away" ? "@" : "vs"} {g.opponentAbbreviation}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {g.result ? (
                            <span className={g.result === "W" ? "text-emerald-400" : "text-rose-400"}>{g.result}</span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.minutes ?? "-"}</td>
                        <td className="px-2 py-2 text-right tabular-nums font-bold text-primary">
                          {calculateFantasyPoints(g.stats).toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.points}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.rebounds}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.assists}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.steals}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.blocks}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.turnovers}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.fieldGoals ?? "-"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.threePointers ?? "-"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{g.stats.freeThrows ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
                Sourced from ESPN's game log for this player, refreshed at most every 45 minutes.
                Starter/bench status and plus/minus aren't available for past games — ESPN only
                publishes those alongside a specific game's live box score.
              </p>
            </div>
          </>
        )}

        <Link href={`/${league}`}>
          <div className="text-xs text-primary hover:underline underline-offset-2 cursor-pointer">
            ← Back to {league.toUpperCase()} games
          </div>
        </Link>
      </div>
    </MobileLayout>
  );
}
