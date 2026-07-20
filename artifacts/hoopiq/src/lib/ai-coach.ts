// AI Fantasy Coach — heuristic pick computation.
//
// Produces up to 12 named fantasy picks from real available data:
// game-log metrics, player status, back-to-back flags, credits, and
// home/away status. Every pick includes a short explanation grounded
// in actual numbers. Picks with insufficient data are simply omitted
// — no invented numbers, no guesses.
//
// Data requirements:
//   - Minimum 3 active players with a usable score (avgFptsLast5,
//     avgFptsLast10, or live currentFpts > 0) to produce any picks.
//   - Individual picks are hidden when their specific data is missing
//     (e.g. "Highest Ceiling" requires highFpts, "Best Value" requires
//     credits to be entered, "Sleeper" requires metrics vs median, etc).

import type { ConsistencyRating } from "./game-log-metrics";
import type { LineupStatus } from "./pregame-intel";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CoachPickKind =
  | "best_captain"
  | "best_vc"
  | "best_value"
  | "sleeper"
  | "fade"
  | "trending_up"
  | "trending_down"
  | "safest"
  | "highest_ceiling"
  | "home_advantage"
  | "back_to_back"
  | "injury_impact";

export const COACH_PICK_META: Record<CoachPickKind, { emoji: string; label: string }> = {
  best_captain:    { emoji: "🔥", label: "Best Captain" },
  best_vc:         { emoji: "⚡", label: "Best Vice Captain" },
  best_value:      { emoji: "💎", label: "Best Value Pick" },
  sleeper:         { emoji: "😴", label: "Sleeper Pick" },
  fade:            { emoji: "⚠️", label: "Fade Pick" },
  trending_up:     { emoji: "📈", label: "Trending Up" },
  trending_down:   { emoji: "📉", label: "Trending Down" },
  safest:          { emoji: "🛡️", label: "Safest Pick" },
  highest_ceiling: { emoji: "🚀", label: "Highest Ceiling" },
  home_advantage:  { emoji: "🏠", label: "Home Advantage" },
  back_to_back:    { emoji: "✈️", label: "B2B Fatigue Warning" },
  injury_impact:   { emoji: "🚑", label: "Injury Impact" },
};

/**
 * Per-player input for the AI Coach. Callers construct this from whatever
 * combination of live stats, pregame intel, and optimizer state they have.
 * Any field can be null/0/false — picks that require the missing data are
 * simply omitted.
 */
export type CoachPlayerInput = {
  id: string;
  name: string;
  teamAbbr: string;
  isHome: boolean;
  /** FPTS from the current live/final game's box score; 0 for scheduled games. */
  currentFpts: number;
  /** Avg FPTS last 5 real games (game-log); null if game log unavailable. */
  avgFptsLast5: number | null;
  avgFptsLast10: number | null;
  /** Peak FPTS in tracked history; null if history unavailable. */
  highFpts: number | null;
  minutesTrend: "up" | "down" | "flat" | null;
  formTrend: "Hot" | "Average" | "Cold";
  consistency: ConsistencyRating | null;
  status: LineupStatus;
  injuryStatus?: string;
  backToBack: boolean;
  /** Optimizer credits entered by the user; 0 = not set. */
  credits: number;
  projectedMinutes: number | null;
};

export type CoachPick = {
  kind: CoachPickKind;
  emoji: string;
  label: string;
  playerId: string;
  playerName: string;
  teamAbbr: string;
  explanation: string;
};

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Best available score for sorting/explanation: L5 avg → L10 avg → live FPTS. */
function bestScore(p: CoachPlayerInput): number | null {
  if (p.avgFptsLast5 !== null) return p.avgFptsLast5;
  if (p.avgFptsLast10 !== null) return p.avgFptsLast10;
  if (p.currentFpts > 0) return p.currentFpts;
  return null;
}

