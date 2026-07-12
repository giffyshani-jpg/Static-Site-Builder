// Shared ESPN Site API engine.
//
// This is the ONLY file that knows about ESPN's undocumented public JSON
// endpoints (site.api.espn.com) and their response shapes. `nba.js` and
// `wnba.js` are thin, sport-parameterized wrappers around the functions
// exported here — api.js and the UI never see ESPN's raw shapes.
//
// Endpoints used:
//   Scoreboard: https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/scoreboard
//   Summary:    https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/summary?event={id}
//
// These are ESPN's own internal frontend endpoints, not an officially
// published/supported API. No API key is required and CORS is open
// (Access-Control-Allow-Origin: *), so they can be called directly from
// the browser, but the shape/availability is not guaranteed by ESPN.

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball";

// Maps ESPN's box-score stat abbreviations to our normalized PlayerStats
// fields. Extra recognized stats are kept on the object too (as bonus
// fields beyond the typed PlayerStats shape) since the UI only reads the
// six fantasy-relevant fields but the task asks us to parse everything
// available.
const STAT_ALIASES = {
  points: ["pts"],
  rebounds: ["reb"],
  assists: ["ast"],
  steals: ["stl"],
  blocks: ["blk"],
  turnovers: ["to"],
  minutes: ["min"],
  fieldGoals: ["fg"],
  threePointers: ["3pt"],
  freeThrows: ["ft"],
  offensiveRebounds: ["oreb"],
  defensiveRebounds: ["dreb"],
  personalFouls: ["pf"],
  plusMinus: ["+/-", "plusminus"],
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ESPN request failed (${response.status}): ${url}`);
  }
  return response.json();
}

function mapStatusState(statusType) {
  const state = statusType?.state;
  if (state === "pre") return "scheduled";
  if (state === "post") return "final";
  if (state === "in") return "in_progress";
  return "scheduled";
}

function formatStartTime(isoDate) {
  if (!isoDate) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(isoDate));
  } catch {
    return "";
  }
}

function formatPeriodLabel(league, status) {
  const state = status?.type?.state;
  if (state === "final" || status?.type?.completed) return "Final";
  if (state === "post") return "Final";
  const period = status?.period;
  if (!period) return status?.type?.shortDetail || "";
  // WNBA and NBA both use 4 quarters, but guard for OT.
  if (period > 4) return `OT${period - 4 > 1 ? period - 4 : ""}`;
  return `Q${period}`;
}

function parseStatValue(raw) {
  if (raw === undefined || raw === null) return 0;
  const num = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(num) ? num : 0;
}

/**
 * Builds a normalized stats object from ESPN's parallel `names`/`labels`
 * and per-athlete `stats` value arrays.
 */
function buildStatsFromNames(names, values) {
  const stats = {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
  };

  if (!Array.isArray(names) || !Array.isArray(values)) {
    return stats;
  }

  const lowerNames = names.map((name) => String(name || "").toLowerCase());

  for (const [field, aliases] of Object.entries(STAT_ALIASES)) {
    const idx = lowerNames.findIndex((name) => aliases.includes(name));
    if (idx === -1) continue;
    if (field === "minutes" || field === "fieldGoals" || field === "threePointers" || field === "freeThrows") {
      // Keep these as raw display strings (e.g. "7-12") rather than
      // coercing to a single number, since they're not part of the
      // fantasy formula and lose information if parsed as a float.
      stats[field] = values[idx] ?? null;
    } else {
      stats[field] = parseStatValue(values[idx]);
    }
  }

  return stats;
}

/**
 * Builds a normalized team-totals object from ESPN's
 * boxscore.teams[].statistics array of {name, label, displayValue}.
 */
function buildTeamTotals(statistics) {
  if (!Array.isArray(statistics)) return {};
  const totals = {};
  for (const stat of statistics) {
    const key = String(stat.name || stat.label || "").toLowerCase();
    if (!key) continue;
    totals[key] = stat.displayValue ?? stat.value ?? null;
  }
  return totals;
}

function parseTeamBasics(competitor, gameStatus) {
  const team = competitor?.team ?? {};
  const hasScore =
    gameStatus !== "scheduled" &&
    competitor?.score !== undefined &&
    competitor?.score !== null &&
    competitor?.score !== "";
  return {
    id: String(team.id ?? ""),
    name: team.displayName ?? team.name ?? team.abbreviation ?? "Unknown",
    abbreviation: team.abbreviation ?? "",
    score: hasScore ? Number(competitor.score) : null,
    players: [],
  };
}

/**
 * Normalizes a scoreboard `event` (today's games list) into our Game
 * shape. Scoreboard responses don't include box scores, so `players`
 * stays empty here — full player stats are only fetched per-game via
 * getGame/summary.
 */
function normalizeScoreboardEvent(league, event) {
  const competition = event.competitions?.[0];
  const status = event.status ?? competition?.status;
  const competitors = competition?.competitors ?? [];

  const awayCompetitor = competitors.find((c) => c.homeAway === "away");
  const homeCompetitor = competitors.find((c) => c.homeAway === "home");

  const gameStatus = mapStatusState(status?.type);

  return {
    id: String(event.id),
    league,
    homeTeam: parseTeamBasics(homeCompetitor, gameStatus),
    awayTeam: parseTeamBasics(awayCompetitor, gameStatus),
    startTime: formatStartTime(event.date),
    status: gameStatus,
    period: formatPeriodLabel(league, status),
    clock: gameStatus === "in_progress" ? status?.displayClock : undefined,
  };
}

/**
 * Normalizes play-by-play entries from a summary response's `plays`
 * array (if present) into a lightweight, UI-agnostic shape.
 */
function normalizePlayByPlay(plays) {
  if (!Array.isArray(plays)) return [];
  return plays.map((play) => ({
    id: String(play.id ?? ""),
    description: play.text ?? "",
    period: play.period?.displayValue ?? (play.period?.number ? `Q${play.period.number}` : ""),
    clock: play.clock?.displayValue ?? "",
    awayScore: play.awayScore ?? null,
    homeScore: play.homeScore ?? null,
    scoringPlay: Boolean(play.scoringPlay),
    teamId: play.team?.id ? String(play.team.id) : null,
  }));
}

/**
 * Builds full Player[] rosters (with box score stats) for both teams
 * from a summary response's `boxscore.players` array, keyed by team id.
 */
function buildPlayersByTeamId(boxscorePlayers) {
  const byTeamId = {};
  if (!Array.isArray(boxscorePlayers)) return byTeamId;

  for (const teamBlock of boxscorePlayers) {
    const teamId = String(teamBlock.team?.id ?? "");
    const players = [];

    for (const statGroup of teamBlock.statistics ?? []) {
      const names = statGroup.names ?? statGroup.labels ?? [];
      for (const athleteEntry of statGroup.athletes ?? []) {
        const athlete = athleteEntry.athlete ?? {};
        players.push({
          id: String(athlete.id ?? `${teamId}-${players.length}`),
          name: athlete.displayName ?? athlete.shortName ?? "Unknown",
          number: athlete.jersey ?? "",
          position: athlete.position?.abbreviation ?? "",
          stats: buildStatsFromNames(names, athleteEntry.stats),
        });
      }
    }

    byTeamId[teamId] = players;
  }

  return byTeamId;
}

/**
 * Builds { [teamId]: totalsObject } from a summary response's
 * `boxscore.teams` array.
 */
function buildTeamTotalsByTeamId(boxscoreTeams) {
  const byTeamId = {};
  if (!Array.isArray(boxscoreTeams)) return byTeamId;
  for (const teamBlock of boxscoreTeams) {
    const teamId = String(teamBlock.team?.id ?? "");
    byTeamId[teamId] = buildTeamTotals(teamBlock.statistics);
  }
  return byTeamId;
}

/**
 * Normalizes a full `summary` response (single game, with box score and
 * play-by-play) into our Game shape.
 */
function normalizeSummary(league, gameId, summary) {
  const headerCompetition = summary.header?.competitions?.[0];
  const status = headerCompetition?.status ?? summary.header?.status;
  const competitors = headerCompetition?.competitors ?? [];

  const awayCompetitor = competitors.find((c) => c.homeAway === "away");
  const homeCompetitor = competitors.find((c) => c.homeAway === "home");

  const playersByTeamId = buildPlayersByTeamId(summary.boxscore?.players);
  const totalsByTeamId = buildTeamTotalsByTeamId(summary.boxscore?.teams);

  const gameStatus = mapStatusState(status?.type);

  const awayTeam = parseTeamBasics(awayCompetitor, gameStatus);
  const homeTeam = parseTeamBasics(homeCompetitor, gameStatus);
  awayTeam.players = playersByTeamId[awayTeam.id] ?? [];
  homeTeam.players = playersByTeamId[homeTeam.id] ?? [];
  awayTeam.totals = totalsByTeamId[awayTeam.id] ?? {};
  homeTeam.totals = totalsByTeamId[homeTeam.id] ?? {};

  return {
    id: String(gameId),
    league,
    homeTeam,
    awayTeam,
    startTime: formatStartTime(headerCompetition?.date ?? summary.header?.date),
    status: gameStatus,
    period: formatPeriodLabel(league, status),
    clock: gameStatus === "in_progress" ? status?.displayClock : undefined,
    playByPlay: normalizePlayByPlay(summary.plays),
  };
}

/**
 * Fetches today's games for a given ESPN league slug ("nba" | "wnba").
 *
 * @param {"nba" | "wnba"} league
 * @returns {Promise<object[]>}
 */
export async function getTodayGames(league) {
  try {
    const data = await fetchJson(`${ESPN_BASE}/${league}/scoreboard`);
    const events = data.events ?? [];
    return events.map((event) => normalizeScoreboardEvent(league, event));
  } catch (error) {
    console.error(`[espn provider] failed to fetch ${league} scoreboard:`, error);
    return [];
  }
}

/**
 * Fetches a single game (full box score + play-by-play, if available)
 * for a given ESPN league slug ("nba" | "wnba").
 *
 * @param {"nba" | "wnba"} league
 * @param {string} gameId
 * @returns {Promise<object | undefined>}
 */
export async function getGame(league, gameId) {
  try {
    const data = await fetchJson(`${ESPN_BASE}/${league}/summary?event=${encodeURIComponent(gameId)}`);
    if (!data || (!data.header && !data.boxscore)) return undefined;
    return normalizeSummary(league, gameId, data);
  } catch (error) {
    console.error(`[espn provider] failed to fetch ${league} game ${gameId}:`, error);
    return undefined;
  }
}
