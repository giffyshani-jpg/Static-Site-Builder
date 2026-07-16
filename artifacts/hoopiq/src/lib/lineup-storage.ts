// Local persistence for the Fantasy Lineup system.
//
// Stores the complete lineup state per game: which 8 players are in the
// roster, who the Captain is (2× FPTS), and who the Vice Captain is
// (1.5× FPTS). All plain browser localStorage — no backend.
//
// Rules enforced at the UI layer (this file only persists/loads):
//   - Exactly LINEUP_SIZE (8) players in the roster.
//   - At most MAX_SAME_TEAM (5) players from the same team.
//   - Captain must be one of the 8 selected players.
//   - Vice Captain must be one of the 8 selected players, ≠ Captain.

export const LINEUP_SIZE = 8;
export const MAX_SAME_TEAM = 5;

export type LineupState = {
  /** Up to LINEUP_SIZE player IDs forming the lineup roster. */
  playerIds: string[];
  /** Player ID of the Captain (2× FPTS multiplier). null = not set. */
  captainId: string | null;
  /** Player ID of the Vice Captain (1.5× FPTS multiplier). null = not set. */
  viceCaptainId: string | null;
};

const LINEUP_PREFIX = "hoopiq:lineup:";

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function storageKey(gameId: string): string {
  return `${LINEUP_PREFIX}${gameId}`;
}

const EMPTY_LINEUP: LineupState = {
  playerIds: [],
  captainId: null,
  viceCaptainId: null,
};

export function getStoredLineup(gameId: string): LineupState {
  if (!hasStorage() || !gameId) return { ...EMPTY_LINEUP };
  try {
    const raw = window.localStorage.getItem(storageKey(gameId));
    if (!raw) return { ...EMPTY_LINEUP };
    const parsed = JSON.parse(raw);
    const playerIds: string[] = Array.isArray(parsed.playerIds)
      ? parsed.playerIds.filter((id: unknown) => typeof id === "string")
      : [];
    const captainId =
      typeof parsed.captainId === "string" && playerIds.includes(parsed.captainId)
        ? parsed.captainId
        : null;
    const viceCaptainId =
      typeof parsed.viceCaptainId === "string" &&
      playerIds.includes(parsed.viceCaptainId) &&
      parsed.viceCaptainId !== captainId
        ? parsed.viceCaptainId
        : null;
    return { playerIds, captainId, viceCaptainId };
  } catch {
    return { ...EMPTY_LINEUP };
  }
}

export function setStoredLineup(gameId: string, state: LineupState): void {
  if (!hasStorage() || !gameId) return;
  window.localStorage.setItem(storageKey(gameId), JSON.stringify(state));
}

// ── Validation ────────────────────────────────────────────────────────────────

export type ValidationError =
  | { kind: "size"; current: number }
  | { kind: "team_limit"; teamAbbreviation: string; count: number }
  | { kind: "no_captain" }
  | { kind: "no_vice_captain" };

export function validateLineup(
  state: LineupState,
  teamByPlayerId: Record<string, string>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (state.playerIds.length !== LINEUP_SIZE) {
    errors.push({ kind: "size", current: state.playerIds.length });
  }

  // Count per team abbreviation.
  const teamCounts: Record<string, number> = {};
  for (const id of state.playerIds) {
    const abbr = teamByPlayerId[id] ?? "Unknown";
    teamCounts[abbr] = (teamCounts[abbr] ?? 0) + 1;
  }
  for (const [abbr, count] of Object.entries(teamCounts)) {
    if (count > MAX_SAME_TEAM) {
      errors.push({ kind: "team_limit", teamAbbreviation: abbr, count });
    }
  }

  if (!state.captainId || !state.playerIds.includes(state.captainId)) {
    errors.push({ kind: "no_captain" });
  }
  if (
    !state.viceCaptainId ||
    !state.playerIds.includes(state.viceCaptainId) ||
    state.viceCaptainId === state.captainId
  ) {
    errors.push({ kind: "no_vice_captain" });
  }

  return errors;
}

