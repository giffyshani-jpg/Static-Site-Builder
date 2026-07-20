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
//   Game log:   https://site.web.api.espn.com/apis/common/v3/sports/basketball/{league}/athletes/{athleteId}/gamelog
//
// These are ESPN's own internal frontend endpoints, not an officially
// published/supported API. No API key is required and CORS is open
// (Access-Control-Allow-Origin: *), so they can be called directly from
// the browser, but the shape/availability is not guaranteed by ESPN.
//
// Game log limitation: the gamelog endpoint returns real per-game
// history (date, opponent, home/away, W/L, MIN/FG/3PT/FT/REB/AST/STL/
// BLK/PF/TO/PTS) keyed by athlete id — the same id already used for box
// score players, so no extra id-resolution step is needed. It does NOT
// include starter/bench status or plus/minus for historical games (both
// are only present in a specific game's live summary/box score) — the UI
// surfaces those as "unavailable" for past games rather than guessing.

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball";
const ESPN_GAMELOG_BASE = "https://site.web.api.espn.com/apis/common/v3/sports/basketball";

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
    // Raw ISO tipoff time, kept alongside the display-formatted
    // `startTime` above — Pre-Game Intelligence needs an actual
    // timestamp (e.g. for back-to-back detection), not just "7:30 PM".
    startTimeIso: event.date ?? null,
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
  return plays.map((play) => {
    const typeText = play.type?.text ?? "";
    return {
      id: String(play.id ?? ""),
      description: play.text ?? "",
      period: play.period?.displayValue ?? (play.period?.number ? `Q${play.period.number}` : ""),
      clock: play.clock?.displayValue ?? "",
      awayScore: play.awayScore ?? null,
      homeScore: play.homeScore ?? null,
      scoringPlay: Boolean(play.scoringPlay),
      isSubstitution: /substitution/i.test(typeText) || /substitution/i.test(play.text ?? ""),
      type: typeText,
      teamId: play.team?.id ? String(play.team.id) : null,
    };
  });
}

/**
 * Maps ESPN's injury `type`/`fantasyStatus` text to one of our four
 * canonical badge values. Returns undefined for anything unrecognized
 * so the UI simply hides the badge rather than showing something wrong.
 */
function normalizeInjuryStatus(injury) {
  const raw = String(
    injury?.details?.fantasyStatus?.description ||
      injury?.details?.fantasyStatus?.abbreviation ||
      injury?.type?.description ||
      injury?.status ||
      "",
  ).toLowerCase();

  if (raw.includes("out")) return "OUT";
  if (raw.includes("game-time") || raw.includes("gtd") || raw.includes("day-to-day")) return "GTD";
  if (raw.includes("question")) return "Questionable";
  if (raw.includes("probable")) return "Probable";
  return undefined;
}

/**
 * Builds { [athleteId]: injuryStatus } AND a flat, UI-friendly injury
 * report list from a summary response's top-level `injuries` array —
 * ESPN includes each team's injury report alongside the box score in the
 * same summary payload (available even pregame, before any box score is
 * published), so this needs no extra request.
 */
function buildInjuryReport(injuriesBlocks) {
  const byAthleteId = {};
  const list = [];
  if (!Array.isArray(injuriesBlocks)) return { byAthleteId, list };
  for (const teamBlock of injuriesBlocks) {
    const teamId = String(teamBlock.team?.id ?? "");
    for (const injury of teamBlock.injuries ?? []) {
      const athlete = injury.athlete ?? {};
      const athleteId = String(athlete.id ?? "");
      if (!athleteId) continue;
      const status = normalizeInjuryStatus(injury);
      if (!status) continue;
      byAthleteId[athleteId] = status;
      list.push({
        teamId,
        playerId: athleteId,
        name: athlete.displayName ?? athlete.shortName ?? "Unknown",
        position: athlete.position?.abbreviation ?? "",
        status,
      });
    }
  }
  return { byAthleteId, list };
}

/**
 * Parses ESPN's `pickcenter` betting-market block (first/primary
 * provider only) into a direction-agnostic spread magnitude plus which
 * team is favored. Returns null when no market is posted for this game
 * (e.g. far out from tipoff, or an unsupported league/book combo) — the
 * UI treats "no odds" as "blowout risk unknown", never a guess.
 */
