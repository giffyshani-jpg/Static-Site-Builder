import { RECOMMENDATION_EMOJI, RecommendationTier } from "../lib/pregame-intel";

const TIER_STYLES: Record<RecommendationTier, string> = {
  "Elite Play": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Strong Play": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Safe Value": "bg-sky-500/10 text-sky-400 border-sky-500/30",
  Risky: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Avoid: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

/**
 * The 🔥/✅/👍/⚠️/❌ fantasy recommendation badge — see
 * lib/pregame-intel.ts computeRecommendation() for how the tier is
 * derived. Always shown with its emoji so it reads at a glance in a
 * dense mobile list.
 */
export function RecommendationBadge({ tier, className = "" }: { tier: RecommendationTier; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold rounded-md px-1.5 py-0.5 border shrink-0 ${TIER_STYLES[tier]} ${className}`}
    >
      <span aria-hidden>{RECOMMENDATION_EMOJI[tier]}</span>
      {tier}
    </span>
  );
}
