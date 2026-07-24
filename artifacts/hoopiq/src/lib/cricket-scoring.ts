// Cricket Fantasy Scoring Rule Engine.
//
// Rules are DATA — adding or tweaking a scoring profile never requires touching
// the calculation logic. To support a new format, define a new ScoringProfile
// and register it in SCORING_PROFILES.
//
// Usage:
//   const profile = getScoringProfile("T20");
//   const pts = calculateCricketFantasyPoints(player, profile);

import { CricketPlayer, CricketPlayerStats, MatchFormat } from "./cricket-types";

// ─── Scoring profile type ──────────────────────────────────────────────────

export type ScoringTier = {
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound (use Infinity for "and above"). */
  max: number;
  points: number;
};

export type BattingRules = {
  perRun: number;
  perFour: number;
  perSix: number;
  duck: number;
  milestone25: number;
  milestone50: number;
  milestone75: number;
  milestone100: number;
};

export type BowlingRules = {
  perWicket: number;
  lbwBowledBonus: number;
  threeWicketBonus: number;
  fourWicketBonus: number;
  fiveWicketBonus: number;
  perMaiden: number;
};

export type FieldingRules = {
  perCatch: number;
  threeCatchBonus: number;
  perStumping: number;
  perRunOutDirect: number;
  perRunOutIndirect: number;
};

export type StrikeRateRules = {
  enabled: boolean;
  /** Minimum balls faced before SR bonus/penalty applies. */
  minBalls: number;
  tiers: ScoringTier[];
};

export type EconomyRules = {
  enabled: boolean;
  /** Minimum full overs bowled before economy bonus/penalty applies. */
  minOvers: number;
  tiers: ScoringTier[];
};

export type ScoringProfile = {
  name: string;
  format: MatchFormat;
  batting: BattingRules;
  bowling: BowlingRules;
  fielding: FieldingRules;
  strikeRate: StrikeRateRules;
  economy: EconomyRules;
};

// ─── Built-in profiles ─────────────────────────────────────────────────────

const STANDARD_STRIKE_RATE_TIERS: ScoringTier[] = [
  { min: 170,    max: Infinity, points:  6 },
  { min: 150.01, max: 170,     points:  4 },
  { min: 130,    max: 150.01,  points:  2 },
  { min: 70.01,  max: 130,     points:  0 },
  { min: 60,     max: 70.01,   points: -2 },
  { min: 50,     max: 60,      points: -4 },
  { min: 0,      max: 50,      points: -6 },
];

const STANDARD_ECONOMY_TIERS: ScoringTier[] = [
  { min: 0,     max: 5,     points:  6 },
  { min: 5,     max: 6,     points:  4 },
  { min: 6,     max: 7.01,  points:  2 },
  { min: 7.01,  max: 10,    points:  0 },
  { min: 10,    max: 11.01, points: -2 },
  { min: 11.01, max: 12.01, points: -4 },
  { min: 12.01, max: Infinity, points: -6 },
];

export const T20_PROFILE: ScoringProfile = {
  name: "T20",
  format: "T20",
  batting: {
    perRun: 1,
    perFour: 4,
    perSix: 6,
    duck: -2,
    milestone25: 4,
    milestone50: 8,
    milestone75: 12,
    milestone100: 16,
  },
  bowling: {
    perWicket: 30,
    lbwBowledBonus: 8,
    threeWicketBonus: 4,
    fourWicketBonus: 8,
    fiveWicketBonus: 12,
    perMaiden: 4,
  },
  fielding: {
    perCatch: 8,
    threeCatchBonus: 4,
    perStumping: 12,
    perRunOutDirect: 12,
    perRunOutIndirect: 6,
  },
  strikeRate: {
    enabled: true,
    minBalls: 10,
    tiers: STANDARD_STRIKE_RATE_TIERS,
  },
  economy: {
    enabled: true,
    minOvers: 2,
    tiers: STANDARD_ECONOMY_TIERS,
  },
};

