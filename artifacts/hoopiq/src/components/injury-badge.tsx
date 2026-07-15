export type BadgeStatus = "OUT" | "GTD" | "Questionable" | "Probable" | "DNP" | "Starter" | "Bench";

const BADGE_STYLES: Record<BadgeStatus, string> = {
  OUT: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  GTD: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Questionable: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Probable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  // Did-not-play / inactive / not-in-lineup — derived client-side, not from
  // the injury report, so it gets its own neutral (non-injury) styling.
  DNP: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  // Lineup role — a plain fact from the box score, not an availability
  // concern, so these get their own low-emphasis (non-alert) styling.
  Starter: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Bench: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

/** Renders nothing when the player has no status to show. */
export function InjuryBadge({ status, className = "" }: { status?: BadgeStatus; className?: string }) {
  if (!status) return null;
  return (
    <span
      className={`inline-block text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 border shrink-0 ${BADGE_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}
