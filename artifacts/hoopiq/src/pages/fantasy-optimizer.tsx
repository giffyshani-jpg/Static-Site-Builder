import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { CompareBar } from "../components/compare-bar";
import { StarButton } from "../components/star-button";
import { PlayerStatusBadges } from "../components/player-status-badges";
import { RecentFormBadge } from "../components/recent-form-badge";
import { PlayerDetailSheet } from "../components/player-detail-sheet";
import { fetchGameById } from "../api";
import { calculateFantasyPoints } from "../lib/stats";
import {
  DEFAULT_FANTASY_BUDGET,
  clearStoredPlayerCredits,
  getStoredBudget,
  getStoredPlayerCredits,
  setStoredBudget,
  setStoredPlayerCredits,
} from "../lib/fantasy-storage";
import {
  LINEUP_SIZE,
  MAX_SAME_TEAM,
  LineupState,
  PlayerRole,
  SavedLineup,
  ValidationError,
  deleteSavedLineup,
  fptsMultiplier,
  getPlayerRole,
  getSavedLineups,
  getStoredLineup,
  renameSavedLineup,
  saveLineup,
  setStoredLineup,
  validateLineup,
} from "../lib/lineup-storage";
import { useComparisonSelection } from "../hooks/use-comparison-selection";
import { useFavorites } from "../hooks/use-favorites";
import { useRecentForm } from "../hooks/use-recent-form";
import { TeamFilter, getOptimizerPrefs, setOptimizerPrefs } from "../lib/preferences";
import { exportOptimizerSelectionAsText } from "../lib/export";
import { Game, Player } from "../lib/types";
import {
  OcrMatchResult,
  extractLinesFromImage,
  matchOcrLinesToPlayers,
} from "../lib/ocr-import";
import type { OcrProgress } from "../lib/ocr-import";
import { minutesValue, playerSortTier } from "../lib/player-status";
import { computeSavedLineupLiveStats } from "../lib/lineup-live";

// ── Types ─────────────────────────────────────────────────────────────────────

type SortKey = "fpts" | "points" | "rebounds" | "assists" | "credits" | "minutes";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "fpts", label: "Fantasy Points" },
  { value: "points", label: "Points" },
  { value: "rebounds", label: "Rebounds" },
  { value: "assists", label: "Assists" },
  { value: "credits", label: "Credits" },
  { value: "minutes", label: "Minutes" },
];