function buildPregameOdds(pickcenter, homeTeamId, awayTeamId) {
  const entry = Array.isArray(pickcenter) ? pickcenter[0] : undefined;
  if (!entry || typeof entry.spread !== "number") return undefined;
  const favoriteTeamId = entry.homeTeamOdds?.favorite
    ? homeTeamId
    : entry.awayTeamOdds?.favorite
      ? awayTeamId
      : null;
  return {
    spread: Math.abs(entry.spread),
    favoriteTeamId,
    overUnder: typeof entry.overUnder === "number" ? entry.overUnder : null,
  };
}

/**
 * Builds full Player[] rosters (with box score stats) for both teams
 * from a summary response's `boxscore.players` array, keyed by team id.
 */
function buildPlayersByTeamId(boxscorePlayers, injuryStatusByAthleteId) {
  const byTeamId = {};
  if (!Array.isArray(boxscorePlayers)) return byTeamId;

  for (const teamBlock of boxscorePlayers) {
    const teamId = String(teamBlock.team?.id ?? "");
    const players = [];

    for (const statGroup of teamBlock.statistics ?? []) {
      const names = statGroup.names ?? statGroup.labels ?? [];
      for (const athleteEntry of statGroup.athletes ?? []) {
        const athlete = athleteEntry.athlete ?? {};
        const athleteId = String(athlete.id ?? `${teamId}-${players.length}`);
        const injuryStatus = injuryStatusByAthleteId?.[athleteId];
        players.push({
          id: athleteId,
          name: athlete.displayName ?? athlete.shortName ?? "Unknown",
          number: athlete.jersey ?? "",
          position: athlete.position?.abbreviation ?? "",
          stats: buildStatsFromNames(names, athleteEntry.stats),
          ...(injuryStatus ? { injuryStatus } : {}),
          // ESPN's box score athletes carry explicit starter/didNotPlay
          // flags — no need to derive these from minutes.
          ...(typeof athleteEntry.starter === "boolean" ? { starter: athleteEntry.starter } : {}),
          ...(typeof athleteEntry.didNotPlay === "boolean" ? { didNotPlay: athleteEntry.didNotPlay } : {}),
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

  const { byAthleteId: injuryStatusByAthleteId, list: injuryReport } = buildInjuryReport(summary.injuries);
  const playersByTeamId = buildPlayersByTeamId(summary.boxscore?.players, injuryStatusByAthleteId);
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
    startTimeIso: headerCompetition?.date ?? summary.header?.date ?? null,
    status: gameStatus,
    period: formatPeriodLabel(league, status),
    clock: gameStatus === "in_progress" ? status?.displayClock : undefined,
    playByPlay: normalizePlayByPlay(summary.plays),
    injuryReport,
    pregameOdds: buildPregameOdds(summary.pickcenter, homeTeam.id, awayTeam.id),
  };
}

/**
 * Fetches games for a given ESPN league slug and optional date string
 * (YYYYMMDD). Omitting `dateStr` fetches today's slate (ESPN's default).
 *
 * @param {string} league  ESPN basketball league slug
 * @param {string} [dateStr]  Optional YYYYMMDD date (e.g. "20261017")
 * @returns {Promise<object[]>}
 */
export async function getGamesByDate(league, dateStr) {
  try {
    const url = dateStr
      ? `${ESPN_BASE}/${league}/scoreboard?dates=${encodeURIComponent(dateStr)}`
      : `${ESPN_BASE}/${league}/scoreboard`;
    const data = await fetchJson(url);
    const events = data.events ?? [];
    return events.map((event) => normalizeScoreboardEvent(league, event));
  } catch (error) {
    console.error(`[espn provider] failed to fetch ${league} scoreboard${dateStr ? ` for ${dateStr}` : ""}:`, error);
    return [];
  }
}

/** Convenience alias — fetches today's slate for a league. */
export async function getTodayGames(league) {
  return getGamesByDate(league);
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

/**
 * Fetches a team's full-season schedule and normalizes it to just what
 * Pre-Game Intelligence needs: each event's id, date, and state
 * (pre/in/post). Used to find a team's most recent completed game (as a
 * baseline for "who started/played last time") and to detect
 * back-to-backs (games on consecutive nights).
 *
 * @param {"nba" | "wnba"} league
 * @param {string} teamId
 * @returns {Promise<object[]>}
 */
export async function getTeamSchedule(league, teamId) {
  try {
    const data = await fetchJson(`${ESPN_BASE}/${league}/teams/${encodeURIComponent(teamId)}/schedule`);
    const events = Array.isArray(data?.events) ? data.events : [];
    return events.map((event) => ({
      id: String(event.id),
      date: event.date ?? "",
      state: event.competitions?.[0]?.status?.type?.state ?? "pre",
    }));
  } catch (error) {
    console.error(`[espn provider] failed to fetch ${league} schedule for team ${teamId}:`, error);
    return [];
  }
}

// Maps gamelog `names` entries (a fixed 14-column layout, but we look up
// by name rather than assuming column order in case ESPN changes it) to
// our normalized field names, mirroring STAT_ALIASES above.
const GAMELOG_FIELD_MAP = {
  minutes: "minutes",
  "fieldGoalsMade-fieldGoalsAttempted": "fieldGoals",
  "threePointFieldGoalsMade-threePointFieldGoalsAttempted": "threePointers",
  "freeThrowsMade-freeThrowsAttempted": "freeThrows",
  totalRebounds: "rebounds",
  assists: "assists",
  blocks: "blocks",
  steals: "steals",
  fouls: "personalFouls",
  turnovers: "turnovers",
  points: "points",
};

const NUMERIC_GAMELOG_FIELDS = new Set([
  "rebounds",
  "assists",
  "blocks",
  "steals",
  "personalFouls",
  "turnovers",
  "points",
]);

/**
 * Builds a normalized per-game stats object from the gamelog response's
 * shared `names` column list and one event's parallel `stats` array.
 */
function buildGameLogStats(names, values) {
  const stats = {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
  };
  if (!Array.isArray(names) || !Array.isArray(values)) return stats;

  names.forEach((name, idx) => {
    const field = GAMELOG_FIELD_MAP[name];
    if (!field) return;
    const raw = values[idx];
    stats[field] = NUMERIC_GAMELOG_FIELDS.has(field) ? parseStatValue(raw) : (raw ?? null);
  });

  return stats;
}

/**
 * Excludes preseason from the season types considered "real" history —
 * preseason stat lines are unrepresentative of regular-season/playoff
 * performance and would skew averages/trend if included silently.
 */
function isEligibleSeasonType(seasonType) {
  return !/preseason/i.test(seasonType?.displayName ?? "");
}

/**
 * Fetches a player's historical game log (most recent games first) via
 * ESPN's gamelog endpoint. Returns [] if the player has no logged games
 * yet (e.g. hasn't debuted this season) or the request fails — callers
 * should treat that as "no history available" rather than an error.
 *
 * @param {"nba" | "wnba"} league
 * @param {string} athleteId
 * @returns {Promise<object[]>}
 */
export async function getPlayerGameLog(league, athleteId) {
  try {
    const data = await fetchJson(`${ESPN_GAMELOG_BASE}/${league}/athletes/${encodeURIComponent(athleteId)}/gamelog`);
    const names = data?.names ?? [];
    const eventsById = data?.events ?? {};
    const seasonTypes = Array.isArray(data?.seasonTypes) ? data.seasonTypes : [];

    const rows = [];
    for (const seasonType of seasonTypes) {
      if (!isEligibleSeasonType(seasonType)) continue;
      for (const category of seasonType.categories ?? []) {
        for (const entry of category.events ?? []) {
          const event = eventsById[entry.eventId];
          if (!event) continue;
          rows.push({
            gameId: String(entry.eventId),
            date: event.gameDate ?? null,
            opponentAbbreviation: event.opponent?.abbreviation ?? "",
            opponentName: event.opponent?.displayName ?? "",
            homeAway: event.atVs === "@" ? "away" : "home",
            result: event.gameResult === "W" || event.gameResult === "L" ? event.gameResult : null,
            teamScore: event.atVs === "@" ? event.awayTeamScore : event.homeTeamScore,
            opponentScore: event.atVs === "@" ? event.homeTeamScore : event.awayTeamScore,
            stats: buildGameLogStats(names, entry.stats),
            // Not available from the gamelog endpoint — only a specific
            // game's live summary carries these (see module header).
            starter: null,
            plusMinus: null,
          });
        }
      }
    }

    // Newest first.
    rows.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
    return rows;
  } catch (error) {
    console.error(`[espn provider] failed to fetch ${league} game log for athlete ${athleteId}:`, error);
    return [];
  }
}

// ─── Timezone-safe league overview ─────────────────────────────────────────

/** Formats a Date as YYYYMMDD using UTC — never the local clock. */
export function formatUtcDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Returns a timezone-safe snapshot: { live, upcoming, lastPlayed }.
 *
 * Why this exists
 * ---------------
 * The old approach computed a "today" date string in the viewer's local
 * timezone (e.g. IST = UTC+5:30), then queried ESPN for that date. A game
 * that is currently LIVE at 7 PM US Eastern = 4:30 AM IST the following day
 * would be classified as "tomorrow" (or missing) for IST viewers. This
 * function avoids that entirely by:
 *
 *   1. Fetching ESPN's default scoreboard (no date param) — ESPN always
 *      populates this with whatever is live/scheduled for their internal
 *      "today" (US Eastern). It is the definitive source for LIVE games.
 *   2. Also fetching UTC-based yesterday and UTC-based tomorrow in parallel,
 *      to catch games that spill over the midnight boundary in either direction.
 *   3. Deduplicating by game ID, with the default-scoreboard result taking
 *      precedence (it has the freshest live status).
 *   4. Classifying purely by the provider's normalized `status` field — never
 *      by comparing dates. A game with status "in_progress" is LIVE, period.
 *   5. Optionally scanning forward (up to 45 UTC days) to find the next
 *      scheduled game when the league is between games, and backward to find
 *      the most recently completed game.
 *
 * @param {string} league  ESPN basketball league slug
 * @param {{ scan?: boolean }} [options]
 *   scan: true (default) — scan forward/backward if no upcoming/last-played
 *         found in the initial 3-day window. Set to false on the home page
 *         for a fast first paint (just live + close-in-time games).
 */
/**
 * Like getGamesByDate but applies a raw-event filter before normalization.
 * Used by nba-summer to hit the NBA scoreboard and keep only type-3 games.
 *
 * @param {string} league
 * @param {string | null} dateStr
 * @param {(rawEvent: object) => boolean} eventFilter
 */
export async function getGamesByDateFiltered(league, dateStr, eventFilter) {
  try {
    const url = dateStr
      ? `${ESPN_BASE}/${league}/scoreboard?dates=${encodeURIComponent(dateStr)}`
      : `${ESPN_BASE}/${league}/scoreboard`;
    const data = await fetchJson(url);
    const events = (data.events ?? []).filter(eventFilter);
    return events.map((event) => normalizeScoreboardEvent(league, event));
  } catch (error) {
    console.error(`[espn provider] filtered fetch failed for ${league}:`, error);
    return [];
  }
}

/**
 * getLeagueOverview variant that filters raw events before normalization and
 * maps the league key on returned games. Used by nba-summer: hits the NBA
 * scoreboard (slug="nba"), keeps only season-type-3 events, renames league.
 *
 * @param {string} league              ESPN slug to hit (e.g. "nba")
 * @param {string} overrideLeagueKey   league key for returned games (e.g. "nba-summer")
 * @param {(rawEvent: object) => boolean} eventFilter
 * @param {{ scan?: boolean, scanDays?: number }} [options]
 */
export async function getLeagueOverviewFiltered(
  league,
  overrideLeagueKey,
  eventFilter,
  { scan = true, scanDays = 21 } = {}
) {
  const now = new Date();
  const utcYesterday = formatUtcDate(new Date(now.getTime() - 86_400_000));
  const utcTomorrow  = formatUtcDate(new Date(now.getTime() + 86_400_000));

  const remap = (games) =>
    games.map((g) => ({ ...g, league: overrideLeagueKey }));

  const [defaultGames, yesterdayGames, tomorrowGames] = await Promise.all([
    getGamesByDateFiltered(league, null, eventFilter),
    getGamesByDateFiltered(league, utcYesterday, eventFilter),
    getGamesByDateFiltered(league, utcTomorrow, eventFilter),
  ]);

  const byId = new Map();
  for (const g of remap([...yesterdayGames, ...tomorrowGames])) byId.set(g.id, g);
  for (const g of remap(defaultGames)) byId.set(g.id, g);
  const all = [...byId.values()];

  const live = all.filter((g) => g.status === "in_progress");
  const upcoming = all
    .filter((g) => g.status === "scheduled")
    .sort((a, b) => new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime());
  const completed = all
    .filter((g) => g.status === "final")
    .sort((a, b) => new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime());

  if (scan && upcoming.length === 0) {
    for (let day = 2; day <= scanDays; day++) {
      const futureDate = formatUtcDate(new Date(now.getTime() + day * 86_400_000));
      const futureGames = remap(await getGamesByDateFiltered(league, futureDate, eventFilter));
      const sched = futureGames.filter((g) => g.status === "scheduled");
      if (sched.length > 0) {
        upcoming.push(...sched.sort((a, b) => new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime()));
        break;
      }
    }
  }

  if (scan && completed.length === 0) {
    for (let day = 2; day <= scanDays; day++) {
      const pastDate = formatUtcDate(new Date(now.getTime() - day * 86_400_000));
      const pastGames = remap(await getGamesByDateFiltered(league, pastDate, eventFilter));
      const done = pastGames.filter((g) => g.status === "final");
      if (done.length > 0) {
        completed.push(...done.sort((a, b) => new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime()));
        break;
      }
    }
  }

  return { live, upcoming, lastPlayed: completed[0] ?? null };
}

export async function getLeagueOverview(league, { scan = true } = {}) {
  const now = new Date();
  const utcYesterday = formatUtcDate(new Date(now.getTime() - 86_400_000));
  const utcTomorrow  = formatUtcDate(new Date(now.getTime() + 86_400_000));

  // Parallel fetch: default (authoritative live), UTC yesterday, UTC tomorrow.
  const [defaultGames, yesterdayGames, tomorrowGames] = await Promise.all([
    getGamesByDate(league),               // no date → ESPN "today"
    getGamesByDate(league, utcYesterday),
    getGamesByDate(league, utcTomorrow),
  ]);

  // Merge with default taking precedence (freshest live status).
  const byId = new Map();
  for (const g of [...yesterdayGames, ...tomorrowGames]) byId.set(g.id, g);
  for (const g of defaultGames) byId.set(g.id, g);
  const all = [...byId.values()];

  const live = all.filter((g) => g.status === "in_progress");

  const upcoming = all
    .filter((g) => g.status === "scheduled")
    .sort((a, b) =>
      new Date(a.startTimeIso ?? 0).getTime() -
      new Date(b.startTimeIso ?? 0).getTime()
    );

  const completed = all
    .filter((g) => g.status === "final")
    .sort((a, b) =>
      new Date(b.startTimeIso ?? 0).getTime() -
      new Date(a.startTimeIso ?? 0).getTime()
    );

  // Forward scan — find next game even if months away.
  // 180-day window covers long off-seasons (e.g. NBL July→October).
  if (scan && upcoming.length === 0) {
    for (let day = 2; day <= 180; day++) {
      const futureDate = formatUtcDate(new Date(now.getTime() + day * 86_400_000));
      const futureGames = await getGamesByDate(league, futureDate);
      const futureSched = futureGames.filter((g) => g.status === "scheduled");
      if (futureSched.length > 0) {
        upcoming.push(
          ...futureSched.sort(
            (a, b) =>
              new Date(a.startTimeIso ?? 0).getTime() -
              new Date(b.startTimeIso ?? 0).getTime()
          )
        );
        break;
      }
    }
  }

  // Backward scan — find most recently completed game.
  if (scan && completed.length === 0) {
    for (let day = 2; day <= 180; day++) {
      const pastDate = formatUtcDate(new Date(now.getTime() - day * 86_400_000));
      const pastGames = await getGamesByDate(league, pastDate);
      const pastCompleted = pastGames.filter((g) => g.status === "final");
      if (pastCompleted.length > 0) {
        completed.push(
          ...pastCompleted.sort(
            (a, b) =>
              new Date(b.startTimeIso ?? 0).getTime() -
              new Date(a.startTimeIso ?? 0).getTime()
          )
        );
        break;
      }
    }
  }

  return {
    live,
    upcoming,
    lastPlayed: completed[0] ?? null,
  };
}
