import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { CompareBar } from "../components/compare-bar";
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
import { useComparisonSelection } from "../hooks/use-comparison-selection";
import { Game, Player } from "../lib/types";

type SortKey = "fpts" | "points" | "rebounds" | "assists" | "credits";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "fpts", label: "Fantasy Points" },
  { value: "points", label: "Points" },
  { value: "rebounds", label: "Rebounds" },
  { value: "assists", label: "Assists" },
  { value: "credits", label: "Credits" },
];

type OptimizerPlayer = Player & {
  teamAbbreviation: string;
  fpts: number;
};

export default function FantasyOptimizer() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as "nba" | "wnba";

  const [game, setGame] = useState<Game | null | undefined>(null);
  const [budget, setBudget] = useState<number>(DEFAULT_FANTASY_BUDGET);
  const [credits, setCredits] = useState<Record<string, number | undefined>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fpts");
  const comparison = useComparisonSelection(gameId);

  useEffect(() => {
    setBudget(getStoredBudget());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    setSelected(new Set());
    fetchGameById(gameId || "", league).then((data) => {
      if (cancelled) return;
      const loadedGame = (data as Game | undefined) ?? undefined;
      setGame(loadedGame ?? undefined);

      if (loadedGame) {
        const allPlayers = [...loadedGame.awayTeam.players, ...loadedGame.homeTeam.players];
        const initialCredits: Record<string, number | undefined> = {};
        for (const player of allPlayers) {
          initialCredits[player.id] = getStoredPlayerCredits(player.id);
        }
        setCredits(initialCredits);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, league]);

  const players: OptimizerPlayer[] = useMemo(() => {
    if (!game) return [];
    const away = game.awayTeam.players.map((p) => ({
      ...p,
      teamAbbreviation: game.awayTeam.abbreviation,
      fpts: calculateFantasyPoints(p.stats),
    }));
    const home = game.homeTeam.players.map((p) => ({
      ...p,
      teamAbbreviation: game.homeTeam.abbreviation,
      fpts: calculateFantasyPoints(p.stats),
    }));
    return [...away, ...home];
  }, [game]);

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? players.filter((p) => p.name.toLowerCase().includes(query))
      : players;

    const withCredits = filtered.map((p) => ({
      ...p,
      credits: credits[p.id] ?? 0,
    }));

    const sorted = [...withCredits].sort((a, b) => {
      switch (sortKey) {
        case "points":
          return b.stats.points - a.stats.points;
        case "rebounds":
          return b.stats.rebounds - a.stats.rebounds;
        case "assists":
          return b.stats.assists - a.stats.assists;
        case "credits":
          return b.credits - a.credits;
        case "fpts":
        default:
          return b.fpts - a.fpts;
      }
    });

    return sorted;
  }, [players, credits, search, sortKey]);

  const handleBudgetChange = (value: string) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setBudget(next);
    setStoredBudget(next);
  };

  const handleCreditsChange = (playerId: string, value: string) => {
    if (value.trim() === "") {
      setCredits((prev) => ({ ...prev, [playerId]: undefined }));
      clearStoredPlayerCredits([playerId]);
      return;
    }
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    setCredits((prev) => ({ ...prev, [playerId]: next }));
    setStoredPlayerCredits(playerId, next);
  };

  const handleResetCredits = () => {
    const playerIds = players.map((p) => p.id);
    clearStoredPlayerCredits(playerIds);
    setCredits((prev) => {
      const next = { ...prev };
      for (const id of playerIds) {
        next[id] = undefined;
      }
      return next;
    });
  };

  const toggleSelected = (playerId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const selectedPlayers = players.filter((p) => selected.has(p.id));
  const totalCreditsUsed = selectedPlayers.reduce(
    (sum, p) => sum + (credits[p.id] ?? 0),
    0,
  );
  const remainingCredits = budget - totalCreditsUsed;
  const totalFantasyPoints = selectedPlayers.reduce((sum, p) => sum + p.fpts, 0);

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

  return (
    <MobileLayout showBack title="Fantasy Optimizer">
      <div className="flex flex-col">
        {/* Game context + budget */}
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

          <button
            type="button"
            onClick={handleResetCredits}
            className="self-start text-xs font-semibold text-destructive border border-destructive-border rounded-md px-3 py-1.5 active:scale-[0.98] transition-transform"
          >
            Reset Credits
          </button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-px bg-border sticky top-0 z-10">
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Selected Players
            </span>
            <span className="text-xl font-bold tabular-nums">{selectedPlayers.length}</span>
          </div>
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Credits Used
            </span>
            <span className="text-xl font-bold tabular-nums">{totalCreditsUsed}</span>
          </div>
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Remaining
            </span>
            <span
              className={`text-xl font-bold tabular-nums ${remainingCredits < 0 ? "text-destructive" : "text-primary"}`}
            >
              {remainingCredits}
            </span>
          </div>
          <div className="bg-card p-3 flex flex-col gap-1">
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              Total FPTS
            </span>
            <span className="text-xl font-bold tabular-nums">{totalFantasyPoints.toFixed(1)}</span>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="p-4 flex flex-col gap-3 bg-background">
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
        </div>

        {/* Player list */}
        <div className="flex flex-col gap-2 px-4 pb-12">
          {visiblePlayers.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No players found.</div>
          ) : (
            visiblePlayers.map((player) => {
              const isSelected = selected.has(player.id);
              return (
                <div
                  key={player.id}
                  onClick={() => toggleSelected(player.id)}
                  className={`rounded-xl border p-3 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:bg-muted/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelected(player.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4 shrink-0 rounded-sm border border-primary accent-primary"
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground truncate">{player.name}</span>
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground shrink-0">
                        {player.teamAbbreviation}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{player.number} • {player.position}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground tabular-nums">
                      <span>{player.stats.points} PTS</span>
                      <span>{player.stats.rebounds} REB</span>
                      <span>{player.stats.assists} AST</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-sm font-bold text-primary tabular-nums">
                      {player.fpts.toFixed(1)} FPTS
                    </span>
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
