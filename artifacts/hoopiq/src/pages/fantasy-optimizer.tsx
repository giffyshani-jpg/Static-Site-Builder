import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { CompareBar } from "../components/compare-bar";
import { StarButton } from "../components/star-button";
import { InjuryBadge } from "../components/injury-badge";
import { RecentFormBadge } from "../components/recent-form-badge";
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

function minutesValue(stats: Player["stats"]): number {
  const parsed = stats.minutes ? parseFloat(stats.minutes) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

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
  const league = params.league as "nba" | "wnba";

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
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const comparison = useComparisonSelection(gameId);
  const favorites = useFavorites();
  const recentForm = useRecentForm();

  // ── Restore preferences ──────────────────────────────────────────────────

  useEffect(() => {
    const prefs = getOptimizerPrefs();
    setSortKey(prefs.sortKey as SortKey);
    setTeamFilter(prefs.teamFilter);
    setPositionFilter(prefs.position);
    setFavoritesOnly(prefs.favoritesOnly);
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    setOptimizerPrefs({ sortKey, teamFilter, position: positionFilter, favoritesOnly });
  }, [prefsLoaded, sortKey, teamFilter, positionFilter, favoritesOnly]);

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

    const sorted = [...withCredits].sort((a, b) => {
      switch (sortKey) {
        case "points":   return b.stats.points   - a.stats.points;
        case "rebounds": return b.stats.rebounds - a.stats.rebounds;
        case "assists":  return b.stats.assists  - a.stats.assists;
        case "credits":  return b.credits        - a.credits;
        case "minutes":  return minutesValue(b.stats) - minutesValue(a.stats);
        case "fpts":
        default:         return b.baseFpts - a.baseFpts;
      }
    });

    // Favorites always bubble to the top on top of whatever sort is active.
    sorted.sort((a, b) => {
      const aFav = favorites.isFavorite(a.id) ? 1 : 0;
      const bFav = favorites.isFavorite(b.id) ? 1 : 0;
      return bFav - aFav;
    });

    return sorted;
  }, [players, credits, search, sortKey, teamFilter, positionFilter, favorites, favoritesOnly]);

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
      // Add to lineup (no upper cap enforced here — validation surfaces the error).
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
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
          </div>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-foreground">Budget</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={budget}
              onChange={(e) => handleBudgetChange(e.target.value)}
              className="w-24 h-9 rounded-md border border-input bg-transparent px-3 text-right text-sm font-semibold tabular-nums shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetCredits}
              className="text-xs font-semibold text-destructive border border-destructive-border rounded-md px-3 py-1.5 active:scale-[0.98] transition-transform"
            >
              Reset Credits
            </button>
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
        <div className="grid grid-cols-2 gap-px bg-border sticky top-0 z-10">
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
              className={`text-xl font-bold tabular-nums ${remainingCredits < 0 ? "text-destructive" : "text-foreground"}`}
            >
              {remainingCredits}
            </span>
          </div>
        </div>

        {/* ── Validation messages ───────────────────────────────────────── */}
        {validationErrors.length > 0 && (
          <div className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex flex-col gap-1.5">
            <p className="text-[10px] font-bold tracking-wider uppercase text-amber-500">
              Lineup Requirements
            </p>
            {validationErrors.map((err, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border-2 border-amber-500/60" />
                <p className="text-xs text-amber-200 leading-snug">{validationMessage(err)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Valid lineup confirmation */}
        {isLineupValid && lineupPlayers.length > 0 && (
          <div className="mx-4 mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <p className="text-xs font-semibold text-emerald-300">Lineup is valid — ready to export</p>
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

        {/* ── Search + Sort + Filters ───────────────────────────────────── */}
        <div className="p-4 flex flex-col gap-3 bg-background mt-1">
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />

          <div className="flex items-center justify-between gap-3">
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
        </div>

        {/* ── Player list ───────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2 px-4 pb-12">
          {visiblePlayers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No players found.</div>
          ) : (
            visiblePlayers.map((player) => {
              const isInLineup = lineup.playerIds.includes(player.id);
              const isFavorite = favorites.isFavorite(player.id);
              const form = recentForm.getForm(player.id);
              const role = getPlayerRole(player.id, lineup);
              const effectiveFpts = player.baseFpts * fptsMultiplier(role);
              const isOverLimit = lineup.playerIds.length >= LINEUP_SIZE && !isInLineup;

              return (
                <div
                  key={player.id}
                  onClick={() => togglePlayer(player.id)}
                  className={`rounded-xl border p-3 flex items-start gap-3 cursor-pointer transition-colors ${
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
                      <span className="font-semibold text-foreground truncate">{player.name}</span>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground shrink-0">
                        {player.teamAbbreviation}
                      </span>
                      <InjuryBadge status={player.injuryStatus} />
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
                          className={`w-7 h-7 rounded-full text-[10px] font-black border transition-colors flex items-center justify-center ${
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
                          className={`w-7 h-7 rounded-full text-[10px] font-black border transition-colors flex items-center justify-center ${
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
    </MobileLayout>
  );
}
