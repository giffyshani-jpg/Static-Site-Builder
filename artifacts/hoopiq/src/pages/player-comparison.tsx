import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { StarButton } from "../components/star-button";
import { PlayerStatusBadges } from "../components/player-status-badges";
import { PlayerDetailSheet } from "../components/player-detail-sheet";
import { fetchGameById } from "../api";
import { calculateFantasyPoints } from "../lib/stats";
import { useComparisonSelection } from "../hooks/use-comparison-selection";
import { useFavorites } from "../hooks/use-favorites";
import { useRecentForm } from "../hooks/use-recent-form";
import { Game, Player } from "../lib/types";

type ComparePlayer = Player & {
  teamAbbreviation: string;
  fpts: number;
};

type StatRow = {
  key: string;
  label: string;
  getValue: (p: ComparePlayer) => number | null;
  getDisplay: (p: ComparePlayer) => string;
  // If true, the row is only rendered when at least one compared player
  // has a non-null value for it (used for stats ESPN doesn't always
  // provide, like plus/minus).
  optional?: boolean;
};

function parseMadeCount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const made = parseInt(raw.split("-")[0], 10);
  return Number.isFinite(made) ? made : null;
}

const STAT_ROWS: StatRow[] = [
  {
    key: "minutes",
    label: "Minutes",
    getValue: (p) => (p.stats.minutes ? parseFloat(p.stats.minutes) : null),
    getDisplay: (p) => p.stats.minutes ?? "-",
  },
  {
    key: "fpts",
    label: "Fantasy Points",
    getValue: (p) => p.fpts,
    getDisplay: (p) => p.fpts.toFixed(1),
  },
  {
    key: "points",
    label: "Points",
    getValue: (p) => p.stats.points,
    getDisplay: (p) => String(p.stats.points),
  },
  {
    key: "rebounds",
    label: "Rebounds",
    getValue: (p) => p.stats.rebounds,
    getDisplay: (p) => String(p.stats.rebounds),
  },
  {
    key: "assists",
    label: "Assists",
    getValue: (p) => p.stats.assists,
    getDisplay: (p) => String(p.stats.assists),
  },
  {
    key: "steals",
    label: "Steals",
    getValue: (p) => p.stats.steals,
    getDisplay: (p) => String(p.stats.steals),
  },
  {
    key: "blocks",
    label: "Blocks",
    getValue: (p) => p.stats.blocks,
    getDisplay: (p) => String(p.stats.blocks),
  },
  {
    key: "turnovers",
    label: "Turnovers",
    getValue: (p) => p.stats.turnovers,
    getDisplay: (p) => String(p.stats.turnovers),
  },
  {
    key: "fg",
    label: "FG (M/A)",
    getValue: (p) => parseMadeCount(p.stats.fieldGoals),
    getDisplay: (p) => p.stats.fieldGoals ?? "-",
  },
  {
    key: "3pt",
    label: "3PT (M/A)",
    getValue: (p) => parseMadeCount(p.stats.threePointers),
    getDisplay: (p) => p.stats.threePointers ?? "-",
  },
  {
    key: "ft",
    label: "FT (M/A)",
    getValue: (p) => parseMadeCount(p.stats.freeThrows),
    getDisplay: (p) => p.stats.freeThrows ?? "-",
  },
  {
    key: "plusMinus",
    label: "Plus/Minus",
    getValue: (p) => (typeof p.stats.plusMinus === "number" ? p.stats.plusMinus : null),
    getDisplay: (p) =>
      typeof p.stats.plusMinus === "number"
        ? p.stats.plusMinus > 0
          ? `+${p.stats.plusMinus}`
          : String(p.stats.plusMinus)
        : "-",
    optional: true,
  },
];

const PLAYER_COL_WIDTH = 140;
const LABEL_COL_WIDTH = 116;

