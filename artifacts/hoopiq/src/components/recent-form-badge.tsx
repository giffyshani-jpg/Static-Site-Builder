import { PlayerGameEntry } from "../lib/player-history";

export type FormTrend = "Hot" | "Average" | "Cold";

export function computeTrend(entries: PlayerGameEntry[]): FormTrend {
  if (entries.length < 2) return "Average";
  const latest = entries[entries.length - 1].fpts;
  const priorAvg = entries.slice(0, -1).reduce((sum, e) => sum + e.fpts, 0) / (entries.length - 1);
  if (latest > priorAvg + 1.5) return "Hot";
  if (latest < priorAvg - 1.5) return "Cold";
  return "Average";
}

export function averageFpts(entries: PlayerGameEntry[]): number {
  if (entries.length === 0) return 0;
  return entries.reduce((sum, e) => sum + e.fpts, 0) / entries.length;
}

const TREND_ICON: Record<FormTrend, string> = { Hot: "\u2191", Cold: "\u2193", Average: "\u2192" };
const TREND_COLOR: Record<FormTrend, string> = {
  Hot: "text-emerald-400",
  Cold: "text-rose-400",
  Average: "text-muted-foreground",
};

/**
 * Compact "last N games" indicator: average fantasy points plus a Hot /
 * Average / Cold trend. Renders nothing until at least one game has been
 * recorded for this player (see lib/player-history.ts for what "recent"
 * means here).
 */
export function RecentFormBadge({ entries, className = "" }: { entries: PlayerGameEntry[]; className?: string }) {
  if (entries.length === 0) return null;

  const avg = averageFpts(entries);
  const trend = computeTrend(entries);

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${TREND_COLOR[trend]} ${className}`}
      title={`Last ${entries.length} game${entries.length > 1 ? "s" : ""} viewed: ${entries
        .map((e) => e.fpts.toFixed(1))
        .join(", ")} — Trend: ${trend}`}
    >
      L{entries.length} {avg.toFixed(1)} {TREND_ICON[trend]}
    </span>
  );
}
