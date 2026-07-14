// Small, additive "remember my choices" helpers, all plain localStorage
// like every other persistence file in this app. Kept separate from
// favorites/comparison/fantasy-storage since these are page UI prefs
// rather than user data.

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readJson<T extends object>(key: string, fallback: T): T {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

// --- Last selected game (global, used for a "continue" shortcut) ---

export type LastGameRef = { league: "nba" | "wnba"; gameId: string };

const LAST_GAME_KEY = "hoopiq:last-game";

export function getLastGame(): LastGameRef | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LAST_GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.gameId === "string" && (parsed.league === "nba" || parsed.league === "wnba")) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setLastGame(ref: LastGameRef): void {
  writeJson(LAST_GAME_KEY, ref);
}

// --- Fantasy Optimizer prefs (global: this page always shows one game
// at a time, so sort/filter choices are remembered across games) ---

export type TeamFilter = "all" | "home" | "away";

export type OptimizerPrefs = {
  sortKey: string;
  /** "desc" = highest values first (default); "asc" = lowest first. */
  sortDir: "asc" | "desc";
  teamFilter: TeamFilter;
  position: string; // "all" or a specific position abbreviation
  favoritesOnly: boolean;
  /**
   * When true, players who already appear in another saved lineup for this
   * game sort after unused players (they remain fully visible/selectable —
   * never hidden or disabled). Opt-in; defaults to false.
   */
  avoidUsedPlayers: boolean;
};

const OPTIMIZER_PREFS_KEY = "hoopiq:optimizer-prefs";

const DEFAULT_OPTIMIZER_PREFS: OptimizerPrefs = {
  sortKey: "fpts",
  sortDir: "desc",
  teamFilter: "all",
  position: "all",
  favoritesOnly: false,
  avoidUsedPlayers: false,
};

export function getOptimizerPrefs(): OptimizerPrefs {
  return readJson(OPTIMIZER_PREFS_KEY, DEFAULT_OPTIMIZER_PREFS);
}

export function setOptimizerPrefs(prefs: OptimizerPrefs): void {
  writeJson(OPTIMIZER_PREFS_KEY, prefs);
}

// --- Box Score prefs (scoped per game, like comparison selections —
// tab/filters only make sense within the game they were chosen for) ---

export type BoxScoreTab = "away" | "home" | "all";

export type BoxScorePrefs = {
  tab: BoxScoreTab;
  position: string;
  favoritesOnly: boolean;
};

const BOX_SCORE_PREFS_PREFIX = "hoopiq:boxscore-prefs:";

const DEFAULT_BOX_SCORE_PREFS: BoxScorePrefs = {
  tab: "away",
  position: "all",
  favoritesOnly: false,
};

export function getBoxScorePrefs(gameId: string | undefined): BoxScorePrefs {
  if (!gameId) return DEFAULT_BOX_SCORE_PREFS;
  return readJson(`${BOX_SCORE_PREFS_PREFIX}${gameId}`, DEFAULT_BOX_SCORE_PREFS);
}

export function setBoxScorePrefs(gameId: string | undefined, prefs: BoxScorePrefs): void {
  if (!gameId) return;
  writeJson(`${BOX_SCORE_PREFS_PREFIX}${gameId}`, prefs);
}
