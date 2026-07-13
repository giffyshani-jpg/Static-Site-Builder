import { Player } from "../lib/types";

const BADGE_STYLES: Record<NonNullable<Player["injuryStatus"]>, string> = {
  OUT: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  GTD: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Questionable: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Probable: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

/** Renders nothing when the player has no injury status on record. */
export function InjuryBadge({ status, className = "" }: { status?: Player["injuryStatus"]; className?: string }) {
  if (!status) return null;
  return (
    <span
      className={`inline-block text-[9px] font-bold uppercase tracking-wide rounded px-1 py-0.5 border shrink-0 ${BADGE_STYLES[status]} ${className}`}
    >
      {status}
    </span>
  );
}