// ── FPTS multipliers ──────────────────────────────────────────────────────────

export type PlayerRole = "captain" | "vice_captain" | "normal";

export function getPlayerRole(playerId: string, state: LineupState): PlayerRole {
  if (playerId === state.captainId) return "captain";
  if (playerId === state.viceCaptainId) return "vice_captain";
  return "normal";
}

export function fptsMultiplier(role: PlayerRole): number {
  if (role === "captain") return 2;
  if (role === "vice_captain") return 1.5;
  return 1;
}

// ── Saved Lineups ─────────────────────────────────────────────────────────────
//
// Multiple named lineup snapshots can be saved per game, stored as a JSON
// array under "hoopiq:saved-lineups:{gameId}". Each entry is fully
// self-contained (deep snapshot of LineupState) so loading never depends on
// the player list being in a particular order.

export type SavedLineup = {
  /** Unique identifier for this saved entry. */
  id: string;
  /** User-given name. Unique (case-insensitive) within the same game. */
  name: string;
  /** Unix timestamp (ms) when the lineup was saved. */
  savedAt: number;
  /** Full snapshot of the lineup at save time. */
  lineup: LineupState;
};

const SAVED_LINEUPS_PREFIX = "hoopiq:saved-lineups:";

function savedLineupsKey(gameId: string): string {
  return `${SAVED_LINEUPS_PREFIX}${gameId}`;
}

function parseSavedLineups(raw: string): SavedLineup[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedLineup =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.savedAt === "number" &&
        typeof item.lineup === "object" &&
        item.lineup !== null,
    );
  } catch {
    return [];
  }
}

function writeSavedLineups(gameId: string, lineups: SavedLineup[]): void {
  if (!hasStorage() || !gameId) return;
  window.localStorage.setItem(savedLineupsKey(gameId), JSON.stringify(lineups));
}

/** Return all saved lineups for a game, sorted newest-first. */
export function getSavedLineups(gameId: string): SavedLineup[] {
  if (!hasStorage() || !gameId) return [];
  const raw = window.localStorage.getItem(savedLineupsKey(gameId));
  if (!raw) return [];
  return parseSavedLineups(raw).sort((a, b) => b.savedAt - a.savedAt);
}

/** Save the current lineup under the given name. */
export function saveLineup(
  gameId: string,
  name: string,
  lineup: LineupState,
): { saved: SavedLineup } | { error: "empty_name" | "duplicate" } {
  const trimmed = name.trim();
  if (!trimmed) return { error: "empty_name" };
  const existing = getSavedLineups(gameId);
  if (existing.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "duplicate" };
  }
  const entry: SavedLineup = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: trimmed,
    savedAt: Date.now(),
    lineup: {
      playerIds: [...lineup.playerIds],
      captainId: lineup.captainId,
      viceCaptainId: lineup.viceCaptainId,
    },
  };
  writeSavedLineups(gameId, [entry, ...existing]);
  return { saved: entry };
}

/** Permanently remove a saved lineup by id. */
export function deleteSavedLineup(gameId: string, id: string): void {
  const existing = getSavedLineups(gameId);
  writeSavedLineups(gameId, existing.filter((s) => s.id !== id));
}

/** Rename a saved lineup. Returns an error when the new name is already taken. */
export function renameSavedLineup(
  gameId: string,
  id: string,
  newName: string,
): { ok: true } | { error: "empty_name" | "duplicate" } {
  const trimmed = newName.trim();
  if (!trimmed) return { error: "empty_name" };
  const existing = getSavedLineups(gameId);
  if (existing.some((s) => s.id !== id && s.name.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "duplicate" };
  }
  writeSavedLineups(
    gameId,
    existing.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
  );
  return { ok: true };
}
