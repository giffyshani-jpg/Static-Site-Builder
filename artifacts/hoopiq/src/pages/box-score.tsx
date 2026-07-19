import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "wouter";
import { MobileLayout } from "../components/layout";
import { CompareBar } from "../components/compare-bar";
import { StarButton } from "../components/star-button";
import { PlayerStatusBadges } from "../components/player-status-badges";
import { RecentFormBadge } from "../components/recent-form-badge";
import { PlayerDetailSheet } from "../components/player-detail-sheet";
import { PregameIntelPanel } from "../components/pregame-intel-panel";
import { calculateFantasyPoints } from "../lib/stats";
import { useComparisonSelection } from "../hooks/use-comparison-selection";
import { useFavorites } from "../hooks/use-favorites";
import { useRecentForm } from "../hooks/use-recent-form";
import { useLiveGame } from "../hooks/use-live-game";
import {
  BoxScoreTab,
  getBoxScorePrefs,
  setBoxScorePrefs,
  setLastGame,
} from "../lib/preferences";
import { Player } from "../lib/types";
import { minutesValue, playerSortTier } from "../lib/player-status";

// ── Types ─────────────────────────────────────────────────────────────────────

type RosterPlayer = Player & { teamAbbreviation: string };

type BoxSortKey = "min" | "fpts" | "pts" | "reb" | "ast" | "stl" | "blk" | "to";
type SortDir = "asc" | "desc";

// ── Helpers ───────────────────────────────────────────────────────────────────

