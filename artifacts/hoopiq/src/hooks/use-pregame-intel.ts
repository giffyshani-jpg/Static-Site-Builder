// Orchestrates Pre-Game Intelligence for one scheduled game: builds a
// rotation-ish player list per team, layers on the real pregame injury
// report, and computes projected minutes / recommendation badges from
// each player's real ESPN game log.
//
// Network cost is kept sane: the "expensive" lookups (each team's
// schedule, its most recent completed game, and every rotation player's
// game log) run once per game and are cached (game logs already have a
// 45-min cache — see lib/game-log-cache.ts). The 60-second refresh only
// re-fetches the target game itself (injuries + a newly-published box
// score), then cheaply recomputes lineup status / recommendations from
// data already in hand.

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGameById, fetchPlayerGameLog, fetchTeamSchedule } from "../api";
import { computeGameLogMetrics } from "../lib/game-log-metrics";
import {
  buildLineupStatus,
  buildTeamAvailabilitySummary,
  computeRecommendation,
  deriveBlowoutRisk,
  findPreviousCompletedGameId,
  isBackToBack,
  projectMinutes,
  PregamePlayerIntel,
  TeamAvailabilitySummary,
} from "../lib/pregame-intel";
import { minutesValue } from "../lib/player-status";
import { Game, Player, PlayerGameLogEntry, TeamScheduleEntry } from "../lib/types";

const MAX_ROTATION_PLAYERS_PER_TEAM = 10;
const ROTATION_MINUTES_THRESHOLD = 8;

type RotationBaselinePlayer = {
  player: Player;
  wasStarterLastGame: boolean;
  lastGameMinutes: number;
};

type TeamBaseline = {
  teamId: string;
  backToBack: boolean;
  rotation: RotationBaselinePlayer[];
};

type PlayerMetrics = {
  avgMinutesLast5: number | null;
  avgMinutesLast10: number | null;
  avgFptsLast5: number | null;
  avgFptsLast10: number | null;
  minutesTrend: "up" | "down" | "flat" | null;
  formTrend: "Hot" | "Average" | "Cold";
  consistency: "Consistent" | "Somewhat Consistent" | "Volatile" | null;
};

/** Builds the "who played / started last time" baseline for one team. */
async function buildTeamBaseline(
  league: "nba" | "wnba",
  teamId: string,
  gameDateIso: string,
): Promise<TeamBaseline> {
  const schedule = (await fetchTeamSchedule(teamId, league)) as TeamScheduleEntry[];
  const backToBack = isBackToBack(schedule, gameDateIso);
  const prevGameId = findPreviousCompletedGameId(schedule, gameDateIso);

  if (!prevGameId) {
    return { teamId, backToBack, rotation: [] };
  }

  const prevGame = (await fetchGameById(prevGameId, league)) as Game | undefined;
  if (!prevGame) return { teamId, backToBack, rotation: [] };

  const team = prevGame.homeTeam.id === teamId ? prevGame.homeTeam : prevGame.awayTeam;
  const rotation = team.players
    .filter((p) => p.starter === true || minutesValue(p.stats) >= ROTATION_MINUTES_THRESHOLD)
    .map((p) => ({ player: p, wasStarterLastGame: p.starter === true, lastGameMinutes: minutesValue(p.stats) }))
    .sort((a, b) => b.lastGameMinutes - a.lastGameMinutes)
    .slice(0, MAX_ROTATION_PLAYERS_PER_TEAM);

  return { teamId, backToBack, rotation };
}

async function fetchPlayerMetrics(playerId: string, league: "nba" | "wnba"): Promise<PlayerMetrics> {
  const games = (await fetchPlayerGameLog(playerId, league)) as PlayerGameLogEntry[];
  const metrics = computeGameLogMetrics(games);
  return {
    avgMinutesLast5: metrics.avgMinutesLast5,
    avgMinutesLast10: metrics.avgMinutesLast10,
    avgFptsLast5: metrics.avgFptsLast5,
    avgFptsLast10: metrics.avgFptsLast10,
    minutesTrend: metrics.minutesTrend,
    formTrend: metrics.trend,
    consistency: metrics.consistency,
  };
}

