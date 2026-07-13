import { PlayerGameEntry } from "../lib/player-history";

type Trend = "up" | "down" | "flat";

function computeTrend(entries: PlayerGameEntry[]): Trend {
  if (entries.length < 2) return "flat";
  const latest = entries[entries.length - 1].fpts;
  const priorAvg = entries.slice(0, -1).reduce((sum, e) => sum + e.fpts, 0) / (entries.length - 1);
  if (latest > priorAvg + 1.5) return "up";
  if (latest < priorAvg - 1.5) return "down";
  return "flat";
}

const TREND_ICON: Record<Trend, string> = { up: "\u2191", down: "\u2193", flat: "\u2192" };
const TREND_COLOR: Record<Trend, string> = {
  up: "text-emerald-400",
  down: "text-rose-400",
  flat: "text-muted-foreground",
};

/**
 * Compact "last N games" indicator: average fantasy points plus a trend
 * arrow. Renders nothing until at least one game has been recorded for
 * this player (see lib/player-history.ts for what "recent" means here).
 */
export function RecentFormBadge({ entries, className = "" }: { entries: PlayerGameEntry[]; className?: string }) {
  if (entries.length === 0) return null;

  const avg = entries.reduce((sum, e) => sum + e.fpts, 0) / entries.length;
  const trend = computeTrend(entries);

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${TREND_COLOR[trend]} ${className}`}
      title={`Last ${entries.length} game${entries.length > 1 ? "s" : ""} viewed: ${entries
        .map((e) => e.fpts.toFixed(1))
        .join(", ")}`}
    >
      L{entries.length} {avg.toFixed(1)} {TREND_ICON[trend]}
    </span>
  );
}