function compareBySort(
  a: RosterPlayer,
  b: RosterPlayer,
  key: BoxSortKey,
  dir: SortDir,
): number {
  const d = dir === "desc";
  switch (key) {
    case "min":  return d ? minutesValue(b.stats) - minutesValue(a.stats) : minutesValue(a.stats) - minutesValue(b.stats);
    case "fpts": return d ? calculateFantasyPoints(b.stats) - calculateFantasyPoints(a.stats) : calculateFantasyPoints(a.stats) - calculateFantasyPoints(b.stats);
    case "pts":  return d ? b.stats.points    - a.stats.points    : a.stats.points    - b.stats.points;
    case "reb":  return d ? b.stats.rebounds  - a.stats.rebounds  : a.stats.rebounds  - b.stats.rebounds;
    case "ast":  return d ? b.stats.assists   - a.stats.assists   : a.stats.assists   - b.stats.assists;
    case "stl":  return d ? b.stats.steals    - a.stats.steals    : a.stats.steals    - b.stats.steals;
    case "blk":  return d ? b.stats.blocks    - a.stats.blocks    : a.stats.blocks    - b.stats.blocks;
    case "to":   return d ? b.stats.turnovers - a.stats.turnovers : a.stats.turnovers - b.stats.turnovers;
    default:     return 0;
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Sort header ───────────────────────────────────────────────────────────────

function SortTh({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: BoxSortKey;
  activeSortKey: BoxSortKey | null;
  sortDir: SortDir;
  onSort: (key: BoxSortKey) => void;
  className?: string;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      className={`px-3 py-3 font-medium text-right select-none cursor-pointer hover:text-foreground transition-colors ${isActive ? "text-primary" : ""} ${className}`}
      onClick={() => onSort(sortKey)}
      title={`Sort by ${label}`}
    >
      <span className="inline-flex items-center justify-end gap-0.5">
        {label}
        <span className="text-[9px] ml-0.5 tabular-nums leading-none">
          {isActive ? (sortDir === "desc" ? "↓" : "↑") : <span className="opacity-30">↕</span>}
        </span>
      </span>
    </th>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BoxScore() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as import("../lib/types").LeagueKey;

  const { game, lastUpdated, isLive, isStale } = useLiveGame(gameId, league);

  const [activeTab, setActiveTab] = useState<BoxScoreTab>("away");
  const [positionFilter, setPositionFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Sort state — not persisted (resets on navigation, which is fine).
  const [sortKey, setSortKey] = useState<BoxSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [detailPlayer, setDetailPlayer] = useState<RosterPlayer | null>(null);

  const comparison = useComparisonSelection(gameId);
  const favorites = useFavorites();
  const recentForm = useRecentForm();

  // Restore the remembered tab/filters for this specific game.
  useEffect(() => {
    const prefs = getBoxScorePrefs(gameId);
    setActiveTab(prefs.tab);
    setPositionFilter(prefs.position);
    setFavoritesOnly(prefs.favoritesOnly);
    setPrefsLoaded(true);
  }, [gameId]);

  // Persist whenever the user changes tab/filters.
  useEffect(() => {
    if (!prefsLoaded || !gameId) return;
    setBoxScorePrefs(gameId, { tab: activeTab, position: positionFilter, favoritesOnly });
  }, [gameId, prefsLoaded, activeTab, positionFilter, favoritesOnly]);

  // Record recent form + set last-game shortcut on first load.
  useEffect(() => {
    if (!game || !gameId) return;
    setLastGame({ league, gameId });
    const allPlayers = [...game.awayTeam.players, ...game.homeTeam.players];
    recentForm.recordGame(
      allPlayers.map((p) => ({ id: p.id, fpts: calculateFantasyPoints(p.stats) })),
      gameId,
      Date.now(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);

  // Sort handler – clicking same column toggles dir; new column resets to desc.
  function handleSort(key: BoxSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const rosterPlayers: RosterPlayer[] = useMemo(() => {
    if (!game) return [];
    if (activeTab === "all") {
      return [
        ...game.awayTeam.players.map((p) => ({ ...p, teamAbbreviation: game.awayTeam.abbreviation })),
        ...game.homeTeam.players.map((p) => ({ ...p, teamAbbreviation: game.homeTeam.abbreviation })),
      ];
    }
    const team = activeTab === "away" ? game.awayTeam : game.homeTeam;
    return team.players.map((p) => ({ ...p, teamAbbreviation: team.abbreviation }));
  }, [game, activeTab]);

  const availablePositions = useMemo(
    () => Array.from(new Set(rosterPlayers.map((p) => p.position).filter(Boolean))).sort(),
    [rosterPlayers],
  );

  const visiblePlayers = useMemo(() => {
    let base = rosterPlayers;
    if (positionFilter !== "all") base = base.filter((p) => p.position === positionFilter);
    if (favoritesOnly) base = base.filter((p) => favorites.isFavorite(p.id));

    const sorted = [...base];

    // Apply user sort first.
    if (sortKey) {
      sorted.sort((a, b) => compareBySort(a, b, sortKey, sortDir));
    }

    // Favorites bubble to the very top regardless of sort column.
    sorted.sort((a, b) => {
      const aFav = favorites.isFavorite(a.id) ? 1 : 0;
      const bFav = favorites.isFavorite(b.id) ? 1 : 0;
      return bFav - aFav;
    });

    // OUT/DNP/Inactive/Not-in-lineup always sink to the bottom, regardless
    // of the sort column or favorite status above (both stable, so order
    // within each group is preserved).
    if (game) {
      sorted.sort((a, b) => {
        const aTier = playerSortTier(a, game.status, false);
        const bTier = playerSortTier(b, game.status, false);
        return aTier - bTier;
      });
    }

    return sorted;
  }, [rosterPlayers, positionFilter, favorites, favoritesOnly, sortKey, sortDir, game]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (game === null) {
    return (
      <MobileLayout showBack title="Loading">
        <div className="p-8 text-center text-muted-foreground">Loading game...</div>
      </MobileLayout>
    );
  }

  if (!game) {
    return (
      <MobileLayout showBack title="Not Found">
        <div className="p-8 text-center text-muted-foreground">Game not found</div>
      </MobileLayout>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <MobileLayout showBack title={`${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation}`}>

      {/* Scoreboard Header */}
      <div className="bg-gradient-to-b from-card to-card/80 border-b border-border px-6 py-6 sm:px-8 sm:py-8 flex flex-col items-center gap-4">
        {/* Status / period row */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              <span className="text-[11px] font-black uppercase tracking-widest text-primary">
                {game.period}{game.clock ? ` · ${game.clock}` : ""}
              </span>
            </>
          ) : (
            <div className="text-xs font-bold tracking-widest text-muted-foreground uppercase px-2.5 py-1 rounded-full bg-muted/40">
              {game.status === "scheduled" ? (game.startTime || "Scheduled") : (game.period || "Final")}
              {game.status !== "scheduled" && game.clock && ` · ${game.clock}`}
            </div>
          )}
        </div>

        {/* Teams + scores */}
        {(() => {
          const awayScore = game.awayTeam.score;
          const homeScore = game.homeTeam.score;
          const isFinal = game.status === "final";
          const awayWon = isFinal && (awayScore ?? 0) > (homeScore ?? 0);
          const homeWon = isFinal && (homeScore ?? 0) > (awayScore ?? 0);
          const awayLeading = isLive && (awayScore ?? 0) > (homeScore ?? 0);
          const homeLeading = isLive && (homeScore ?? 0) > (awayScore ?? 0);
          const hasScores = awayScore !== null && homeScore !== null;
          return (
            <div className="flex items-center justify-center gap-4 sm:gap-6 w-full max-w-xs">
              {/* Away team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-base sm:text-lg font-black shrink-0 border-2 transition-colors ${
                  awayWon ? "bg-foreground text-background border-foreground" :
                  awayLeading ? "bg-primary/15 text-primary border-primary/40" :
                  "bg-muted/50 text-foreground/80 border-border"
                }`}>
                  {game.awayTeam.abbreviation}
                </div>
                <div className="text-center">
                  {hasScores ? (
                    <span className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                      awayWon || awayLeading ? "text-foreground" : "text-foreground/60"
                    }`}>
                      {awayScore}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground/60">–</span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground/60 text-center truncate max-w-[80px]">
                  {game.awayTeam.abbreviation} · Away
                </span>
              </div>

              {/* Center divider */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                {hasScores && (
                  <div className="text-2xl font-black text-border">:</div>
                )}
                {!hasScores && (
                  <div className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider">vs</div>
                )}
              </div>

              {/* Home team */}
              <div className="flex flex-col items-center gap-2 flex-1">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-base sm:text-lg font-black shrink-0 border-2 transition-colors ${
                  homeWon ? "bg-foreground text-background border-foreground" :
                  homeLeading ? "bg-primary/15 text-primary border-primary/40" :
                  "bg-muted/50 text-foreground/80 border-border"
                }`}>
                  {game.homeTeam.abbreviation}
                </div>
                <div className="text-center">
                  {hasScores ? (
                    <span className={`text-3xl sm:text-4xl font-black tabular-nums tracking-tight ${
                      homeWon || homeLeading ? "text-foreground" : "text-foreground/60"
                    }`}>
                      {homeScore}
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground/60">–</span>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground/60 text-center truncate max-w-[80px]">
                  {game.homeTeam.abbreviation} · Home
                </span>
              </div>
            </div>
          );
        })()}

        {/* Last updated / stale indicator */}
        {isStale && isLive ? (
          <p className="text-[10px] text-amber-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Reconnecting…
          </p>
        ) : lastUpdated ? (
          <p className="text-[10px] text-muted-foreground/60">
            {isLive ? "Auto-updating · " : ""}Updated {formatTime(lastUpdated)}
          </p>
        ) : null}

        <div className="mt-5 w-full max-w-[280px] sm:max-w-sm grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Link href={`/${game.league}/game/${game.id}/optimizer`}>
            <div className="rounded-xl bg-primary text-primary-foreground border border-primary-border py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20" /><path d="M2 12h20" /><circle cx="12" cy="12" r="10" />
              </svg>
              Fantasy Optimizer
            </div>
          </Link>
          <Link href={`/${game.league}/game/${game.id}/plays`}>
            <div className="rounded-xl bg-secondary text-secondary-foreground border border-secondary-border py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h7" />
              </svg>
              Play-by-Play
            </div>
          </Link>
        </div>
      </div>

      {/* Pre-Game Intelligence — replaces the (otherwise empty) roster
          table while the game hasn't started, so users see who's likely
          starting/injured without leaving this page. */}
      {game.status === "scheduled" ? (
        <PregameIntelPanel game={game} league={league} lastUpdated={lastUpdated} />
      ) : (
        <>
      {/* Team Tabs */}
      <div className="flex border-b border-border bg-background sticky top-0 z-10">
        {(["away", "home", "all"] as BoxScoreTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${tab === "all" ? "w-16 shrink-0" : "flex-1"} py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "all" ? "All" : tab === "away" ? game.awayTeam.name : game.homeTeam.name}
          </button>
        ))}
      </div>

      {/* Position filter */}
      {availablePositions.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-background overflow-x-auto whitespace-nowrap">
          <button
            type="button"
            onClick={() => setPositionFilter("all")}
            className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors shrink-0 ${positionFilter === "all" ? "bg-primary text-primary-foreground border-primary-border" : "border-border text-muted-foreground hover:bg-muted/40"}`}
          >
            All
          </button>
          {availablePositions.map((position) => (
            <button
              key={position}
              type="button"
              onClick={() => setPositionFilter(position)}
              className={`text-xs font-semibold rounded-full px-3 py-1 border transition-colors shrink-0 ${positionFilter === position ? "bg-primary text-primary-foreground border-primary-border" : "border-border text-muted-foreground hover:bg-muted/40"}`}
            >
              {position}
            </button>
          ))}
        </div>
      )}

      {/* Favorites filter */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background">
        <span className="text-xs font-medium text-muted-foreground">Favorites only</span>
        <button
          type="button"
          role="switch"
          aria-checked={favoritesOnly}
          onClick={() => setFavoritesOnly((v) => !v)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${favoritesOnly ? "bg-primary" : "bg-muted"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${favoritesOnly ? "translate-x-4" : "translate-x-0"}`} />
        </button>
      </div>

      {/* Sort hint */}
      {sortKey && (
        <div className="px-4 py-1.5 bg-muted/20 border-b border-border flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            Sorted by <strong className="text-foreground">{sortKey.toUpperCase()}</strong>{" "}
            ({sortDir === "desc" ? "highest first" : "lowest first"})
          </span>
          <button
            type="button"
            onClick={() => setSortKey(null)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Stats Table */}
      <div className="w-full overflow-x-auto bg-card pb-12">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-muted-foreground bg-muted/40 uppercase sticky top-0">
            <tr>
              <th className="px-2 py-3 font-medium text-center w-10">★</th>
              <th className="px-4 py-3 font-medium sticky left-10 bg-muted/95 z-10 shadow-[1px_0_0_0_var(--color-border)] min-w-[140px]">Player</th>
              <SortTh label="MIN" sortKey="min"  activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="FPTS" sortKey="fpts" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 font-medium text-right">L5</th>
              <SortTh label="PTS" sortKey="pts"  activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="REB" sortKey="reb"  activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="AST" sortKey="ast"  activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="STL" sortKey="stl"  activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="BLK" sortKey="blk"  activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh label="TO"  sortKey="to"   activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th className="px-3 py-3 font-medium text-center">Compare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visiblePlayers.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-10 text-center text-sm">
                  {rosterPlayers.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <p>
                        {league === "nznbl"
                          ? "NZ NBL box scores come from TheSportsDB, which doesn't include player stats in the free tier."
                          : league === "fiba"
                            ? "Player stats aren't available for this FIBA event."
                            : "Live player stats aren't available for this data source."}
                      </p>
                      {league === "nznbl" && (
                        <p className="text-xs text-muted-foreground/60">
                          Team scores and game schedules are still available above.
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">No players match the current filters.</span>
                  )}
                </td>
              </tr>
            ) : (
              visiblePlayers.map((player) => {
                const fpts = calculateFantasyPoints(player.stats);
                const isComparing = comparison.isSelected(player.id);
                const disableAdd = comparison.isFull && !isComparing;
                const isFavorite = favorites.isFavorite(player.id);
                const form = recentForm.getForm(player.id);
                return (
                  <tr key={player.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-3 text-center">
                      <StarButton
                        active={isFavorite}
                        onToggle={() => favorites.toggleFavorite(player.id)}
                        label={isFavorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
                      />
                    </td>
                    <td className="px-4 py-3 sticky left-10 bg-card z-10 shadow-[1px_0_0_0_var(--color-border)]">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailPlayer(player)}
                            className="font-semibold text-foreground truncate max-w-[110px] text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                          >
                            {player.name}
                          </button>
                          <PlayerStatusBadges player={player} gameStatus={game.status} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          #{player.number} • {player.position}
                          {activeTab === "all" && ` • ${player.teamAbbreviation}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{player.stats.minutes ?? "-"}</td>
                    <td className="px-3 py-3 text-right font-bold text-primary tabular-nums">{fpts.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right"><RecentFormBadge entries={form} /></td>
                    <td className="px-3 py-3 text-right tabular-nums">{player.stats.points}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{player.stats.rebounds}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{player.stats.assists}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{player.stats.steals}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{player.stats.blocks}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{player.stats.turnovers}</td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        disabled={disableAdd}
                        onClick={() => comparison.toggle(player.id)}
                        className={`text-xs font-semibold rounded-md px-2.5 py-1 border transition-colors ${isComparing ? "bg-primary text-primary-foreground border-primary-border" : disableAdd ? "border-border text-muted-foreground opacity-50 cursor-not-allowed" : "border-border text-foreground hover:bg-muted/40"}`}
                      >
                        {isComparing ? "Added" : "Compare"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      <CompareBar league={game.league} gameId={game.id} count={comparison.selectedIds.length} />

      {detailPlayer && (
        <PlayerDetailSheet
          player={detailPlayer}
          teamAbbreviation={detailPlayer.teamAbbreviation}
          gameStatus={game.status}
          recentForm={recentForm.getForm(detailPlayer.id)}
          onClose={() => setDetailPlayer(null)}
          league={game.league}
        />
      )}
    </MobileLayout>
  );
}