export default function PlayerComparison() {
  const params = useParams();
  const gameId = params.id;
  const league = params.league as import("../lib/types").LeagueKey;

  const [game, setGame] = useState<Game | null | undefined>(null);
  const comparison = useComparisonSelection(gameId);
  const favorites = useFavorites();
  const recentForm = useRecentForm();
  const [detailPlayer, setDetailPlayer] = useState<ComparePlayer | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    fetchGameById(gameId || "", league).then((data) => {
      if (!cancelled) setGame((data as Game | undefined) ?? undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, league]);

  const allPlayers: ComparePlayer[] = useMemo(() => {
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

  const comparedPlayers = useMemo(
    () =>
      comparison.selectedIds
        .map((id) => allPlayers.find((p) => p.id === id))
        .filter((p): p is ComparePlayer => Boolean(p)),
    [comparison.selectedIds, allPlayers],
  );

  const visibleRows = useMemo(
    () =>
      STAT_ROWS.filter((row) => {
        if (!row.optional) return true;
        return comparedPlayers.some((p) => row.getValue(p) !== null);
      }),
    [comparedPlayers],
  );

  if (game === null) {
    return (
      <MobileLayout showBack title="Compare Players">
        <div className="p-8 text-center text-muted-foreground">Loading game...</div>
      </MobileLayout>
    );
  }

  if (!game) {
    return (
      <MobileLayout showBack title="Compare Players">
        <div className="p-8 text-center text-muted-foreground">Game not found</div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout showBack title="Compare Players">
      <div className="flex flex-col h-full">
        <div className="p-4 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="text-sm font-semibold text-foreground">
            {game.awayTeam.abbreviation} @ {game.homeTeam.abbreviation}
          </div>
          <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {comparedPlayers.length}/4 selected
          </div>
        </div>

        {comparedPlayers.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-muted-foreground text-sm">
              No players selected yet. Go back and tap "Compare" on up to 4 players from either
              team.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `${LABEL_COL_WIDTH}px repeat(${comparedPlayers.length}, ${PLAYER_COL_WIDTH}px)`,
              }}
            >
              {/* Header row: sticky top, corner cell also sticky left */}
              <div className="sticky top-0 left-0 z-30 bg-muted/95 border-b border-r border-border" />
              {comparedPlayers.map((player) => {
                const isFavorite = favorites.isFavorite(player.id);
                return (
                  <div
                    key={player.id}
                    className="sticky top-0 z-20 bg-muted/95 border-b border-border px-2 py-2 flex flex-col items-center gap-1"
                  >
                    <div className="self-stretch flex items-center justify-between -mt-1 -mr-1">
                      <StarButton
                        active={isFavorite}
                        onToggle={() => favorites.toggleFavorite(player.id)}
                        label={isFavorite ? `Unfavorite ${player.name}` : `Favorite ${player.name}`}
                        size={14}
                      />
                      <button
                        type="button"
                        onClick={() => comparison.remove(player.id)}
                        aria-label={`Remove ${player.name} from comparison`}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailPlayer(player)}
                      className="text-xs font-bold text-foreground text-center leading-tight truncate w-full hover:text-primary hover:underline underline-offset-2 transition-colors"
                    >
                      {player.name}
                    </button>
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {player.teamAbbreviation} • #{player.number}
                    </span>
                    {game && <PlayerStatusBadges player={player} gameStatus={game.status} />}
                  </div>
                );
              })}

              {/* Stat rows */}
              {visibleRows.map((row) => {
                const values = comparedPlayers.map((p) => row.getValue(p));
                const numericValues = values.filter((v): v is number => v !== null);
                const maxValue =
                  comparedPlayers.length > 1 && numericValues.length > 0
                    ? Math.max(...numericValues)
                    : null;

                return (
                  <React.Fragment key={row.key}>
                    <div className="sticky left-0 z-10 bg-card border-b border-r border-border px-3 py-3 text-xs font-semibold text-muted-foreground uppercase flex items-center">
                      {row.label}
                    </div>
                    {comparedPlayers.map((player, idx) => {
                      const value = values[idx];
                      const isHighest = maxValue !== null && value !== null && value === maxValue;
                      return (
                        <div
                          key={player.id}
                          className={`border-b border-border px-2 py-3 text-sm text-center tabular-nums flex items-center justify-center ${
                            isHighest ? "bg-primary/10 text-primary font-bold" : "text-foreground"
                          }`}
                        >
                          {row.getDisplay(player)}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {detailPlayer && game && (
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
