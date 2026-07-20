import React, { useMemo, useState } from "react";
import { useParams, useSearch, Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { InjuryBadge } from "../components/injury-badge";
import { FantasyTrendChart, MinutesTrendChart } from "../components/game-log-chart";
import { usePlayerGameLog } from "../hooks/use-player-game-log";
import { calculateFantasyPoints } from "../lib/stats";
import { computeGameLogMetrics } from "../lib/game-log-metrics";
import { minutesValue } from "../lib/player-status";
import { PlayerGameLogEntry } from "../lib/types";
import type { BadgeStatus } from "../components/injury-badge";

// ── Style maps ─────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatGameDate(iso: string | null): string {
  if (!iso) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return "-";
  }
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function pct(count: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((count / total) * 100)}%`;
}

// ── Derived statistics ─────────────────────────────────────────────────────────

type Splits = {
  label: string;
  games: number;
  avgFpts: number | null;
  avgMinutes: number | null;
};

function computeSplits(games: PlayerGameLogEntry[], filterFn: (g: PlayerGameLogEntry) => boolean): Splits & { label: string } {
  const filtered = games.filter(filterFn);
  const fptsArr = filtered.map((g) => calculateFantasyPoints(g.stats));
  const minsArr = filtered.map((g) => minutesValue(g.stats));
  return {
    label: "",
    games: filtered.length,
    avgFpts: avg(fptsArr),
    avgMinutes: avg(minsArr),
  };
}

type OpponentEntry = {
  abbr: string;
  name: string;
  games: number;
  avgFpts: number;
  avgMinutes: number;
  wins: number;
};

function computeOpponentHistory(games: PlayerGameLogEntry[]): OpponentEntry[] {
  const map = new Map<string, { name: string; fpts: number[]; mins: number[]; wins: number }>();
  for (const g of games) {
    const key = g.opponentAbbreviation;
    if (!map.has(key)) map.set(key, { name: g.opponentName, fpts: [], mins: [], wins: 0 });
    const entry = map.get(key)!;
    entry.fpts.push(calculateFantasyPoints(g.stats));
    entry.mins.push(minutesValue(g.stats));
    if (g.result === "W") entry.wins++;
  }
  return Array.from(map.entries())
    .map(([abbr, e]) => ({
      abbr,
      name: e.name,
      games: e.fpts.length,
      avgFpts: (avg(e.fpts) ?? 0),
      avgMinutes: (avg(e.mins) ?? 0),
      wins: e.wins,
    }))
    .sort((a, b) => b.avgFpts - a.avgFpts);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  colorClass = "text-foreground",
  sub,
}: {
  label: string;
  value: string | null;
  colorClass?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`text-lg font-bold tabular-nums leading-tight ${colorClass}`}>{value ?? "—"}</span>
      {sub && <span className="text-[10px] text-muted-foreground/70">{sub}</span>}
    </div>
  );
}

function SplitBar({
  leftLabel,
  leftVal,
  rightLabel,
  rightVal,
  showMinutes = false,
}: {
  leftLabel: string;
  leftVal: Splits;
  rightLabel: string;
  rightVal: Splits;
  showMinutes?: boolean;
}) {
  const leftFpts = leftVal.avgFpts;
  const rightFpts = rightVal.avgFpts;
  const max = Math.max(leftFpts ?? 0, rightFpts ?? 0) || 1;

  if (leftVal.games === 0 && rightVal.games === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs font-bold text-foreground">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>

      {/* FPTS comparison */}
      <div className="flex flex-col gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Avg FPTS</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-primary w-10 text-right">
            {leftFpts !== null ? leftFpts.toFixed(1) : "—"}
          </span>
          {leftFpts !== null && rightFpts !== null && (
            <div className="flex-1 flex items-center gap-0.5 h-2">
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${((leftFpts / max) * 50)}%`, minWidth: leftFpts > 0 ? 4 : 0 }}
              />
              <div className="w-px h-3 bg-border mx-0.5 shrink-0" />
              <div
                className="h-full rounded-full bg-primary/70 transition-all"
                style={{ width: `${((rightFpts / max) * 50)}%`, minWidth: rightFpts > 0 ? 4 : 0 }}
              />
            </div>
          )}
          <span className="text-sm font-bold tabular-nums text-primary w-10 text-left">
            {rightFpts !== null ? rightFpts.toFixed(1) : "—"}
          </span>
        </div>
      </div>

      {/* Minutes comparison */}
      {showMinutes && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="tabular-nums">{leftVal.avgMinutes !== null ? `${leftVal.avgMinutes.toFixed(0)} min` : "—"}</span>
          <span className="text-[9px] font-semibold uppercase tracking-wider">Avg MIN</span>
          <span className="tabular-nums">{rightVal.avgMinutes !== null ? `${rightVal.avgMinutes.toFixed(0)} min` : "—"}</span>
        </div>
      )}

      {/* Game count */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>{leftVal.games} game{leftVal.games !== 1 ? "s" : ""}</span>
        <span>{rightVal.games} game{rightVal.games !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PlayerDetail() {
  const params = useParams();
  const league = params.league as import("../lib/types").LeagueKey;
  const playerId = params.playerId as string;

  const search = new URLSearchParams(useSearch());
  const name = search.get("name") ?? "Player";
  const team = search.get("team") ?? "";
  const number = search.get("number") ?? "";
  const position = search.get("position") ?? "";
  const injuryStatus = (search.get("injuryStatus") as BadgeStatus | null) ?? undefined;

  const [showAll10, setShowAll10] = useState(false);

  const { games, error } = usePlayerGameLog(playerId, league);
  const loading = games === null;

  const metrics = useMemo(
    () => (games && games.length > 0 ? computeGameLogMetrics(games) : null),
    [games],
  );

  // ── Extended stats ─────────────────────────────────────────────────────────

  const extendedStats = useMemo(() => {
    if (!games || games.length === 0 || !metrics) return null;

    const fptsAll = metrics.fptsByGame;
    const base = metrics.avgFptsLast10 ?? metrics.avgFptsLast5 ?? 0;

    // Boom% = games where FPTS > 1.5× average
    const boomGames = fptsAll.filter((f) => f > base * 1.5).length;
    const boomPct = pct(boomGames, fptsAll.length);

    // Bust% = games where FPTS < 0.5× average
    const bustGames = fptsAll.filter((f) => f < base * 0.5).length;
    const bustPct = pct(bustGames, fptsAll.length);

    // Value score = FPTS per minute
    const minsAll = metrics.minutesByGame.filter((m) => m > 0);
    const avgMinutes = avg(minsAll);
    const valueScore =
      avgMinutes && metrics.avgFptsLast10
        ? (metrics.avgFptsLast10 / avgMinutes).toFixed(2)
        : null;

    // Splits
    const homeGames = computeSplits(games, (g) => g.homeAway === "home");
    const awayGames = computeSplits(games, (g) => g.homeAway === "away");
    const winGames  = computeSplits(games, (g) => g.result === "W");
    const lossGames = computeSplits(games, (g) => g.result === "L");

    // Opponent history
    const opponentHistory = computeOpponentHistory(games);

    return { boomPct, bustPct, valueScore, homeGames, awayGames, winGames, lossGames, opponentHistory };
  }, [games, metrics]);

  // Chart data: oldest → newest (left to right)
  const last10 = games?.slice(0, 10) ?? [];
  const last5  = games?.slice(0, 5)  ?? [];
  const chartGames = (showAll10 ? last10 : last5).slice().reverse();
  const chartPoints = chartGames.map((g) => ({
    label: formatGameDate(g.date),
    fpts: calculateFantasyPoints(g.stats),
    minutes: minutesValue(g.stats),
  }));

  const tableGames = showAll10 ? last10 : last5;

  return (
    <MobileLayout showBack title="Player Intelligence">
      <div className="p-4 sm:p-6 flex flex-col gap-5 pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-foreground leading-tight">{name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {[team, number && `#${number}`, position].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
          {injuryStatus && <InjuryBadge status={injuryStatus} />}
        </div>

        {/* ── Loading / error / empty states ──────────────────────────────── */}
        {loading && (
          <div className="flex flex-col gap-3 py-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl skeleton-shimmer" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
            <p className="text-center text-xs text-muted-foreground/50">Loading game log…</p>
          </div>
        )}

        {!loading && error && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Couldn't load this player's game log right now. Try again shortly.
          </div>
        )}

        {!loading && !error && games && games.length === 0 && (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No game history found for this player yet this season.
          </div>
        )}

        {!loading && !error && games && games.length > 0 && metrics && extendedStats && (
          <>
            {/* ── Core metrics grid ─────────────────────────────────────── */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Season Form</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard
                  label="FPTS (L5)"
                  value={metrics.avgFptsLast5?.toFixed(1) ?? null}
                  colorClass="text-primary"
                />
                <StatCard
                  label="FPTS (L10)"
                  value={metrics.avgFptsLast10?.toFixed(1) ?? null}
                  colorClass="text-primary"
                />
                <StatCard
                  label="High / Low"
                  value={
                    metrics.highFpts !== null && metrics.lowFpts !== null
                      ? `${metrics.highFpts.toFixed(0)} / ${metrics.lowFpts.toFixed(0)}`
                      : null
                  }
                />
                <StatCard
                  label="Form Trend"
                  value={metrics.trend}
                  colorClass={TREND_COLOR[metrics.trend]}
                />
              </div>
            </div>

            {/* ── Boom / Bust / Consistency / Value ────────────────────── */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Variance &amp; Value
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCard
                  label="Boom %"
                  value={extendedStats.boomPct}
                  colorClass="text-emerald-400"
                  sub="Games > 1.5× avg"
                />
                <StatCard
                  label="Bust %"
                  value={extendedStats.bustPct}
                  colorClass="text-rose-400"
                  sub="Games < 0.5× avg"
                />
                <StatCard
                  label="Consistency"
                  value={metrics.consistency ?? "—"}
                  colorClass={metrics.consistency ? CONSISTENCY_COLOR[metrics.consistency] : "text-muted-foreground"}
                />
                <StatCard
                  label="FPTS / Min"
                  value={extendedStats.valueScore}
                  colorClass="text-foreground"
                  sub="Efficiency score"
                />
              </div>
            </div>

            {/* ── Minutes trend ─────────────────────────────────────────── */}
            {metrics.minutesTrend && metrics.minutesTrend !== "flat" && (
              <div
                className={`rounded-xl border px-4 py-2.5 flex items-center gap-2 text-sm ${
                  metrics.minutesTrend === "up"
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                    : "border-rose-500/30 bg-rose-500/5 text-rose-400"
                }`}
              >
                <span className="text-base">{metrics.minutesTrend === "up" ? "📈" : "📉"}</span>
                <span className="font-semibold">
                  Minutes trending {metrics.minutesTrend === "up" ? "up" : "down"} over recent games
                </span>
              </div>
            )}

            {/* ── Fantasy trend chart ───────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Fantasy Points — Last {chartGames.length}
                </p>
                {games.length >= 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAll10((v) => !v)}
                    className="text-[10px] font-semibold text-primary hover:underline underline-offset-2"
                  >
                    {showAll10 ? "Show L5" : "Show L10"}
                  </button>
                )}
              </div>
              <FantasyTrendChart points={chartPoints.map((p) => ({ label: p.label, value: p.fpts }))} />
            </div>

            {/* ── Minutes trend chart ───────────────────────────────────── */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Minutes — Last {chartGames.length}
              </p>
              <MinutesTrendChart points={chartPoints.map((p) => ({ label: p.label, value: p.minutes }))} />
            </div>

            {/* ── Splits ───────────────────────────────────────────────── */}
            {(extendedStats.homeGames.games > 0 || extendedStats.awayGames.games > 0) && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Home vs Away
                </p>
                <SplitBar
                  leftLabel="🏠 Home"
                  leftVal={extendedStats.homeGames}
                  rightLabel="✈️ Away"
                  rightVal={extendedStats.awayGames}
                  showMinutes
                />
              </div>
            )}

            {(extendedStats.winGames.games > 0 || extendedStats.lossGames.games > 0) && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Win vs Loss
                </p>
                <SplitBar
                  leftLabel="✅ Wins"
                  leftVal={extendedStats.winGames}
                  rightLabel="❌ Losses"
                  rightVal={extendedStats.lossGames}
                  showMinutes
                />
              </div>
            )}

            {/* ── Opponent history ─────────────────────────────────────── */}
            {extendedStats.opponentHistory.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                  Opponent History
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead className="bg-muted/40 text-muted-foreground uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Opponent</th>
                          <th className="px-3 py-2 text-right font-semibold">GP</th>
                          <th className="px-3 py-2 text-right font-semibold text-primary">FPTS</th>
                          <th className="px-3 py-2 text-right font-semibold">MIN</th>
                          <th className="px-3 py-2 text-right font-semibold">W-L</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {extendedStats.opponentHistory.map((opp) => (
                          <tr key={opp.abbr} className="hover:bg-muted/20 transition-colors">
                            <td className="px-3 py-2 font-semibold text-foreground">
                              <span className="text-[11px]">{opp.abbr}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{opp.games}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-bold text-primary">
                              {opp.avgFpts.toFixed(1)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {opp.avgMinutes.toFixed(0)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {opp.wins}-{opp.games - opp.wins}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Recent games table ────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Last {tableGames.length} Games
                </p>
                {games.length >= 6 && (
                  <button
                    type="button"
                    onClick={() => setShowAll10((v) => !v)}
                    className="text-[10px] font-semibold text-primary hover:underline underline-offset-2"
                  >
                    {showAll10 ? "Show L5" : "Show L10"}
                  </button>
                )}
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs whitespace-nowrap">
                    <thead className="bg-muted/40 text-muted-foreground uppercase">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold">Date</th>
                        <th className="px-2 py-2 text-left font-semibold">Opp</th>
                        <th className="px-2 py-2 text-center font-semibold">W/L</th>
                        <th className="px-2 py-2 text-right font-semibold">MIN</th>
                        <th className="px-2 py-2 text-right font-semibold text-primary">FPTS</th>
                        <th className="px-2 py-2 text-right font-semibold">PTS</th>
                        <th className="px-2 py-2 text-right font-semibold">REB</th>
                        <th className="px-2 py-2 text-right font-semibold">AST</th>
                        <th className="px-2 py-2 text-right font-semibold">STL</th>
                        <th className="px-2 py-2 text-right font-semibold">BLK</th>
                        <th className="px-2 py-2 text-right font-semibold">TO</th>
                        <th className="px-2 py-2 text-right font-semibold">FG</th>
                        <th className="px-2 py-2 text-right font-semibold">3PT</th>
                        <th className="px-2 py-2 text-right font-semibold">FT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tableGames.map((g) => {
                        const fpts = calculateFantasyPoints(g.stats);
                        const base10 = metrics.avgFptsLast10 ?? metrics.avgFptsLast5 ?? 0;
                        const isBoom = base10 > 0 && fpts > base10 * 1.5;
                        const isBust = base10 > 0 && fpts < base10 * 0.5;
                        return (
                          <tr
                            key={g.gameId}
                            className={`hover:bg-muted/20 transition-colors ${
                              isBoom ? "bg-emerald-500/5" : isBust ? "bg-rose-500/5" : ""
                            }`}
                          >
                            <td className="px-2 py-2 text-muted-foreground">{formatGameDate(g.date)}</td>
                            <td className="px-2 py-2 font-medium text-foreground">
                              {g.homeAway === "away" ? "@ " : "vs "}
                              {g.opponentAbbreviation}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {g.result ? (
                                <span className={g.result === "W" ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                  {g.result}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{g.stats.minutes ?? "-"}</td>
                            <td className={`px-2 py-2 text-right tabular-nums font-bold ${
                              isBoom ? "text-emerald-400" : isBust ? "text-rose-400" : "text-primary"
                            }`}>
                              {fpts.toFixed(1)}
                              {isBoom && " 💥"}
                              {isBust && " ❄️"}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.stats.points}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.stats.rebounds}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.stats.assists}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.stats.steals}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{g.stats.blocks}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{g.stats.turnovers}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{g.stats.fieldGoals ?? "-"}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{g.stats.threePointers ?? "-"}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{g.stats.freeThrows ?? "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/50 leading-relaxed mt-2">
                Boom 💥 = FPTS &gt; 1.5× avg · Bust ❄️ = FPTS &lt; 0.5× avg ·
                Sourced from ESPN game log (refreshed every 45 min) ·
                Starter/bench flags not available for past games.
              </p>
            </div>
          </>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <Link href={`/${league}`}>
          <div className="text-xs text-primary hover:underline underline-offset-2 cursor-pointer mt-2">
            ← Back to {league.toUpperCase()} games
          </div>
        </Link>
      </div>
    </MobileLayout>
  );
}