export const ODI_PROFILE: ScoringProfile = {
  name: "ODI",
  format: "ODI",
  batting: {
    perRun: 1,
    perFour: 4,
    perSix: 6,
    duck: -3,
    milestone25: 0,
    milestone50: 8,
    milestone75: 0,
    milestone100: 16,
  },
  bowling: {
    perWicket: 25,
    lbwBowledBonus: 8,
    threeWicketBonus: 4,
    fourWicketBonus: 8,
    fiveWicketBonus: 12,
    perMaiden: 4,
  },
  fielding: {
    perCatch: 8,
    threeCatchBonus: 4,
    perStumping: 12,
    perRunOutDirect: 12,
    perRunOutIndirect: 6,
  },
  strikeRate: {
    enabled: true,
    minBalls: 20,
    tiers: [
      { min: 140,   max: Infinity, points:  6 },
      { min: 120,   max: 140,     points:  4 },
      { min: 100,   max: 120,     points:  2 },
      { min: 50,    max: 100,     points:  0 },
      { min: 40,    max: 50,      points: -2 },
      { min: 30,    max: 40,      points: -4 },
      { min: 0,     max: 30,      points: -6 },
    ],
  },
  economy: {
    enabled: true,
    minOvers: 5,
    tiers: [
      { min: 0,    max: 4,     points:  6 },
      { min: 4,    max: 5,     points:  4 },
      { min: 5,    max: 6,     points:  2 },
      { min: 6,    max: 7,     points:  0 },
      { min: 7,    max: 9,     points: -2 },
      { min: 9,    max: 10,    points: -4 },
      { min: 10,   max: Infinity, points: -6 },
    ],
  },
};

export const TEST_PROFILE: ScoringProfile = {
  name: "Test",
  format: "Test",
  batting: {
    perRun: 1,
    perFour: 1,
    perSix: 2,
    duck: -4,
    milestone25: 0,
    milestone50: 4,
    milestone75: 0,
    milestone100: 16,
  },
  bowling: {
    perWicket: 16,
    lbwBowledBonus: 8,
    threeWicketBonus: 4,
    fourWicketBonus: 8,
    fiveWicketBonus: 16,
    perMaiden: 1,
  },
  fielding: {
    perCatch: 8,
    threeCatchBonus: 4,
    perStumping: 12,
    perRunOutDirect: 12,
    perRunOutIndirect: 6,
  },
  // No SR/Economy in Test cricket
  strikeRate: {
    enabled: false,
    minBalls: 0,
    tiers: [],
  },
  economy: {
    enabled: false,
    minOvers: 0,
    tiers: [],
  },
};

/**
 * The Hundred scoring profile — same as T20 base but NO Strike Rate bonuses
 * and NO Economy Rate bonuses (per format rules).
 */
export const THE_HUNDRED_PROFILE: ScoringProfile = {
  name: "The Hundred",
  format: "The Hundred",
  batting: {
    ...T20_PROFILE.batting,
  },
  bowling: {
    ...T20_PROFILE.bowling,
  },
  fielding: {
    ...T20_PROFILE.fielding,
  },
  // Disabled per format specification
  strikeRate: {
    enabled: false,
    minBalls: 0,
    tiers: [],
  },
  economy: {
    enabled: false,
    minOvers: 0,
    tiers: [],
  },
};

export const T10_PROFILE: ScoringProfile = {
  name: "T10",
  format: "T10",
  batting: {
    perRun: 1,
    perFour: 4,
    perSix: 6,
    duck: -2,
    milestone25: 8,
    milestone50: 16,
    milestone75: 0,
    milestone100: 0,
  },
  bowling: {
    perWicket: 30,
    lbwBowledBonus: 8,
    threeWicketBonus: 4,
    fourWicketBonus: 8,
    fiveWicketBonus: 12,
    perMaiden: 4,
  },
  fielding: {
    perCatch: 8,
    threeCatchBonus: 4,
    perStumping: 12,
    perRunOutDirect: 12,
    perRunOutIndirect: 6,
  },
  strikeRate: {
    enabled: true,
    minBalls: 5,
    tiers: STANDARD_STRIKE_RATE_TIERS,
  },
  economy: {
    enabled: true,
    minOvers: 1,
    tiers: STANDARD_ECONOMY_TIERS,
  },
};

/** Registry of all profiles. Extend here to add new formats. */
export const SCORING_PROFILES: Record<string, ScoringProfile> = {
  T20:          T20_PROFILE,
  ODI:          ODI_PROFILE,
  Test:         TEST_PROFILE,
  "The Hundred": THE_HUNDRED_PROFILE,
  T10:          T10_PROFILE,
};

// ─── Profile resolver ──────────────────────────────────────────────────────

/**
 * Returns the scoring profile for a given match format string.
 * Falls back to T20 if the format is unrecognised.
 * The hundred has special logic: if the competition name mentions "hundred",
 * return the The Hundred profile.
 */
export function getScoringProfile(
  format: MatchFormat | string | null | undefined,
  competitionName?: string
): ScoringProfile {
  if (competitionName && /hundred/i.test(competitionName)) {
    return THE_HUNDRED_PROFILE;
  }
  if (!format) return T20_PROFILE;
  return SCORING_PROFILES[format] ?? T20_PROFILE;
}