export type PregameIntelState = {
  /** null while loading, otherwise the built intel (possibly empty arrays). */
  away: PregamePlayerIntel[] | null;
  home: PregamePlayerIntel[] | null;
  awayAvailability: TeamAvailabilitySummary | null;
  homeAvailability: TeamAvailabilitySummary | null;
  blowoutRisk: ReturnType<typeof deriveBlowoutRisk>;
};

/**
 * Builds Pre-Game Intelligence for a scheduled game. Does nothing (all
 * null) once the game is no longer scheduled — box-score.tsx switches
 * back to its normal live/final rendering at that point, which already
 * has real confirmed data.
 */
export function usePregameIntel(game: Game | null | undefined, league: "nba" | "wnba"): PregameIntelState {
  const [baselines, setBaselines] = useState<Record<string, TeamBaseline> | null>(null);
  const [metricsByPlayerId, setMetricsByPlayerId] = useState<Record<string, PlayerMetrics>>({});
  const loadedForGameId = useRef<string | null>(null);

  const shouldLoad = !!game && game.status === "scheduled";

  // Heavy, one-time-per-game lookups: team schedules, each team's most
  // recent completed game, and every rotation player's game log.
  useEffect(() => {
    if (!shouldLoad || !game) return;
    if (loadedForGameId.current === game.id) return;
    loadedForGameId.current = game.id;

    let cancelled = false;

    (async () => {
      const gameDateIso = game.startTimeIso ?? new Date().toISOString();
      const [awayBaseline, homeBaseline] = await Promise.all([
        buildTeamBaseline(league, game.awayTeam.id, gameDateIso),
        buildTeamBaseline(league, game.homeTeam.id, gameDateIso),
      ]);
      if (cancelled) return;

      setBaselines({ [game.awayTeam.id]: awayBaseline, [game.homeTeam.id]: homeBaseline });

      const rotationPlayers = [...awayBaseline.rotation, ...homeBaseline.rotation];
      // Also pull metrics for anyone on the injury report who isn't
      // already in the rotation baseline (e.g. a long-term injury who
      // wouldn't show up in "last game played").
      const injuryOnlyIds = new Set(
        (game.injuryReport ?? [])
          .map((i) => i.playerId)
          .filter((id) => !rotationPlayers.some((r) => r.player.id === id)),
      );

      const allIds = [...new Set([...rotationPlayers.map((r) => r.player.id), ...injuryOnlyIds])];
      const metricsEntries = await Promise.all(
        allIds.map(async (id) => [id, await fetchPlayerMetrics(id, league)] as const),
      );
      if (cancelled) return;
      setMetricsByPlayerId(Object.fromEntries(metricsEntries));
    })();

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, game?.id, game?.awayTeam.id, game?.homeTeam.id, league]);

  const built = useMemo(() => {
    if (!shouldLoad || !game || !baselines) {
      return { away: null, home: null, awayAvailability: null, homeAvailability: null, blowoutRisk: undefined as
        ReturnType<typeof deriveBlowoutRisk> };
    }

    const blowoutRisk = deriveBlowoutRisk(game.pregameOdds?.spread ?? null);
    const resolvedBaselines = baselines;

    function buildTeamIntel(teamId: string, teamAbbreviation: string): PregamePlayerIntel[] {
      const baseline = resolvedBaselines[teamId];
      if (!baseline) return [];

      const currentTeam = game!.homeTeam.id === teamId ? game!.homeTeam : game!.awayTeam;
      const confirmedById = new Map(currentTeam.players.map((p) => [p.id, p]));
      const injuryById = new Map((game!.injuryReport ?? []).filter((i) => i.teamId === teamId).map((i) => [i.playerId, i]));

      const rotationIds = new Set(baseline.rotation.map((r) => r.player.id));
      const extraInjuryPlayers = [...injuryById.values()].filter((i) => !rotationIds.has(i.playerId));

      const entries: PregamePlayerIntel[] = [];

      for (const { player, wasStarterLastGame, lastGameMinutes } of baseline.rotation) {
        const injury = injuryById.get(player.id);
        const confirmed = confirmedById.get(player.id);
        const status = buildLineupStatus(injury?.status, confirmed?.starter, wasStarterLastGame);
        const metrics = metricsByPlayerId[player.id];
        const projectedMinutes = metrics
          ? projectMinutes(status, metrics, lastGameMinutes)
          : lastGameMinutes || null;

        entries.push({
          playerId: player.id,
          name: player.name,
          position: player.position,
          teamId,
          teamAbbreviation,
          status,
          injuryStatus: injury?.status,
          avgMinutesLast5: metrics?.avgMinutesLast5 ?? null,
          avgMinutesLast10: metrics?.avgMinutesLast10 ?? null,
          projectedMinutes,
          minutesTrend: metrics?.minutesTrend ?? null,
          avgFptsLast5: metrics?.avgFptsLast5 ?? null,
          avgFptsLast10: metrics?.avgFptsLast10 ?? null,
          formTrend: metrics?.formTrend ?? "Average",
          consistency: metrics?.consistency ?? null,
          recommendation: computeRecommendation({
            status,
            avgFptsLast5: metrics?.avgFptsLast5 ?? null,
            minutesTrend: metrics?.minutesTrend ?? null,
            backToBack: baseline.backToBack,
            blowoutRisk,
            isFavorite: game!.pregameOdds?.favoriteTeamId === teamId,
          }),
          backToBack: baseline.backToBack,
        });
      }

      for (const injury of extraInjuryPlayers) {
        const confirmed = confirmedById.get(injury.playerId);
        const status = buildLineupStatus(injury.status, confirmed?.starter, false);
        const metrics = metricsByPlayerId[injury.playerId];
        entries.push({
          playerId: injury.playerId,
          name: injury.name,
          position: injury.position,
          teamId,
          teamAbbreviation,
          status,
          injuryStatus: injury.status,
          avgMinutesLast5: metrics?.avgMinutesLast5 ?? null,
          avgMinutesLast10: metrics?.avgMinutesLast10 ?? null,
          projectedMinutes: status === "Out" ? 0 : (metrics ? projectMinutes(status, metrics, 0) : null),
          minutesTrend: metrics?.minutesTrend ?? null,
          avgFptsLast5: metrics?.avgFptsLast5 ?? null,
          avgFptsLast10: metrics?.avgFptsLast10 ?? null,
          formTrend: metrics?.formTrend ?? "Average",
          consistency: metrics?.consistency ?? null,
          recommendation: computeRecommendation({
            status,
            avgFptsLast5: metrics?.avgFptsLast5 ?? null,
            minutesTrend: metrics?.minutesTrend ?? null,
            backToBack: baseline.backToBack,
            blowoutRisk,
            isFavorite: game!.pregameOdds?.favoriteTeamId === teamId,
          }),
          backToBack: baseline.backToBack,
        });
      }

      // Confirmed/expected starters first, then bench, availability concerns last.
      const tierRank: Record<string, number> = {
        "Confirmed Starter": 0,
        "Expected Starter": 1,
        Questionable: 2,
        "Game Time Decision": 2,
        "Confirmed Bench": 3,
        Bench: 3,
        Out: 4,
      };
      entries.sort((a, b) => (tierRank[a.status] ?? 5) - (tierRank[b.status] ?? 5));
      return entries;
    }

    const away = buildTeamIntel(game.awayTeam.id, game.awayTeam.abbreviation);
    const home = buildTeamIntel(game.homeTeam.id, game.homeTeam.abbreviation);

    const awayAvailability = buildTeamAvailabilitySummary(away);
    const homeAvailability = buildTeamAvailabilitySummary(home);

    return { away, home, awayAvailability, homeAvailability, blowoutRisk };
  }, [shouldLoad, game, baselines, metricsByPlayerId]);

  return built;
}