function isActive(p: CoachPlayerInput): boolean {
  return p.status !== "Out";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function scoreLabel(p: CoachPlayerInput): string {
  if (p.avgFptsLast5 !== null) return "last 5 games";
  if (p.avgFptsLast10 !== null) return "last 10 games";
  return "this game";
}

// ── Main computation ───────────────────────────────────────────────────────────

/**
 * Compute AI Coach picks from enriched player data. Returns an empty array
 * when the pool is too small or data is too sparse to say anything useful.
 * The caller should hide the entire UI section in that case.
 */
export function computeCoachPicks(players: CoachPlayerInput[]): CoachPick[] {
  const picks: CoachPick[] = [];

  const active = players.filter(isActive);
  const withScore = active.filter((p) => bestScore(p) !== null);

  // Require at least 3 scoreable players to produce meaningful picks.
  if (withScore.length < 3) return [];

  // Sorted high → low by best available score.
  const byScore = [...withScore].sort(
    (a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0),
  );

  const creditValues = active.filter((p) => p.credits > 0).map((p) => p.credits);
  const medianCredits = median(creditValues);

  const usedIds = new Set<string>();
  function claim(id: string) { usedIds.add(id); }
  function used(id: string) { return usedIds.has(id); }

  // ── 1. Best Captain ─────────────────────────────────────────────────────────
  const captain = byScore[0];
  if (captain) {
    claim(captain.id);
    const score = bestScore(captain)!;
    picks.push({
      kind: "best_captain",
      ...COACH_PICK_META.best_captain,
      playerId: captain.id,
      playerName: captain.name,
      teamAbbr: captain.teamAbbr,
      explanation: `${score.toFixed(1)} FPTS avg (${scoreLabel(captain)}) — 2× captain multiplier amplifies the highest floor in this pool.`,
    });
  }

  // ── 2. Best Vice Captain ────────────────────────────────────────────────────
  const vc = byScore.find((p) => !used(p.id));
  if (vc) {
    claim(vc.id);
    const score = bestScore(vc)!;
    picks.push({
      kind: "best_vc",
      ...COACH_PICK_META.best_vc,
      playerId: vc.id,
      playerName: vc.name,
      teamAbbr: vc.teamAbbr,
      explanation: `${score.toFixed(1)} FPTS avg (${scoreLabel(vc)}) — strong VC at 1.5× to maximise your scoring ceiling.`,
    });
  }

  // ── 3. Best Value Pick ──────────────────────────────────────────────────────
  if (creditValues.length >= 3) {
    const valuePick = [...withScore]
      .filter((p) => p.credits > 0)
      .sort((a, b) => {
        const rA = (bestScore(a) ?? 0) / a.credits;
        const rB = (bestScore(b) ?? 0) / b.credits;
        return rB - rA;
      })[0];
    if (valuePick && !used(valuePick.id)) {
      const valueScore = bestScore(valuePick) ?? 0;
      const ratio = (valueScore / valuePick.credits).toFixed(2);
      picks.push({
        kind: "best_value",
        ...COACH_PICK_META.best_value,
        playerId: valuePick.id,
        playerName: valuePick.name,
        teamAbbr: valuePick.teamAbbr,
        explanation: `${valuePick.credits} cr → ${valueScore.toFixed(1)} FPTS avg (${scoreLabel(valuePick)}) = ${ratio} pts/cr — best efficiency in this pool.`,
      });
    }
  }

  // ── 4. Sleeper Pick ─────────────────────────────────────────────────────────
  if (medianCredits > 0) {
    const sleeper = withScore
      .filter(
        (p) =>
          !used(p.id) &&
          p.credits > 0 &&
          p.credits < medianCredits * 0.75 &&
          (p.minutesTrend === "up" || p.formTrend === "Hot"),
      )
      .sort((a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0))[0];
    if (sleeper) {
      const sleeperScore = bestScore(sleeper)!;
      const creditGap = Math.round(medianCredits - sleeper.credits);
      const parts: string[] = [];
      if (sleeper.minutesTrend === "up") parts.push("minutes trending ↑");
      if (sleeper.formTrend === "Hot") parts.push("hot streak 🔥");
      picks.push({
        kind: "sleeper",
        ...COACH_PICK_META.sleeper,
        playerId: sleeper.id,
        playerName: sleeper.name,
        teamAbbr: sleeper.teamAbbr,
        explanation: `${sleeperScore.toFixed(1)} FPTS avg (${scoreLabel(sleeper)}) at ${sleeper.credits} cr${creditGap > 0 ? ` — ${creditGap} under pool median` : ""}. ${parts.join(", ")}. Strong tournament differentiator.`,
      });
    }
  }

  // ── 5. Fade Pick ────────────────────────────────────────────────────────────
  if (medianCredits > 0) {
    const fade = withScore
      .filter(
        (p) =>
          p.credits > medianCredits * 1.2 &&
          (p.minutesTrend === "down" || p.formTrend === "Cold"),
      )
      .sort((a, b) => b.credits - a.credits)[0];
    if (fade) {
      const reason =
        fade.minutesTrend === "down" && fade.formTrend === "Cold"
          ? "minutes and FPTS both declining"
          : fade.minutesTrend === "down"
          ? "minutes trending down recently"
          : "FPTS declining in recent games";
      picks.push({
        kind: "fade",
        ...COACH_PICK_META.fade,
        playerId: fade.id,
        playerName: fade.name,
        teamAbbr: fade.teamAbbr,
        explanation: `High credits but ${reason} — consider a cheaper alternative.`,
      });
    }
  }

  // ── 6. Trending Up ──────────────────────────────────────────────────────────
  const trendingUp = withScore
    .filter((p) => !used(p.id) && (p.minutesTrend === "up" || p.formTrend === "Hot"))
    .sort((a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0))[0];
  if (trendingUp) {
    const score = bestScore(trendingUp)!;
    picks.push({
      kind: "trending_up",
      ...COACH_PICK_META.trending_up,
      playerId: trendingUp.id,
      playerName: trendingUp.name,
      teamAbbr: trendingUp.teamAbbr,
      explanation: `${score.toFixed(1)} FPTS avg${trendingUp.minutesTrend === "up" ? " with rising minutes" : ""}${trendingUp.formTrend === "Hot" ? " — on a hot streak 🔥" : " — form building"}.`,
    });
  }

  // ── 7. Trending Down ────────────────────────────────────────────────────────
  const trendingDown = withScore
    .filter((p) => p.minutesTrend === "down" && p.formTrend === "Cold")
    .sort((a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0))[0];
  if (trendingDown) {
    const downScore = bestScore(trendingDown)!;
    picks.push({
      kind: "trending_down",
      ...COACH_PICK_META.trending_down,
      playerId: trendingDown.id,
      playerName: trendingDown.name,
      teamAbbr: trendingDown.teamAbbr,
      explanation: `${downScore.toFixed(1)} FPTS avg (${scoreLabel(trendingDown)}) but minutes falling and form cold — production likely to slide further.`,
    });
  }

  // ── 8. Safest Pick ──────────────────────────────────────────────────────────
  const safest = withScore
    .filter(
      (p) =>
        !used(p.id) &&
        p.consistency === "Consistent" &&
        !p.backToBack &&
        (p.status === "Confirmed Starter" || p.status === "Expected Starter"),
    )
    .sort((a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0))[0];
  if (safest) {
    const score = bestScore(safest)!;
    const safeStatusNote = safest.status === "Confirmed Starter" ? "confirmed starter" : "expected starter";
    picks.push({
      kind: "safest",
      ...COACH_PICK_META.safest,
      playerId: safest.id,
      playerName: safest.name,
      teamAbbr: safest.teamAbbr,
      explanation: `${score.toFixed(1)} FPTS avg (${scoreLabel(safest)}), ${safeStatusNote}, no B2B, consistent performer — lowest variance pick in this pool.`,
    });
  }

  // ── 9. Highest Ceiling ──────────────────────────────────────────────────────
  const ceilingPick = withScore
    .filter((p) => !used(p.id) && p.highFpts !== null)
    .sort((a, b) => (b.highFpts ?? 0) - (a.highFpts ?? 0))[0];
  if (ceilingPick && ceilingPick.highFpts !== null) {
    picks.push({
      kind: "highest_ceiling",
      ...COACH_PICK_META.highest_ceiling,
      playerId: ceilingPick.id,
      playerName: ceilingPick.name,
      teamAbbr: ceilingPick.teamAbbr,
      explanation: `${ceilingPick.highFpts.toFixed(1)} FPTS peak — highest upside in this pool for tournaments.`,
    });
  }

  // ── 10. Home Advantage ──────────────────────────────────────────────────────
  const homeTop = withScore
    .filter((p) => p.isHome)
    .sort((a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0))[0];
  if (homeTop) {
    const score = bestScore(homeTop)!;
    picks.push({
      kind: "home_advantage",
      ...COACH_PICK_META.home_advantage,
      playerId: homeTop.id,
      playerName: homeTop.name,
      teamAbbr: homeTop.teamAbbr,
      explanation: `Best performer on the home squad — ${homeTop.teamAbbr} has the home-court edge with ${score.toFixed(1)} FPTS avg.`,
    });
  }

  // ── 11. Back-to-back Fatigue Warning ────────────────────────────────────────
  const b2bPlayers = active.filter((p) => p.backToBack);
  if (b2bPlayers.length > 0) {
    // Highlight the highest-production B2B player — most likely to be picked.
    const b2bWarning = [...b2bPlayers]
      .sort((a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0))[0];
    const b2bTeams = [...new Set(b2bPlayers.map((p) => p.teamAbbr))].join(" & ");
    picks.push({
      kind: "back_to_back",
      ...COACH_PICK_META.back_to_back,
      playerId: b2bWarning.id,
      playerName: b2bWarning.name,
      teamAbbr: b2bWarning.teamAbbr,
      explanation: `${b2bTeams} playing on consecutive nights — starters often see reduced minutes in back-to-backs.`,
    });
  }

  // ── 12. Injury Impact ───────────────────────────────────────────────────────
  const injuryPlayers = players
    .filter(
      (p) =>
        (p.injuryStatus === "OUT" ||
          p.injuryStatus === "GTD" ||
          p.injuryStatus === "Questionable") &&
        (bestScore(p) ?? 0) > 12,
    )
    .sort((a, b) => (bestScore(b) ?? 0) - (bestScore(a) ?? 0));
  if (injuryPlayers.length > 0) {
    const impact = injuryPlayers[0];
    const score = bestScore(impact);
    picks.push({
      kind: "injury_impact",
      ...COACH_PICK_META.injury_impact,
      playerId: impact.id,
      playerName: impact.name,
      teamAbbr: impact.teamAbbr,
      explanation: `Listed ${impact.injuryStatus}${score ? ` — averaged ${score.toFixed(1)} FPTS when healthy` : ""}. Monitor lineup news close to tip-off.`,
    });
  }

  return picks;
}