// ─── Tier resolver ─────────────────────────────────────────────────────────

function applyTier(value: number, tiers: ScoringTier[]): number {
  for (const tier of tiers) {
    if (value >= tier.min && value < tier.max) return tier.points;
  }
  return 0;
}

// ─── Calculation ───────────────────────────────────────────────────────────

export type FantasyPointsBreakdown = {
  batting: number;
  bowling: number;
  fielding: number;
  strikeRateBonus: number;
  economyBonus: number;
  total: number;
};

/**
 * Calculates cricket fantasy points for a single player's match stats.
 *
 * @param stats  - The player's CricketPlayerStats for this match.
 * @param profile - The scoring profile to apply.
 * @returns      - A full breakdown + total.
 */
export function calculateCricketFantasyPoints(
  stats: CricketPlayerStats,
  profile: ScoringProfile
): FantasyPointsBreakdown {
  const b = profile.batting;
  const bw = profile.bowling;
  const f = profile.fielding;

  // ── Batting ──────────────────────────────────────────────────────────────
  let batting = 0;
  const bat = stats.batting;
  if (bat) {
    batting += bat.runs * b.perRun;
    batting += bat.fours * b.perFour;
    batting += bat.sixes * b.perSix;

    // Milestones are cumulative bonuses — crossing 50 also earns the 25 bonus etc.
    if (bat.runs >= 25)  batting += b.milestone25;
    if (bat.runs >= 50)  batting += b.milestone50;
    if (bat.runs >= 75)  batting += b.milestone75;
    if (bat.runs >= 100) batting += b.milestone100;

    // Duck: dismissed for 0
    if (bat.runs === 0 && bat.dismissed) batting += b.duck;
  }

  // ── Bowling ──────────────────────────────────────────────────────────────
  let bowling = 0;
  const bowl = stats.bowling;
  if (bowl) {
    bowling += bowl.wickets * bw.perWicket;
    bowling += (bowl.lbwBowledWickets ?? 0) * bw.lbwBowledBonus;
    bowling += bowl.maidens * bw.perMaiden;

    // Haul bonuses are cumulative: 5 wickets gets all three bonuses
    if (bowl.wickets >= 3) bowling += bw.threeWicketBonus;
    if (bowl.wickets >= 4) bowling += bw.fourWicketBonus;
    if (bowl.wickets >= 5) bowling += bw.fiveWicketBonus;
  }

  // ── Fielding ─────────────────────────────────────────────────────────────
  let fielding = 0;
  const field = stats.fielding;
  if (field) {
    fielding += field.catches * f.perCatch;
    if (field.catches >= 3) fielding += f.threeCatchBonus;
    fielding += field.stumpings * f.perStumping;
    fielding += field.runOutsDirect * f.perRunOutDirect;
    fielding += field.runOutsIndirect * f.perRunOutIndirect;
  }

  // ── Strike Rate bonus ─────────────────────────────────────────────────────
  let strikeRateBonus = 0;
  const sr = profile.strikeRate;
  if (sr.enabled && bat && bat.balls >= sr.minBalls && bat.balls > 0) {
    const rate = (bat.runs / bat.balls) * 100;
    strikeRateBonus = applyTier(rate, sr.tiers);
  }

  // ── Economy bonus ─────────────────────────────────────────────────────────
  let economyBonus = 0;
  const ec = profile.economy;
  if (ec.enabled && bowl) {
    const totalOversDecimal = bowl.overs + bowl.extraBalls / 6;
    if (totalOversDecimal >= ec.minOvers && totalOversDecimal > 0) {
      const rate = bowl.runsConceded / totalOversDecimal;
      economyBonus = applyTier(rate, ec.tiers);
    }
  }

  const total = batting + bowling + fielding + strikeRateBonus + economyBonus;
  return { batting, bowling, fielding, strikeRateBonus, economyBonus, total };
}

// ─── Convenience wrapper that includes captain/VC multipliers ─────────────

export type LineupRole = "captain" | "vice-captain" | "player";

export function calculateLineupPoints(
  stats: CricketPlayerStats,
  profile: ScoringProfile,
  role: LineupRole
): { breakdown: FantasyPointsBreakdown; multiplier: number; final: number } {
  const breakdown = calculateCricketFantasyPoints(stats, profile);
  const multiplier = role === "captain" ? 2 : role === "vice-captain" ? 1.5 : 1;
  return {
    breakdown,
    multiplier,
    final: Math.round(breakdown.total * multiplier * 100) / 100,
  };
}
