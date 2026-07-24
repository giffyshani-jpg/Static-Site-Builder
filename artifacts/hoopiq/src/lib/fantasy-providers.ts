// Multi-provider fantasy metadata fetcher.
//
// Attempts to pull player credits, roles, and ownership data from publicly
// accessible fantasy cricket platforms. Each provider is tried independently;
// failures are swallowed so the optimizer always loads even when all providers
// are down. The optimizer falls back to uniform credits if no metadata is found.
//
// Supported providers (in priority order):
//   1. FantasyWala   — fantasywala.com
//   2. Calc11        — calc11.com
//   3. DafaFantasy   — dafaplay.com

import type { CricketRole, PlayerFantasyMeta } from "./cricket-types";

// ─── Provider contract ─────────────────────────────────────────────────────

interface FantasyProviderResult {
  source: string;
  players: Record<string, PlayerFantasyMeta>; // keyed by player name (normalised)
}

// ─── Name normalisation ────────────────────────────────────────────────────

/** Lower-case, collapse whitespace, strip non-alpha to maximise fuzzy matching. */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Role parser ───────────────────────────────────────────────────────────

function parseRole(raw: string | null | undefined): CricketRole {
  if (!raw) return "all";
  const r = raw.toLowerCase();
  if (r.includes("wk") || r.includes("keeper") || r.includes("wicket")) return "wk";
  if (r.includes("bat")) return "bat";
  if (r.includes("bowl")) return "bowl";
  if (r.includes("all")) return "all";
  return "all";
}

// ─── FantasyWala provider ──────────────────────────────────────────────────
//
// FantasyWala exposes match-specific player recommendation pages.
// We attempt to scrape the JSON embedded in their page (Next.js __NEXT_DATA__
// or a data endpoint). If the shape changes the catch block handles it.

async function fetchFantasyWala(
  team1: string,
  team2: string
): Promise<FantasyProviderResult> {
  const source = "FantasyWala";
  try {
    // FantasyWala search endpoint — may return JSON with player credits
    const query = encodeURIComponent(`${team1} vs ${team2}`);
    const url = `https://www.fantasywala.com/api/match/search?q=${query}&format=json`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const players: Record<string, PlayerFantasyMeta> = {};

    const list: unknown[] = data?.players ?? data?.data?.players ?? [];
    for (const p of list) {
      if (typeof p !== "object" || p === null) continue;
      const record = p as Record<string, unknown>;
      const name = normaliseName(String(record.name ?? record.playerName ?? ""));
      if (!name) continue;
      players[name] = {
        source,
        credits: Number(record.credits ?? record.credit ?? null) || null,
        role: parseRole(record.role as string),
        isRecommended: Boolean(record.recommended ?? record.isCaptain),
        ownershipPct: Number(record.ownership ?? record.selectionPct ?? null) || null,
      };
    }
    return { source, players };
  } catch {
    return { source, players: {} };
  }
}

// ─── Calc11 provider ───────────────────────────────────────────────────────
//
// Calc11 is a fantasy cricket calculator that publishes player credits for
// all major platforms (Dream11, MyTeam11, etc.).

async function fetchCalc11(
  team1: string,
  team2: string
): Promise<FantasyProviderResult> {
  const source = "Calc11";
  try {
    const slug = [team1, team2]
      .map((t) => t.toLowerCase().replace(/\s+/g, "-"))
      .join("-vs-");

    // Calc11 embeds player data in a meta tag or JSON endpoint
    const url = `https://www.calc11.com/match/${slug}/players.json`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const players: Record<string, PlayerFantasyMeta> = {};

    const list: unknown[] = data?.players ?? data?.result ?? [];
    for (const p of list) {
      if (typeof p !== "object" || p === null) continue;
      const record = p as Record<string, unknown>;
      const name = normaliseName(String(record.name ?? record.player_name ?? ""));
      if (!name) continue;
      players[name] = {
        source,
        credits: Number(record.credits ?? record.credit_value ?? null) || null,
        role: parseRole(record.type as string ?? record.role as string),
        isRecommended: Boolean(record.recommended),
        ownershipPct: Number(record.selection_pct ?? null) || null,
      };
    }
    return { source, players };
  } catch {
    return { source, players: {} };
  }
}

// ─── DafaFantasy provider ──────────────────────────────────────────────────

async function fetchDafaFantasy(
  team1: string,
  team2: string
): Promise<FantasyProviderResult> {
  const source = "DafaFantasy";
  try {
    const query = encodeURIComponent(`${team1} vs ${team2}`);
    const url = `https://fantasy.dafaplay.com/api/v1/match/players?match=${query}`;

    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const players: Record<string, PlayerFantasyMeta> = {};

    const list: unknown[] = data?.players ?? data?.data ?? [];
    for (const p of list) {
      if (typeof p !== "object" || p === null) continue;
      const record = p as Record<string, unknown>;
      const name = normaliseName(String(record.playerName ?? record.name ?? ""));
      if (!name) continue;
      players[name] = {
        source,
        credits: Number(record.credits ?? record.price ?? null) || null,
        role: parseRole(record.playerType as string ?? record.role as string),
        isRecommended: Boolean(record.isPopular ?? record.recommended),
        ownershipPct: Number(record.ownershipPercentage ?? null) || null,
      };
    }
    return { source, players };
  } catch {
    return { source, players: {} };
  }
}

// ─── Merged result ─────────────────────────────────────────────────────────

export type MergedFantasyMeta = {
  /** Map from normalised player name → best available metadata. */
  players: Record<string, PlayerFantasyMeta>;
  /** Which providers returned at least one player record. */
  successfulProviders: string[];
  /** True if at least one provider succeeded. */
  hasData: boolean;
};

/**
 * Queries all providers in parallel and merges results.
 * First provider to return a record for a player wins (priority order:
 * FantasyWala → Calc11 → DafaFantasy).
 *
 * @param team1 - Full name or abbreviation of the home/team-1.
 * @param team2 - Full name or abbreviation of the away/team-2.
 */
export async function fetchFantasyMetadata(
  team1: string,
  team2: string
): Promise<MergedFantasyMeta> {
  const [fw, c11, dafa] = await Promise.allSettled([
    fetchFantasyWala(team1, team2),
    fetchCalc11(team1, team2),
    fetchDafaFantasy(team1, team2),
  ]);

  const results: FantasyProviderResult[] = [fw, c11, dafa]
    .filter((r): r is PromiseFulfilledResult<FantasyProviderResult> => r.status === "fulfilled")
    .map((r) => r.value);

  const merged: Record<string, PlayerFantasyMeta> = {};
  const successfulProviders: string[] = [];

  // Priority: first provider that has the player wins
  for (const result of results) {
    let hadData = false;
    for (const [name, meta] of Object.entries(result.players)) {
      if (!(name in merged)) {
        merged[name] = meta;
        hadData = true;
      }
    }
    if (hadData) successfulProviders.push(result.source);
  }

  return {
    players: merged,
    successfulProviders,
    hasData: Object.keys(merged).length > 0,
  };
}

/**
 * Looks up fantasy metadata for a single player by name.
 * Normalises the name for fuzzy matching (handles minor spelling differences).
 */
export function lookupPlayerMeta(
  name: string,
  meta: MergedFantasyMeta
): PlayerFantasyMeta | null {
  const key = normaliseName(name);

  // Exact match
  if (meta.players[key]) return meta.players[key];

  // Partial match — look for any key that contains the query name or vice versa
  for (const [k, v] of Object.entries(meta.players)) {
    if (k.includes(key) || key.includes(k)) return v;
  }

  return null;
}