type OptimizerPlayer = Player & {
  teamAbbreviation: string;
  isHome: boolean;
  /** Base FPTS before role multiplier. */
  baseFpts: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleBadgeClasses(role: PlayerRole): string {
  if (role === "captain") return "bg-yellow-500 text-yellow-950 border-yellow-400";
  if (role === "vice_captain") return "bg-sky-500 text-sky-950 border-sky-400";
  return "border-border text-muted-foreground hover:bg-muted/40";
}

function roleLabel(role: PlayerRole): string {
  if (role === "captain") return "C";
  if (role === "vice_captain") return "VC";
  return "";
}

function validationMessage(err: ValidationError): string {
  switch (err.kind) {
    case "size":
      return `Select exactly ${LINEUP_SIZE} players (${err.current} selected)`;
    case "team_limit":
      return `Max ${MAX_SAME_TEAM} from same team (${err.count} from ${err.teamAbbreviation})`;
    case "no_captain":
      return "Assign a Captain (C) from your lineup";
    case "no_vice_captain":
      return "Assign a Vice Captain (VC) from your lineup";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FantasyOptimizer() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as import("../lib/types").LeagueKey;

  const [game, setGame] = useState<Game | null | undefined>(null);
  const [budget, setBudget] = useState<number>(DEFAULT_FANTASY_BUDGET);
  const [credits, setCredits] = useState<Record<string, number | undefined>>({});

  // Lineup state: which 8 players, who is C, who is VC.
  const [lineup, setLineup] = useState<LineupState>({
    playerIds: [],
    captainId: null,
    viceCaptainId: null,
  });

  // ── Saved lineups state ──────────────────────────────────────────────────
  const [savedLineups, setSavedLineups] = useState<SavedLineup[]>([]);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [saveNameError, setSaveNameError] = useState<"empty_name" | "duplicate" | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renameError, setRenameError] = useState<"empty_name" | "duplicate" | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fpts");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [avoidUsedPlayers, setAvoidUsedPlayers] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // ── Live update state ──────────────────────────────────────────────────
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ── OCR import state ───────────────────────────────────────────────────
  const [ocrExpanded, setOcrExpanded] = useState(false);
  const [ocrPhase, setOcrPhase] = useState<OcrProgress["phase"] | "idle" | "error">("idle");
  const [ocrPct, setOcrPct] = useState(0);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResults, setOcrResults] = useState<OcrMatchResult[] | null>(null);
  /** Per-result manual overrides: result index → player id */
  const [ocrManual, setOcrManual] = useState<Record<number, string>>({});
  const ocrFileRef = useRef<HTMLInputElement>(null);
  const [detailPlayer, setDetailPlayer] = useState<OptimizerPlayer | null>(null);

  const comparison = useComparisonSelection(gameId);
  const favorites = useFavorites();
  const recentForm = useRecentForm();

  // ── Restore preferences ──────────────────────────────────────────────────

  useEffect(() => {
    const prefs = getOptimizerPrefs();
    setSortKey(prefs.sortKey as SortKey);
    setSortDir(prefs.sortDir ?? "desc");
    setTeamFilter(prefs.teamFilter);
    setPositionFilter(prefs.position);
    setFavoritesOnly(prefs.favoritesOnly);
    setAvoidUsedPlayers(prefs.avoidUsedPlayers ?? false);
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    setOptimizerPrefs({
      sortKey,
      sortDir,
      teamFilter,
      position: positionFilter,
      favoritesOnly,
      avoidUsedPlayers,
    });
  }, [prefsLoaded, sortKey, sortDir, teamFilter, positionFilter, favoritesOnly, avoidUsedPlayers]);

  useEffect(() => {
    setBudget(getStoredBudget());
  }, []);

  // ── Load game + restore lineup ───────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    setLineup({ playerIds: [], captainId: null, viceCaptainId: null });

    fetchGameById(gameId || "", league).then((data) => {
      if (cancelled) return;
      const loadedGame = (data as Game | undefined) ?? undefined;
      setGame(loadedGame ?? undefined);

      if (loadedGame) {
        const allPlayers = [...loadedGame.awayTeam.players, ...loadedGame.homeTeam.players];

        // Restore per-player credit costs.
        const initialCredits: Record<string, number | undefined> = {};
        for (const player of allPlayers) {
          initialCredits[player.id] = getStoredPlayerCredits(player.id);
        }
        setCredits(initialCredits);
        setLastUpdated(new Date());

        // Record recent form for all players.
        if (gameId) {
          recentForm.recordGame(
            allPlayers.map((p) => ({ id: p.id, fpts: calculateFantasyPoints(p.stats) })),
            gameId,
            Date.now(),
          );
        }

        // Restore saved lineup, validating IDs against the actual roster.
        if (gameId) {
          const saved = getStoredLineup(gameId);
          const validIds = new Set(allPlayers.map((p) => p.id));
          const restoredIds = saved.playerIds.filter((id) => validIds.has(id));
          const restoredCaptain =
            saved.captainId && restoredIds.includes(saved.captainId) ? saved.captainId : null;
          const restoredVC =
            saved.viceCaptainId &&
            restoredIds.includes(saved.viceCaptainId) &&
            saved.viceCaptainId !== restoredCaptain
              ? saved.viceCaptainId
              : null;
          setLineup({ playerIds: restoredIds, captainId: restoredCaptain, viceCaptainId: restoredVC });

          // Load the list of saved lineups for this game.
          setSavedLineups(getSavedLineups(gameId));
        }
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, league]);

  // ── Live polling (5 s while game is in_progress) ──────────────────────────
  // Only updates game data — never touches lineup, filter, or sort state.
  useEffect(() => {
    if (!game || game.status !== "in_progress" || !gameId) return;
    let cancelled = false;
    const id = setInterval(async () => {
      const data = await fetchGameById(gameId, league);
      if (cancelled) return;
      const loaded = (data as Game | undefined) ?? undefined;
      if (loaded) {
        setGame(loaded);
        setLastUpdated(new Date());
      }
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [game?.status, gameId, league]);

  // ── Derived player list ──────────────────────────────────────────────────

  const players: OptimizerPlayer[] = useMemo(() => {
    if (!game) return [];
    const away = game.awayTeam.players.map((p) => ({
      ...p,
      teamAbbreviation: game.awayTeam.abbreviation,
      isHome: false,
      baseFpts: calculateFantasyPoints(p.stats),
    }));
    const home = game.homeTeam.players.map((p) => ({
      ...p,
      teamAbbreviation: game.homeTeam.abbreviation,
      isHome: true,
      baseFpts: calculateFantasyPoints(p.stats),
    }));
    return [...away, ...home];
  }, [game]);

  /** Map from player id → team abbreviation used by validation. */
  const teamByPlayerId = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of players) map[p.id] = p.teamAbbreviation;
    return map;
  }, [players]);

  const availablePositions = useMemo(
    () => Array.from(new Set(players.map((p) => p.position).filter(Boolean))).sort(),
    [players],
  );

  /** Union of player ids that appear in any *other* saved lineup for this game. */
  const usedInSavedLineups = useMemo(() => {
    const set = new Set<string>();
    for (const saved of savedLineups) {
      for (const id of saved.lineup.playerIds) set.add(id);
    }
    return set;
  }, [savedLineups]);

  /** Players visible in the scrollable list after all search/filter/sort. */
  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    let filtered = query ? players.filter((p) => p.name.toLowerCase().includes(query)) : players;

    if (teamFilter !== "all") {
      filtered = filtered.filter((p) => (teamFilter === "home" ? p.isHome : !p.isHome));
    }
    if (positionFilter !== "all") {
      filtered = filtered.filter((p) => p.position === positionFilter);
    }
    if (favoritesOnly) {
      filtered = filtered.filter((p) => favorites.isFavorite(p.id));
    }

    const withCredits = filtered.map((p) => ({ ...p, credits: credits[p.id] ?? 0 }));

    // sortDir "desc" = highest first (default); "asc" = lowest first.
    const desc = sortDir === "desc";
    const sorted = [...withCredits].sort((a, b) => {
      let diff: number;
      switch (sortKey) {
        case "points":   diff = a.stats.points   - b.stats.points;   break;
        case "rebounds": diff = a.stats.rebounds - b.stats.rebounds; break;
        case "assists":  diff = a.stats.assists  - b.stats.assists;  break;
        case "credits":  diff = a.credits        - b.credits;        break;
        case "minutes":  diff = minutesValue(a.stats) - minutesValue(b.stats); break;
        case "fpts":
        default:         diff = a.baseFpts - b.baseFpts; break;
      }
      return desc ? -diff : diff;
    });

    // Favorites bubble to the top on top of whatever sort is active.
    sorted.sort((a, b) => {
      const aFav = favorites.isFavorite(a.id) ? 1 : 0;
      const bFav = favorites.isFavorite(b.id) ? 1 : 0;
      return bFav - aFav;
    });

    // Opt-in: players already used in another saved lineup sort after
    // unused ones, but stay fully visible/selectable — never hidden.
    if (avoidUsedPlayers) {
      sorted.sort((a, b) => {
        const aUsed = !lineup.playerIds.includes(a.id) && usedInSavedLineups.has(a.id) ? 1 : 0;
        const bUsed = !lineup.playerIds.includes(b.id) && usedInSavedLineups.has(b.id) ? 1 : 0;
        return aUsed - bUsed;
      });
    }

    // Final, most significant grouping: selected players always first,
    // remaining active players next, OUT/DNP/Inactive/Not-in-lineup last —
    // regardless of the sort/filter above (which still applies within each
    // group, since all the sorts above are stable).
    sorted.sort((a, b) => {
      const aTier = playerSortTier(a, game?.status ?? "scheduled", lineup.playerIds.includes(a.id));
      const bTier = playerSortTier(b, game?.status ?? "scheduled", lineup.playerIds.includes(b.id));
      return aTier - bTier;
    });

    return sorted;
  }, [
    players,
    credits,
    search,
    sortKey,
    sortDir,
    teamFilter,
    positionFilter,
    favorites,
    favoritesOnly,
    avoidUsedPlayers,
    usedInSavedLineups,
    lineup.playerIds,
    game?.status,
  ]);

  // ── Lineup helpers ───────────────────────────────────────────────────────

  /** Persist lineup state to localStorage and update React state together. */
  function applyLineup(next: LineupState) {
    setLineup(next);
    if (gameId) setStoredLineup(gameId, next);
  }

  function togglePlayer(playerId: string) {
    const isIn = lineup.playerIds.includes(playerId);
    if (isIn) {
      // Remove from lineup; also clear C/VC if this player held a role.
      applyLineup({
        playerIds: lineup.playerIds.filter((id) => id !== playerId),
        captainId: lineup.captainId === playerId ? null : lineup.captainId,
        viceCaptainId: lineup.viceCaptainId === playerId ? null : lineup.viceCaptainId,
      });
    } else {
      // Hard cap: refuse to add a 9th player.
      if (lineup.playerIds.length >= LINEUP_SIZE) return;
      applyLineup({ ...lineup, playerIds: [...lineup.playerIds, playerId] });
    }
  }

  function assignCaptain(playerId: string) {
    // Clicking C on the current captain deselects it.
    if (lineup.captainId === playerId) {
      applyLineup({ ...lineup, captainId: null });
      return;
    }
    // If this player was VC, clear that first.
    const nextVC = lineup.viceCaptainId === playerId ? null : lineup.viceCaptainId;
    applyLineup({ ...lineup, captainId: playerId, viceCaptainId: nextVC });
  }

  function assignViceCaptain(playerId: string) {
    if (lineup.viceCaptainId === playerId) {
      applyLineup({ ...lineup, viceCaptainId: null });
      return;
    }
    // If this player was C, clear that first.
    const nextC = lineup.captainId === playerId ? null : lineup.captainId;
    applyLineup({ ...lineup, captainId: nextC, viceCaptainId: playerId });
  }

  // ── Summary stats ────────────────────────────────────────────────────────

  const lineupPlayers = useMemo(
    () => players.filter((p) => lineup.playerIds.includes(p.id)),
    [players, lineup.playerIds],
  );

  /** Total effective FPTS with captain 2× and VC 1.5× multipliers applied. */
  const totalEffectiveFpts = useMemo(
    () =>
      lineupPlayers.reduce((sum, p) => {
        const role = getPlayerRole(p.id, lineup);
        return sum + p.baseFpts * fptsMultiplier(role);
      }, 0),
    [lineupPlayers, lineup],
  );

  const totalCreditsUsed = useMemo(
    () => lineupPlayers.reduce((sum, p) => sum + (credits[p.id] ?? 0), 0),
    [lineupPlayers, credits],
  );

  const remainingCredits = budget - totalCreditsUsed;

  // ── Validation ───────────────────────────────────────────────────────────

  const validationErrors = useMemo(
    () => validateLineup(lineup, teamByPlayerId),
    [lineup, teamByPlayerId],
  );

  const isLineupValid = validationErrors.length === 0;

  // ── Budget / credits handlers ────────────────────────────────────────────

  function handleBudgetChange(value: string) {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setBudget(next);
    setStoredBudget(next);
  }

  function handleCreditsChange(playerId: string, value: string) {
    if (value.trim() === "") {
      setCredits((prev) => ({ ...prev, [playerId]: undefined }));
      clearStoredPlayerCredits([playerId]);
      return;
    }
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setCredits((prev) => ({ ...prev, [playerId]: next }));
    setStoredPlayerCredits(playerId, next);
  }

  function handleResetCredits() {
    const playerIds = players.map((p) => p.id);
    clearStoredPlayerCredits(playerIds);
    setCredits((prev) => {
      const next = { ...prev };
      for (const id of playerIds) next[id] = undefined;
      return next;
    });
  }

  /**
   * Auto-fill player credits based on each player's current FPTS relative to
   * the pool average, scaled proportionally to the budget.
   *
   * Formula: credit = clamp(round((baseFpts / avgFpts) * (budget / LINEUP_SIZE)),
   *          minCredit=20% of avg, maxCredit=40% of budget)
   *
   * When no FPTS data is available (scheduled game), distributes budget evenly.
   * Does not touch players already in the lineup (to avoid mid-build disruption).
   */
  function handleSuggestCredits(overrideBudget?: number) {
    const effectiveBudget = overrideBudget ?? budget;
    if (players.length === 0) return;

    const validPlayers = players.filter((p) => p.baseFpts > 0);
    const targetAvgCredit = effectiveBudget / LINEUP_SIZE;
    const maxCredit = Math.round(effectiveBudget * 0.4); // cap: star players at most 40% of budget
    const minCredit = Math.max(1, Math.round(targetAvgCredit * 0.15)); // floor: at least 15% of avg

    const newCredits: Record<string, number> = {};

    if (validPlayers.length === 0) {
      // No FPTS data (scheduled game) — distribute evenly across lineup slots
      const even = Math.max(1, Math.round(targetAvgCredit));
      for (const p of players) {
        newCredits[p.id] = even;
        setStoredPlayerCredits(p.id, even);
      }
    } else {
      const avgFpts = validPlayers.reduce((s, p) => s + p.baseFpts, 0) / validPlayers.length;
      for (const p of players) {
        // Players with 0 FPTS (DNP/not-yet-played) get 50% of avg credit
        const ratio = p.baseFpts > 0 ? p.baseFpts / avgFpts : 0.5;
        const raw = Math.round(ratio * targetAvgCredit);
        const clamped = Math.max(minCredit, Math.min(maxCredit, raw));
        newCredits[p.id] = clamped;
        setStoredPlayerCredits(p.id, clamped);
      }
    }

    setCredits((prev) => ({ ...prev, ...newCredits }));
  }

  /** Apply a platform budget preset and immediately re-suggest credits. */
  function handleBudgetPreset(presetBudget: number) {
    setBudget(presetBudget);
    setStoredBudget(presetBudget);
    handleSuggestCredits(presetBudget);
  }

  // ── Saved lineups handlers ───────────────────────────────────────────────

  function handleSaveLineup() {
    if (!gameId) return;
    setSaveNameError(null);
    setSaveSuccess(false);
    const result = saveLineup(gameId, saveNameInput, lineup);
    if ("error" in result) {
      setSaveNameError(result.error);
      return;
    }
    setSavedLineups(getSavedLineups(gameId));
    setSaveNameInput("");
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  }

  function handleLoadLineup(saved: SavedLineup, allPlayerIds: Set<string>) {
    const restoredIds = saved.lineup.playerIds.filter((id) => allPlayerIds.has(id));
    const restoredCaptain =
      saved.lineup.captainId && restoredIds.includes(saved.lineup.captainId)
        ? saved.lineup.captainId
        : null;
    const restoredVC =
      saved.lineup.viceCaptainId &&
      restoredIds.includes(saved.lineup.viceCaptainId) &&
      saved.lineup.viceCaptainId !== restoredCaptain
        ? saved.lineup.viceCaptainId
        : null;
    applyLineup({ playerIds: restoredIds, captainId: restoredCaptain, viceCaptainId: restoredVC });
  }

  function handleDeleteLineup(id: string) {
    if (!gameId) return;
    deleteSavedLineup(gameId, id);
    setSavedLineups(getSavedLineups(gameId));
    setDeleteConfirmId(null);
  }

  function handleStartRename(saved: SavedLineup) {
    setRenamingId(saved.id);
    setRenameInput(saved.name);
    setRenameError(null);
  }

  function handleCommitRename(id: string) {
    if (!gameId) return;
    const result = renameSavedLineup(gameId, id, renameInput);
    if ("error" in result) {
      setRenameError(result.error);
      return;
    }
    setSavedLineups(getSavedLineups(gameId));
    setRenamingId(null);
    setRenameError(null);
  }

  function formatSavedAt(ts: number): string {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ── OCR handlers ─────────────────────────────────────────────────────────

  async function handleOcrFileChange(file: File) {
    setOcrPhase("loading");
    setOcrError(null);
    setOcrResults(null);
    setOcrManual({});
    try {
      const lines = await extractLinesFromImage(file, (p: OcrProgress) => {
        if (p.phase === "recognizing") {
          setOcrPhase("recognizing");
          setOcrPct(p.pct);
        } else {
          setOcrPhase(p.phase);
        }
      });
      const knownPlayers = players.map((p) => ({ id: p.id, name: p.name }));
      const results = matchOcrLinesToPlayers(lines, knownPlayers);
      // De-duplicate identical OCR lines.
      const seen = new Set<string>();
      const filtered = results.filter((r) => {
        const key = r.ocrText.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setOcrResults(filtered);
      setOcrPhase("done");
    } catch (err) {
      setOcrPhase("error");
      setOcrError(err instanceof Error ? err.message : "OCR failed — please try a different image.");
    }
  }

  function handleOcrApply() {
    if (!ocrResults) return;
    const selectedIds: string[] = [];
    const usedIds = new Set<string>();

    for (let i = 0; i < ocrResults.length; i++) {
      const result = ocrResults[i];
      const manualId = ocrManual[i];
      const effectiveId = manualId || result.matchedPlayer?.id;
      if (effectiveId && !usedIds.has(effectiveId)) {
        selectedIds.push(effectiveId);
        usedIds.add(effectiveId);
      }
      if (selectedIds.length >= LINEUP_SIZE) break;
    }

    const validIds = new Set(players.map((p) => p.id));
    const rosteredIds = selectedIds.filter((id) => validIds.has(id));
    applyLineup({ playerIds: rosteredIds, captainId: null, viceCaptainId: null });

    setOcrExpanded(false);
    setOcrResults(null);
    setOcrPhase("idle");
    setOcrManual({});
  }

  // ── Export ───────────────────────────────────────────────────────────────

  function handleExportLineup() {
    if (!game || !isLineupValid) return;
    const exportPlayers = lineupPlayers.map((p) => {
      const role = getPlayerRole(p.id, lineup);
      const effectiveFpts = p.baseFpts * fptsMultiplier(role);
      return {
        name: p.name,
        teamAbbreviation: p.teamAbbreviation,
        position: p.position,
        fpts: effectiveFpts,
        baseFpts: p.baseFpts,
        credits: credits[p.id] ?? 0,
        role: role === "captain" ? ("Captain" as const) : role === "vice_captain" ? ("Vice Captain" as const) : ("" as const),
      };
    });
    exportOptimizerSelectionAsText(
      exportPlayers,
      `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
    );
  }

  // ── Clear lineup ──────────────────────────────────────────────────────────

  function handleClearLineup() {
    applyLineup({ playerIds: [], captainId: null, viceCaptainId: null });
  }

  // ── Auto-Pick Best ────────────────────────────────────────────────────────
  //
  // Greedy: pick the highest-FPTS active players that fit within the budget.
  // If no credits are set, just picks the top LINEUP_SIZE by FPTS.
  // Skips players who are OUT or marked didNotPlay.

  function handleAutoPick() {
    if (players.length === 0) return;

    // Exclude players who definitely won't play.
    const eligible = players.filter(
      (p) => p.injuryStatus !== "OUT" && !p.didNotPlay,
    );
    const pool = eligible.length >= LINEUP_SIZE ? eligible : players;

    // Sort highest FPTS first (fall back to alphabetical for ties).
    const sorted = [...pool].sort((a, b) =>
      b.baseFpts !== a.baseFpts
        ? b.baseFpts - a.baseFpts
        : a.name.localeCompare(b.name),
    );

    const hasCredits = Object.values(credits).some((c) => c !== undefined && c > 0);
    const picked: string[] = [];

    if (hasCredits && budget > 0) {
      // Greedy within budget.
      let remaining = budget;
      for (const p of sorted) {
        if (picked.length >= LINEUP_SIZE) break;
        const cost = credits[p.id] ?? 0;
        if (cost === 0 || remaining - cost >= 0) {
          picked.push(p.id);
          remaining -= cost;
        }
      }
      // If greedy couldn't fill 8 (tight budget), top up from remaining pool.
      if (picked.length < LINEUP_SIZE) {
        for (const p of sorted) {
          if (picked.length >= LINEUP_SIZE) break;
          if (!picked.includes(p.id)) picked.push(p.id);
        }
      }
    } else {
      // No credits configured — just take top LINEUP_SIZE by FPTS.
      for (const p of sorted) {
        if (picked.length >= LINEUP_SIZE) break;
        picked.push(p.id);
      }
    }

    applyLineup({
      playerIds: picked.slice(0, LINEUP_SIZE),
      captainId: null,
      viceCaptainId: null,
    });
  }

  // ── Loading / error states ───────────────────────────────────────────────

  if (game === null) {
    return (
      <MobileLayout showBack title="Fantasy Optimizer">
        <div className="p-8 text-center text-muted-foreground">Loading game...</div>
      </MobileLayout>
    );
  }

  if (!game) {
    return (
      <MobileLayout showBack title="Fantasy Optimizer">
        <div className="p-8 text-center text-muted-foreground">Game not found</div>
      </MobileLayout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <MobileLayout showBack title="Fantasy Optimizer">
      <div className="flex flex-col">

        {/* ── Game context + budget ─────────────────────────────────────── */}
        <div className="p-4 border-b border-border bg-card flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {game.status === "in_progress" && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Live
              </span>
            )}
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
            </div>
          </div>
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground">
              {game.status === "in_progress" ? "Auto-updating · " : ""}
              Updated {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}

          {/* Platform budget presets */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">Platform preset</span>
            <div className="flex flex-wrap gap-1.5">
              {([
                { label: "DraftKings", value: 50000 },
                { label: "FanDuel", value: 60000 },
                { label: "Custom (100)", value: 100 },
              ] as const).map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleBudgetPreset(preset.value)}
                  className={`text-xs font-semibold rounded-md px-2.5 py-1 border transition-colors active:scale-[0.97] ${
                    budget === preset.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Budget</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={budget}
              onChange={(e) => handleBudgetChange(e.target.value)}
              className="w-28 h-9 rounded-md border border-input bg-transparent px-3 text-right text-sm font-semibold tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>

          {/* Credit usage bar — shows spent vs. remaining vs. budget */}
          {budget > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">
                  {totalCreditsUsed > 0 ? `${totalCreditsUsed.toLocaleString()} used` : "No credits assigned"}
                </span>
                <span
                  className={
                    remainingCredits < 0
                      ? "text-destructive font-semibold"
                      : budget > 0 && remainingCredits / budget < 0.15
                        ? "text-amber-400 font-semibold"
                        : "text-muted-foreground"
                  }
                >
                  {remainingCredits < 0
                    ? `${Math.abs(remainingCredits).toLocaleString()} over budget`
                    : `${remainingCredits.toLocaleString()} remaining`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    remainingCredits < 0
                      ? "bg-destructive"
                      : totalCreditsUsed / budget > 0.85
                        ? "bg-amber-500"
                        : "bg-primary"
                  }`}
                  style={{ width: `${Math.min((totalCreditsUsed / budget) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoPick}
              disabled={players.length === 0}
              className="text-xs font-semibold text-emerald-400 border border-emerald-500/40 rounded-md px-3 py-1.5 active:scale-[0.98] transition-transform hover:bg-emerald-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Auto-fill lineup with highest-FPTS players within budget"
            >
              ⚡ Auto-Pick Best
            </button>
            <button
              type="button"
              onClick={() => handleSuggestCredits()}
              className="text-xs font-semibold text-primary border border-primary/40 rounded-md px-3 py-1.5 active:scale-[0.98] transition-transform hover:bg-primary/10"
              title="Auto-fill player credits proportional to their FPTS"
            >
              ✦ Suggest Credits
            </button>
            <button
              type="button"
              onClick={handleResetCredits}
              className="text-xs font-semibold text-destructive border border-destructive/30 rounded-md px-3 py-1.5 active:scale-[0.98] transition-transform"
            >
              Reset Credits
            </button>
            {lineup.playerIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearLineup}
                className="text-xs font-semibold text-muted-foreground border border-border rounded-md px-3 py-1.5 active:scale-[0.98] transition-transform hover:text-destructive hover:border-destructive/40"
                title="Clear the current lineup"
              >
                Clear Lineup
              </button>
            )}
            <button
              type="button"
              disabled={!isLineupValid}
              onClick={handleExportLineup}
              className={`text-xs font-semibold rounded-md px-3 py-1.5 border transition-transform active:scale-[0.98] ${
                isLineupValid
                  ? "border-primary-border text-primary hover:bg-primary/10"
                  : "border-border text-muted-foreground opacity-40 cursor-not-allowed"
              }`}
            >
              Export Lineup
            </button>
          </div>
        </div>

        {/* ── Lineup summary grid ───────────────────────────────────────── */}
        <div className="sticky top-0 z-10 border-b border-border bg-card">
          {/* Progress bar */}
          <div className="h-1 w-full bg-border">
            <div
              className={`h-full transition-all duration-300 ${
                lineup.playerIds.length === LINEUP_SIZE ? "bg-primary" : "bg-primary/60"
              }`}
              style={{ width: `${(lineup.playerIds.length / LINEUP_SIZE) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
          {/* Lineup size */}
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Lineup
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                lineup.playerIds.length === LINEUP_SIZE ? "text-primary" : "text-foreground"
              }`}
            >
              {lineup.playerIds.length}
              <span className="text-sm font-medium text-muted-foreground">/{LINEUP_SIZE}</span>
            </span>
          </div>

          {/* Total effective FPTS */}
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Total FPTS
            </span>
            <span className="text-xl font-bold tabular-nums text-primary">
              {totalEffectiveFpts.toFixed(1)}
            </span>
          </div>

          {/* Captain */}
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-yellow-950 font-black text-[9px]">C</span>
              Captain
            </span>
            <span className="text-sm font-semibold text-foreground truncate">
              {lineup.captainId
                ? (players.find((p) => p.id === lineup.captainId)?.name ?? "—")
                : <span className="text-muted-foreground font-normal italic">Not set</span>}
            </span>
          </div>

          {/* Vice Captain */}
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500 text-sky-950 font-black text-[9px]">VC</span>
              Vice Capt.
            </span>
            <span className="text-sm font-semibold text-foreground truncate">
              {lineup.viceCaptainId
                ? (players.find((p) => p.id === lineup.viceCaptainId)?.name ?? "—")
                : <span className="text-muted-foreground font-normal italic">Not set</span>}
            </span>
          </div>

          {/* Credits used */}
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Credits Used
            </span>
            <span className="text-xl font-bold tabular-nums">{totalCreditsUsed}</span>
          </div>

          {/* Credits remaining */}
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Remaining
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${
                remainingCredits < 0
                  ? "text-destructive"
                  : budget > 0 && remainingCredits / budget < 0.2
                    ? "text-amber-400"
                    : "text-foreground"
              }`}
            >
              {remainingCredits}
            </span>
          </div>
          </div>{/* /grid */}
        </div>{/* /sticky */}

        {/* ── Lineup requirements checklist ─────────────────────────────── */}
        {lineupPlayers.length > 0 && (
          <div className={`mx-4 mt-3 rounded-xl border px-4 py-3 flex flex-col gap-2 ${
            isLineupValid
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-amber-500/30 bg-amber-500/10"
          }`}>
            <p className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
              Lineup checklist
            </p>
            {/* Players filled */}
            {(() => {
              const playersDone = lineup.playerIds.length === LINEUP_SIZE;
              return (
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold shrink-0 ${playersDone ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {playersDone ? "✓" : "○"}
                  </span>
                  <span className={`text-xs ${playersDone ? "text-muted-foreground" : "text-foreground/80"}`}>
                    {lineup.playerIds.length}/{LINEUP_SIZE} players selected
                  </span>
                </div>
              );
            })()}
            {/* Captain */}
            {(() => {
              const captainDone = !!lineup.captainId;
              return (
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold shrink-0 ${captainDone ? "text-emerald-400" : "text-amber-400"}`}>
                    {captainDone ? "✓" : "○"}
                  </span>
                  <span className={`text-xs ${captainDone ? "text-muted-foreground" : "text-amber-200/80"}`}>
                    {captainDone
                      ? `Captain: ${players.find((p) => p.id === lineup.captainId)?.name ?? "—"} (×2.0)`
                      : "Set a Captain (×2.0) — tap C on any selected player"}
                  </span>
                </div>
              );
            })()}
            {/* Vice Captain */}
            {(() => {
              const vcDone = !!lineup.viceCaptainId;
              return (
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold shrink-0 ${vcDone ? "text-emerald-400" : "text-amber-400"}`}>
                    {vcDone ? "✓" : "○"}
                  </span>
                  <span className={`text-xs ${vcDone ? "text-muted-foreground" : "text-amber-200/80"}`}>
                    {vcDone
                      ? `Vice Captain: ${players.find((p) => p.id === lineup.viceCaptainId)?.name ?? "—"} (×1.5)`
                      : "Set a Vice Captain (×1.5) — tap VC on any selected player"}
                  </span>
                </div>
              );
            })()}
            {/* Team limit violations */}
            {validationErrors
              .filter((e) => e.kind === "team_limit")
              .map((e, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs font-bold shrink-0 text-destructive">✕</span>
                  <span className="text-xs text-destructive/80 leading-snug">{validationMessage(e)}</span>
                </div>
              ))}
            {isLineupValid && (
              <p className="text-[10px] font-semibold text-emerald-400 mt-1">✓ Lineup is valid — ready to export</p>
            )}
          </div>
        )}

        {/* ── Multiplier legend ─────────────────────────────────────────── */}
        <div className="mx-4 mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-yellow-950 font-black text-[9px] shrink-0">C</span>
            Captain × 2.0
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-500 text-sky-950 font-black text-[9px] shrink-0">VC</span>
            Vice Captain × 1.5
          </span>
        </div>

        {/* ── Saved Lineups ─────────────────────────────────────────────── */}
        <div className="mx-4 mt-4 rounded-xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider uppercase text-foreground">
              Saved Lineups
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {savedLineups.length} saved
            </span>
          </div>

          {/* Save current lineup form */}
          <div className="px-4 py-3 border-b border-border flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Name this lineup…"
                value={saveNameInput}
                onChange={(e) => { setSaveNameInput(e.target.value); setSaveNameError(null); setSaveSuccess(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveLineup(); }}
                maxLength={50}
                className={`flex-1 h-9 rounded-md border px-3 text-sm bg-transparent shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                  saveNameError ? "border-destructive" : "border-input"
                }`}
              />
              <button
                type="button"
                onClick={handleSaveLineup}
                disabled={!saveNameInput.trim()}
                className="h-9 px-4 text-xs font-bold rounded-md border border-primary-border text-primary hover:bg-primary/10 transition-colors active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                Save
              </button>
            </div>
            {saveNameError === "duplicate" && (
              <p className="text-[11px] text-destructive">A lineup with that name already exists.</p>
            )}
            {saveNameError === "empty_name" && (
              <p className="text-[11px] text-destructive">Please enter a name before saving.</p>
            )}
            {saveSuccess && (
              <p className="text-[11px] text-emerald-400 font-semibold">Lineup saved successfully.</p>
            )}
          </div>

          {/* Saved lineup list */}
          {savedLineups.length === 0 ? (
            <div className="px-4 py-5 text-center text-xs text-muted-foreground italic">
              No saved lineups yet. Name and save your current lineup above.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {savedLineups.map((saved) => {
                const allPlayerIds = new Set(players.map((p) => p.id));
                const validCount = saved.lineup.playerIds.filter((id) => allPlayerIds.has(id)).length;
                const isRenaming = renamingId === saved.id;
                const isConfirmingDelete = deleteConfirmId === saved.id;
                const liveStats = computeSavedLineupLiveStats(
                  saved.lineup,
                  players,
                  game.status,
                  (playerId) => {
                    const entries = recentForm.getForm(playerId);
                    if (entries.length === 0) return null;
                    return entries.reduce((sum, e) => sum + e.fpts, 0) / entries.length;
                  },
                );

                return (
                  <div key={saved.id} className="px-4 py-3 flex flex-col gap-2">
                    {/* Name row */}
                    {isRenaming ? (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            autoFocus
                            value={renameInput}
                            onChange={(e) => { setRenameInput(e.target.value); setRenameError(null); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCommitRename(saved.id);
                              if (e.key === "Escape") { setRenamingId(null); setRenameError(null); }
                            }}
                            maxLength={50}
                            className={`flex-1 h-8 rounded-md border px-3 text-sm bg-transparent shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                              renameError ? "border-destructive" : "border-input"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleCommitRename(saved.id)}
                            className="h-8 px-3 text-[11px] font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
                          >
                            OK
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRenamingId(null); setRenameError(null); }}
                            className="h-8 px-2 text-[11px] font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted/40 transition-colors shrink-0"
                          >
                            Cancel
                          </button>
                        </div>
                        {renameError === "duplicate" && (
                          <p className="text-[11px] text-destructive">That name is already taken.</p>
                        )}
                        {renameError === "empty_name" && (
                          <p className="text-[11px] text-destructive">Name cannot be empty.</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{saved.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {formatSavedAt(saved.savedAt)} · {validCount}/{LINEUP_SIZE} players
                            {saved.lineup.captainId && (
                              <>
                                {" "}·{" "}
                                <span className="text-yellow-400 font-semibold">
                                  C: {players.find((p) => p.id === saved.lineup.captainId)?.name ?? "—"}
                                </span>
                              </>
                            )}
                          </p>
                          {/* Live totals — always current, no need to load the lineup. */}
                          <p className="text-[11px] mt-1 flex items-center gap-1.5 flex-wrap tabular-nums">
                            <span className="font-bold text-primary">{liveStats.liveFpts.toFixed(1)} live FP</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{liveStats.projectedFpts.toFixed(1)} proj FP</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{liveStats.playersPlaying} playing</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{liveStats.playersFinished} finished</span>
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadLineup(saved, allPlayerIds)}
                            className="h-7 px-2.5 text-[11px] font-bold rounded-md border border-primary-border text-primary hover:bg-primary/10 transition-colors"
                            title="Load this lineup"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartRename(saved)}
                            className="h-7 px-2 text-[11px] font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted/40 transition-colors"
                            title="Rename"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(saved.id)}
                            className="h-7 px-2 text-[11px] font-semibold rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Delete confirmation inline */}
                    {isConfirmingDelete && !isRenaming && (
                      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                        <p className="text-xs text-destructive flex-1">Delete "{saved.name}"?</p>
                        <button
                          type="button"
                          onClick={() => handleDeleteLineup(saved.id)}
                          className="h-7 px-3 text-[11px] font-bold rounded-md bg-destructive text-white hover:bg-destructive/90 transition-colors shrink-0"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="h-7 px-2 text-[11px] font-semibold rounded-md border border-border text-muted-foreground hover:bg-muted/40 transition-colors shrink-0"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── OCR Lineup Import ─────────────────────────────────────────── */}
        <div className="mx-4 mt-3 rounded-xl border border-border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setOcrExpanded((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between gap-2 hover:bg-muted/20 transition-colors"
          >
            <span className="text-xs font-bold tracking-wider uppercase text-foreground flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
              Import from Screenshot (OCR)
            </span>
            <span className="text-muted-foreground text-xs select-none">{ocrExpanded ? "▲" : "▼"}</span>
          </button>

          {ocrExpanded && (
            <div className="border-t border-border">
              {/* Hidden file input */}
              <input
                ref={ocrFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  e.target.value = "";
                  await handleOcrFileChange(file);
                }}
              />

              {/* Idle state */}
              {(ocrPhase === "idle") && !ocrResults && (
                <div className="px-4 py-4 flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload a screenshot from your fantasy basketball app. Player names are extracted automatically and matched to this game's roster. Assign Captain and Vice Captain after applying.
                  </p>
                  <button
                    type="button"
                    onClick={() => ocrFileRef.current?.click()}
                    className="h-10 px-4 rounded-md border border-dashed border-primary/50 text-primary text-sm font-semibold hover:bg-primary/5 transition-colors"
                  >
                    Choose Screenshot…
                  </button>
                </div>
              )}

              {/* Loading / recognizing */}
              {(ocrPhase === "loading" || ocrPhase === "recognizing") && (
                <div className="px-4 py-6 flex flex-col items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <p className="text-xs text-muted-foreground text-center">
                    {ocrPhase === "loading"
                      ? "Loading OCR engine…"
                      : `Recognizing text… ${ocrPct}%`}
                  </p>
                </div>
              )}

              {/* Error */}
              {ocrPhase === "error" && (
                <div className="px-4 py-4 flex flex-col gap-2">
                  <p className="text-xs text-destructive">{ocrError ?? "OCR failed. Please try again."}</p>
                  <button
                    type="button"
                    onClick={() => { setOcrPhase("idle"); setOcrError(null); setOcrResults(null); }}
                    className="text-xs text-primary underline self-start"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Results */}
              {ocrPhase === "done" && ocrResults && (() => {
                const matchedCount = ocrResults.filter((r, i) => r.matchedPlayer !== null || ocrManual[i]).length;
                const unmatchedCount = ocrResults.filter((r, i) => r.matchedPlayer === null && !ocrManual[i]).length;
                return (
                  <div className="flex flex-col">
                    <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        <span className="text-emerald-400 font-semibold">{matchedCount} matched</span>
                        {unmatchedCount > 0 && <> · <span className="text-amber-400 font-semibold">{unmatchedCount} unmatched</span></>}
                      </p>
                      <button
                        type="button"
                        onClick={() => ocrFileRef.current?.click()}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline"
                      >
                        New photo
                      </button>
                    </div>

                    <div className="divide-y divide-border max-h-56 overflow-y-auto">
                      {ocrResults.map((result, i) => {
                        const manualId = ocrManual[i];
                        const effectivePlayer = manualId
                          ? players.find((p) => p.id === manualId) ?? result.matchedPlayer
                          : result.matchedPlayer;
                        return (
                          <div key={i} className="px-4 py-2.5 flex items-center gap-2">
                            <span className={`shrink-0 text-xs font-bold ${effectivePlayer ? "text-emerald-400" : "text-amber-400"}`}>
                              {effectivePlayer ? "✓" : "?"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-muted-foreground truncate">"{result.ocrText}"</p>
                              {effectivePlayer && (
                                <p className="text-xs font-semibold text-foreground truncate">
                                  → {effectivePlayer.name}
                                  {!manualId && result.confidence < 0.9 && (
                                    <span className="text-muted-foreground font-normal ml-1">
                                      ({Math.round(result.confidence * 100)}%)
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>
                            <select
                              value={manualId ?? effectivePlayer?.id ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                setOcrManual((prev) =>
                                  val
                                    ? { ...prev, [i]: val }
                                    : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== String(i))),
                                );
                              }}
                              className="h-7 text-[11px] rounded border border-input bg-card px-1 max-w-[130px] shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <option value="">— skip —</option>
                              {players.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>

                    <div className="px-4 py-3 border-t border-border flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleOcrApply}
                        className="flex-1 h-9 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                      >
                        Apply to Lineup ({Math.min(matchedCount, LINEUP_SIZE)} players)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOcrResults(null); setOcrPhase("idle"); setOcrManual({}); }}
                        className="h-9 px-3 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ── Search + Sort + Filters ───────────────────────────────────── */}
        <div className="p-4 flex flex-col gap-3 bg-background mt-1">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground shrink-0">Sort by</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="bg-card text-foreground">
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              title={sortDir === "desc" ? "Highest first — click for lowest first" : "Lowest first — click for highest first"}
              className="h-9 w-9 shrink-0 rounded-md border border-input flex items-center justify-center text-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors font-bold"
            >
              {sortDir === "desc" ? "↓" : "↑"}
            </button>
          </div>

          {/* Team filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all", "away", "home"] as TeamFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTeamFilter(value)}
                className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors ${
                  teamFilter === value
                    ? "bg-primary text-primary-foreground border-primary-border"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {value === "all"
                  ? "All Teams"
                  : value === "away"
                    ? game.awayTeam.abbreviation
                    : game.homeTeam.abbreviation}
              </button>
            ))}
          </div>

          {/* Position filter */}
          {availablePositions.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPositionFilter("all")}
                className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors ${
                  positionFilter === "all"
                    ? "bg-primary text-primary-foreground border-primary-border"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                All Positions
              </button>
              {availablePositions.map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => setPositionFilter(position)}
                  className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors ${
                    positionFilter === position
                      ? "bg-primary text-primary-foreground border-primary-border"
                      : "border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {position}
                </button>
              ))}
            </div>
          )}

          {/* Favorites only toggle */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground shrink-0">Favorites only</span>
            <button
              type="button"
              role="switch"
              aria-checked={favoritesOnly}
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${favoritesOnly ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${favoritesOnly ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </div>

          {/* Avoid players already used in previous saved teams */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              Avoid players used in other lineups
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={avoidUsedPlayers}
              onClick={() => setAvoidUsedPlayers((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${avoidUsedPlayers ? "bg-primary" : "bg-muted"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${avoidUsedPlayers ? "translate-x-4" : "translate-x-0"}`}
              />
            </button>
          </div>
        </div>

        {/* ── Player list ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 px-4 pb-12">
          {visiblePlayers.length === 0 ? (
            search || teamFilter !== "all" || positionFilter !== "all" || favoritesOnly ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No players match your filters.</div>
            ) : (
              <div className="py-10 flex flex-col items-center gap-4 text-center">
                <div className="text-4xl select-none">🏀</div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-semibold text-foreground">Ready to build your lineup</p>
                  <p className="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
                    Tap <span className="font-semibold text-emerald-400">⚡ Auto-Pick Best</span> to fill instantly,
                    or tap <span className="font-semibold text-primary">✦ Suggest Credits</span> then select players manually.
                  </p>
                </div>
              </div>
            )
          ) : (
            visiblePlayers.map((player) => {
              const isInLineup = lineup.playerIds.includes(player.id);
              const isFavorite = favorites.isFavorite(player.id);
              const form = recentForm.getForm(player.id);
              const role = getPlayerRole(player.id, lineup);
              const effectiveFpts = player.baseFpts * fptsMultiplier(role);
              const isOverLimit = lineup.playerIds.length >= LINEUP_SIZE && !isInLineup;
              const isUsedElsewhere =
                avoidUsedPlayers && !isInLineup && usedInSavedLineups.has(player.id);

              return (
                <div
                  key={player.id}
                  onClick={() => { if (isOverLimit) return; togglePlayer(player.id); }}
                  className={`rounded-xl border p-3 flex items-start gap-3 transition-colors ${isOverLimit ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${
                    role === "captain"
                      ? "border-yellow-500/50 bg-yellow-500/10"
                      : role === "vice_captain"
                        ? "border-sky-500/50 bg-sky-500/10"
                        : isInLineup
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card hover:bg-muted/20"
                  }`}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isInLineup}
                    disabled={isOverLimit}
                    onChange={() => togglePlayer(player.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border border-primary accent-primary disabled:opacity-40"
                  />

                  {/* Star */}
                  <StarButton
                    active={isFavorite}
                    onToggle={() => favorites.toggleFavorite(player.id)}
                    label={isFavorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
                  />

                  {/* Player info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDetailPlayer(player); }}
                        className="font-semibold text-foreground truncate text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                      >
                        {player.name}
                      </button>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground shrink-0">
                        {player.teamAbbreviation}
                      </span>
                      <PlayerStatusBadges player={player} gameStatus={game.status} />
                      {isUsedElsewhere && (
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground italic shrink-0">
                          used
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{player.number} · {player.position} · {player.stats.minutes ?? "-"} MIN
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground tabular-nums">
                      <span>{player.stats.points} PTS</span>
                      <span>{player.stats.rebounds} REB</span>
                      <span>{player.stats.assists} AST</span>
                      <RecentFormBadge entries={form} />
                    </div>
                  </div>

                  {/* Right column: FPTS + role buttons + compare + credits */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* FPTS display — shows effective when role assigned */}
                    <div className="flex items-baseline gap-1">
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          role !== "normal" ? "text-foreground" : "text-primary"
                        }`}
                      >
                        {effectiveFpts.toFixed(1)}
                      </span>
                      {role !== "normal" && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          ({player.baseFpts.toFixed(1)} × {fptsMultiplier(role)})
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">FPTS</span>
                    </div>

                    {/* Captain / Vice Captain role buttons — only for lineup members */}
                    {isInLineup && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); assignCaptain(player.id); }}
                          className={`w-8 h-8 rounded-full text-[11px] font-black border transition-colors flex items-center justify-center ${
                            role === "captain"
                              ? "bg-yellow-500 text-yellow-950 border-yellow-400"
                              : "border-border text-muted-foreground hover:bg-yellow-500/10 hover:border-yellow-500/40 hover:text-yellow-400"
                          }`}
                          aria-label={role === "captain" ? `Remove Captain from ${player.name}` : `Make ${player.name} Captain`}
                          title={role === "captain" ? "Remove Captain" : "Set as Captain (2×)"}
                        >
                          C
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); assignViceCaptain(player.id); }}
                          className={`w-8 h-8 rounded-full text-[11px] font-black border transition-colors flex items-center justify-center ${
                            role === "vice_captain"
                              ? "bg-sky-500 text-sky-950 border-sky-400"
                              : "border-border text-muted-foreground hover:bg-sky-500/10 hover:border-sky-500/40 hover:text-sky-400"
                          }`}
                          aria-label={role === "vice_captain" ? `Remove Vice Captain from ${player.name}` : `Make ${player.name} Vice Captain`}
                          title={role === "vice_captain" ? "Remove Vice Captain" : "Set as Vice Captain (1.5×)"}
                        >
                          VC
                        </button>
                      </div>
                    )}

                    {/* Credits input */}
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      placeholder="—"
                      value={credits[player.id] ?? ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleCreditsChange(player.id, e.target.value)}
                      className="w-16 h-8 rounded-md border border-input bg-transparent px-2 text-right text-sm font-semibold tabular-nums shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />

                    {/* Compare button */}
                    {(() => {
                      const isComparing = comparison.isSelected(player.id);
                      const disableAdd = comparison.isFull && !isComparing;
                      return (
                        <button
                          type="button"
                          disabled={disableAdd}
                          onClick={(e) => {
                            e.stopPropagation();
                            comparison.toggle(player.id);
                          }}
                          className={`text-[11px] font-semibold rounded-md px-2 py-1 border transition-colors ${
                            isComparing
                              ? "bg-primary text-primary-foreground border-primary-border"
                              : disableAdd
                                ? "border-border text-muted-foreground opacity-50 cursor-not-allowed"
                                : "border-border text-foreground hover:bg-muted/40"
                          }`}
                        >
                          {isComparing ? "Added" : "Compare"}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <CompareBar league={league} gameId={gameId || ""} count={comparison.selectedIds.length} />

      {detailPlayer && (
        <PlayerDetailSheet
          player={detailPlayer}
          teamAbbreviation={detailPlayer.teamAbbreviation}
          gameStatus={game.status}
          recentForm={recentForm.getForm(detailPlayer.id)}
          onClose={() => setDetailPlayer(null)}
          league={league}
        />
      )}
    </MobileLayout>
  );
}
