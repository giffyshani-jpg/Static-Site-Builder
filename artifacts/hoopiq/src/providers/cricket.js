// Cricket data provider — ESPN public API.
//
// Auto-discovers active competitions by querying a known list of ESPN cricket
// competition slugs in parallel. Adding a new league = adding one slug to
// COMPETITION_SLUGS. No other code change needed anywhere.
//
// ESPN endpoints used (unauthenticated, CORS-open):
//   Scoreboard: https://site.api.espn.com/apis/site/v2/sports/cricket/{slug}/scoreboard
//   Summary:    https://site.api.espn.com/apis/site/v2/sports/cricket/{slug}/summary?event={id}
//
// Game IDs are stored as "{competitionSlug}:{espnEventId}" so the detail
// fetcher knows which endpoint to hit without extra lookup.

const ESPN_CRICKET = "https://site.api.espn.com/apis/site/v2/sports/cricket";

// ─── Competition registry ──────────────────────────────────────────────────
//
// This is the ONLY list to update when adding a new league.
// Each entry: { slug, name, format }
// - slug:   ESPN URL segment
// - name:   Human-readable fallback (ESPN's own name overrides this if present)
// - format: MatchFormat — drives the scoring rule engine

export const COMPETITION_REGISTRY = [
  // ── International ────────────────────────────────────────────────────────
  { slug: "icc-cricket",              name: "International Cricket",        format: "T20"       },
  { slug: "icc-t20-world-cup",        name: "ICC T20 World Cup",            format: "T20"       },
  { slug: "icc-cricket-world-cup",    name: "ICC Cricket World Cup",        format: "ODI"       },
  { slug: "icc-world-test-championship", name: "World Test Championship",   format: "Test"      },
  { slug: "international-cricket",    name: "International Cricket",        format: "T20"       },
  // ── T20 leagues ──────────────────────────────────────────────────────────
  { slug: "ipl",                      name: "Indian Premier League",        format: "T20"       },
  { slug: "big-bash",                 name: "Big Bash League",              format: "T20"       },
  { slug: "bbl",                      name: "Big Bash League",              format: "T20"       },
  { slug: "caribbean-premier-league", name: "Caribbean Premier League",     format: "T20"       },
  { slug: "pakistan-super-league",    name: "Pakistan Super League",        format: "T20"       },
  { slug: "psl",                      name: "Pakistan Super League",        format: "T20"       },
  { slug: "sa20",                     name: "SA20",                         format: "T20"       },
  { slug: "ilt20",                    name: "ILT20",                        format: "T20"       },
  { slug: "the-hundred",              name: "The Hundred",                  format: "The Hundred" },
  { slug: "major-league-cricket",     name: "Major League Cricket",         format: "T20"       },
  { slug: "mlc",                      name: "Major League Cricket",         format: "T20"       },
  { slug: "lanka-premier-league",     name: "Lanka Premier League",         format: "T20"       },
  { slug: "lpl",                      name: "Lanka Premier League",         format: "T20"       },
  { slug: "vitality-blast",           name: "Vitality Blast",               format: "T20"       },
  { slug: "t20-blast",                name: "Vitality Blast",               format: "T20"       },
  { slug: "tnpl",                     name: "Tamil Nadu Premier League",     format: "T20"       },
  { slug: "super-smash",              name: "Super Smash",                  format: "T20"       },
  { slug: "bangladesh-premier-league", name: "Bangladesh Premier League",   format: "T20"       },
  { slug: "bpl",                      name: "Bangladesh Premier League",    format: "T20"       },
  { slug: "ram-slam",                 name: "Ram Slam T20",                 format: "T20"       },
  { slug: "afghanistan-premier-league", name: "Afghanistan Premier League", format: "T20"       },
  { slug: "legends-league-cricket",   name: "Legends League Cricket",       format: "T20"       },
  { slug: "women-ipl",                name: "Women's IPL",                  format: "T20"       },
  { slug: "wipl",                     name: "Women's IPL",                  format: "T20"       },
  { slug: "wbbl",                     name: "Women's Big Bash League",      format: "T20"       },
  // ── ODI ──────────────────────────────────────────────────────────────────
  { slug: "icc-women-cricket-world-cup", name: "ICC Women's World Cup",     format: "ODI"       },
  // ── Test ─────────────────────────────────────────────────────────────────
  { slug: "test-cricket",             name: "Test Cricket",                 format: "Test"      },
];

// Deduplicated slug → registry entry map (first entry wins for duplicate slugs)
const SLUG_META = new Map();
for (const entry of COMPETITION_REGISTRY) {
  if (!SLUG_META.has(entry.slug)) SLUG_META.set(entry.slug, entry);
}
const UNIQUE_SLUGS = [...SLUG_META.keys()];

// ─── Helpers ───────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`ESPN cricket ${r.status}: ${url}`);
  return r.json();
}

async function safeJson(url) {
  try {
    return await fetchJson(url);
  } catch {
    return null;
  }
}

function mapStatus(state, completed) {
  if (completed || state === "post") return "final";
  if (state === "in") return "in_progress";
  return "scheduled";
}

function fmt(isoDate) {
  if (!isoDate) return "";
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(isoDate));
  } catch { return ""; }
}

function makeGameId(slug, eventId) {
  return `${slug}:${eventId}`;
}

function parseGameId(gameId) {
  const idx = gameId.indexOf(":");
  if (idx === -1) return { slug: "icc-cricket", eventId: gameId };
  return { slug: gameId.slice(0, idx), eventId: gameId.slice(idx + 1) };
}

/** Detect match format from competition slug or name. */
function detectFormat(slug, name) {
  const meta = SLUG_META.get(slug);
  if (meta) return meta.format;
  const lower = (name || "").toLowerCase();
  if (/hundred/.test(lower)) return "The Hundred";
  if (/test/.test(lower)) return "Test";
  if (/odi|one.?day/.test(lower)) return "ODI";
  if (/t10/.test(lower)) return "T10";
  return "T20";
}

// ─── Scoreboard parser ─────────────────────────────────────────────────────

/**
 * Parse an ESPN cricket scoreboard response into normalized CricketGame objects.
 * Returns [] if the response is malformed or contains no events.
 */
function parseScoreboard(data, slug) {
  if (!data || !Array.isArray(data.events)) return [];

  const meta = SLUG_META.get(slug) ?? { name: "Cricket", format: "T20" };

  return data.events.flatMap((event) => {
    try {
      const comp = event.competitions?.[0];
      if (!comp) return [];

      const statusType = comp.status?.type ?? {};
      const state = statusType.state ?? "pre";
      const completed = !!statusType.completed;
      const status = mapStatus(state, completed);

      const competitors = comp.competitors ?? [];
      const home = competitors.find((c) => c.homeAway === "home") ?? competitors[0];
      const away = competitors.find((c) => c.homeAway === "away") ?? competitors[1];
      if (!home || !away) return [];

      const homeTeam = {
        id: home.team?.id ?? "h",
        name: home.team?.displayName ?? home.team?.name ?? "Home",
        abbreviation: home.team?.abbreviation ?? "HME",
        score: home.score ?? null,
        overs: null,
        players: [],
      };
      const awayTeam = {
        id: away.team?.id ?? "a",
        name: away.team?.displayName ?? away.team?.name ?? "Away",
        abbreviation: away.team?.abbreviation ?? "AWY",
        score: away.score ?? null,
        overs: null,
        players: [],
      };

      // Try to pull overs from linescores
      const homeOvers = home.linescores?.[0]?.value ?? null;
      const awayOvers = away.linescores?.[0]?.value ?? null;
      if (homeOvers) homeTeam.overs = String(homeOvers);
      if (awayOvers) awayTeam.overs = String(awayOvers);

      const compName = data.leagues?.[0]?.name
        ?? event.season?.name
        ?? meta.name;
      const format = detectFormat(slug, compName);

      // Period / detail
      const detail = statusType.shortDetail ?? statusType.description ?? "";
      const result = statusType.completed
        ? (comp.notes?.find((n) => n.type === "result" || n.type === "event")?.headline ?? detail)
        : null;

      return [{
        id: makeGameId(slug, event.id),
        competitionSlug: slug,
        competitionName: compName,
        format,
        homeTeam,
        awayTeam,
        startTime: event.date ? fmt(event.date) : "",
        startTimeIso: event.date ?? null,
        status,
        period: state === "in" ? (statusType.period ? `${statusType.period}` : "In Progress") : undefined,
        statusDetail: detail,
        innings: [],
        result: result || null,
        venue: comp.venue?.fullName ?? null,
      }];
    } catch {
      return [];
    }
  });
}

// ─── Summary (detailed scorecard) parser ──────────────────────────────────

/**
 * Parse batting dismissal text to detect LBW or bowled.
 * e.g. "lbw b Hazlewood", "b Rabada", "Bowled Starc"
 */
function isLbwOrBowled(dismissal) {
  if (!dismissal) return false;
  const d = dismissal.toLowerCase().trim();
  return d.startsWith("b ") || d.startsWith("lbw") || d.startsWith("bowled");
}

/**
 * Parse ESPN cricket summary into CricketInnings array + enriched teams.
 * Handles multiple possible ESPN response shapes gracefully.
 */
function parseSummary(data) {
  if (!data) return { innings: [], players: {} };

  // Try different possible paths ESPN uses
  const inningsList =
    data.scoreboard?.inningsList
    ?? data.scoreboard?.innings
    ?? data.inningsList
    ?? data.innings
    ?? [];

  if (!Array.isArray(inningsList) || inningsList.length === 0) {
    return { innings: [], players: {} };
  }

  // players: playerId → { batting?, bowling?, fielding? }
  const players = {};

  const innings = inningsList.map((inning, idx) => {
    const battingTeam = {
      id: inning.team?.id ?? String(idx),
      name: inning.team?.displayName ?? inning.team?.name ?? "Team",
      abbreviation: inning.team?.abbreviation ?? "T",
      score: null,
      overs: null,
      players: [],
    };

    const bowlingTeamName = inning.bowlingTeam?.displayName ?? "";
    const bowlingTeam = {
      id: inning.bowlingTeam?.id ?? "",
      name: bowlingTeamName,
      abbreviation: inning.bowlingTeam?.abbreviation ?? "",
      score: null,
      overs: null,
      players: [],
    };

    let totalRuns = Number(inning.totalRuns ?? inning.runs ?? 0);
    let totalWickets = Number(inning.totalWickets ?? inning.wickets ?? 0);
    let totalOvers = String(inning.totalOvers ?? inning.overs ?? "");

    // Parse batting
    const batList = inning.battingInning ?? inning.batting ?? inning.batsmen ?? [];
    const lbwBowledByBowler = {}; // bowlerId → count

    for (const bat of batList) {
      const aid = bat.athlete?.id ?? bat.playerId ?? String(Math.random());
      const name = bat.athlete?.displayName ?? bat.name ?? "Unknown";
      const runs = Number(bat.displayStats?.R ?? bat.runs ?? 0);
      const balls = Number(bat.displayStats?.B ?? bat.balls ?? 0);
      const fours = Number(bat.displayStats?.["4s"] ?? bat.fours ?? 0);
      const sixes = Number(bat.displayStats?.["6s"] ?? bat.sixes ?? 0);
      const sr = balls > 0 ? (runs / balls) * 100 : null;
      const dismissal = bat.dismissal ?? bat.dismissalText ?? null;
      const notOut = bat.notOut ?? bat.notout ?? (dismissal === null || dismissal === "" || dismissal === "not out");
      const dismissed = !notOut;

      // LBW/Bowled detection: try to extract bowler ID from dismissal
      if (isLbwOrBowled(dismissal)) {
        // Try to match "b <bowlerName>" from dismissal
        const bowlerMatch = dismissal?.match(/\bb\s+(.+)/i);
        const bowlerName = bowlerMatch?.[1]?.trim() ?? null;
        if (bowlerName) {
          // We'll match by name later
          lbwBowledByBowler[bowlerName] = (lbwBowledByBowler[bowlerName] ?? 0) + 1;
        }
      }

      if (!players[aid]) players[aid] = { id: aid, name, stats: {} };
      players[aid].stats.batting = {
        runs, balls, fours, sixes, strikeRate: sr, dismissed, dismissal,
        isLbwOrBowled: isLbwOrBowled(dismissal),
      };
    }

    // Parse bowling
    const bowlList = inning.bowlingInning ?? inning.bowling ?? inning.bowlers ?? [];
    for (const bowl of bowlList) {
      const aid = bowl.athlete?.id ?? bowl.playerId ?? String(Math.random());
      const name = bowl.athlete?.displayName ?? bowl.name ?? "Unknown";
      const oversRaw = bowl.displayStats?.O ?? bowl.overs ?? "0";
      const oversStr = String(oversRaw);
      const dotIdx = oversStr.indexOf(".");
      const fullOvers = dotIdx === -1 ? parseInt(oversStr) : parseInt(oversStr.slice(0, dotIdx));
      const extraBalls = dotIdx === -1 ? 0 : parseInt(oversStr.slice(dotIdx + 1)) || 0;
      const maidens = Number(bowl.displayStats?.M ?? bowl.maidens ?? 0);
      const runsConceded = Number(bowl.displayStats?.R ?? bowl.runs ?? bowl.runsConceded ?? 0);
      const wickets = Number(bowl.displayStats?.W ?? bowl.wickets ?? 0);
      const totalOversDecimal = fullOvers + extraBalls / 6;
      const economy = totalOversDecimal > 0 ? runsConceded / totalOversDecimal : null;

      // Count LBW/Bowled wickets by matching bowler name
      const lbwBowledWickets = lbwBowledByBowler[name] ?? 0;

      if (!players[aid]) players[aid] = { id: aid, name, stats: {} };
      players[aid].stats.bowling = {
        overs: fullOvers,
        extraBalls,
        maidens,
        runsConceded,
        wickets,
        lbwBowledWickets,
        economy,
      };
    }

    const inningsStatus =
      inning.status === "completed" || inning.complete ? "completed"
      : inning.status === "in_progress" || inning.current ? "in_progress"
      : "not_started";

    return {
      inningsNumber: idx + 1,
      battingTeam,
      bowlingTeam,
      totalRuns,
      totalWickets,
      totalOvers,
      status: inningsStatus,
    };
  });

  return { innings, players };
}

// ─── Scoreboard cache ──────────────────────────────────────────────────────

const SCOREBOARD_CACHE = new Map(); // slug → { data, fetchedAt }
const SCOREBOARD_TTL = 2 * 60 * 1000; // 2 minutes

function getCached(slug) {
  const entry = SCOREBOARD_CACHE.get(slug);
  if (entry && Date.now() - entry.fetchedAt < SCOREBOARD_TTL) return entry.data;
  return null;
}

async function fetchScoreboard(slug) {
  const cached = getCached(slug);
  if (cached !== null) return cached;

  const data = await safeJson(`${ESPN_CRICKET}/${slug}/scoreboard`);
  const games = parseScoreboard(data, slug);
  SCOREBOARD_CACHE.set(slug, { data: games, fetchedAt: Date.now() });
  return games;
}

// ─── Public provider API ───────────────────────────────────────────────────

/**
 * Queries all known competition slugs in parallel and merges results.
 * Active competitions (with at least one game) are surfaced automatically.
 * Competitions with no games in the current window are silently ignored.
 */
export async function getLeagueOverview() {
  const results = await Promise.allSettled(
    UNIQUE_SLUGS.map((slug) => fetchScoreboard(slug))
  );

  const seen = new Set();
  const allGames = [];
  const activeCompetitions = [];

  for (const r of results) {
    if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
    if (r.value.length > 0) {
      const slug = r.value[0]?.competitionSlug;
      if (slug) activeCompetitions.push(slug);
    }
    for (const game of r.value) {
      if (!seen.has(game.id)) {
        seen.add(game.id);
        allGames.push(game);
      }
    }
  }

  const live = allGames.filter((g) => g.status === "in_progress");
  const upcoming = allGames
    .filter((g) => g.status === "scheduled")
    .sort((a, b) => new Date(a.startTimeIso ?? 0) - new Date(b.startTimeIso ?? 0));
  const played = allGames
    .filter((g) => g.status === "final")
    .sort((a, b) => new Date(b.startTimeIso ?? 0) - new Date(a.startTimeIso ?? 0));
  const lastPlayed = played[0] ?? null;

  return { live, upcoming, lastPlayed, activeCompetitions };
}

// Summary cache
const SUMMARY_CACHE = new Map(); // gameId → { data, fetchedAt }
const SUMMARY_TTL_LIVE = 30 * 1000;
const SUMMARY_TTL_FINAL = 5 * 60 * 1000;
const SUMMARY_TTL_SCHED = 2 * 60 * 1000;

/**
 * Fetches the detailed scorecard for a single game.
 * gameId format: "{slug}:{espnEventId}"
 */
export async function fetchGameById(gameId, { noCache = false } = {}) {
  const cached = SUMMARY_CACHE.get(gameId);
  if (!noCache && cached) {
    const ttl = cached.status === "in_progress" ? SUMMARY_TTL_LIVE
               : cached.status === "final"       ? SUMMARY_TTL_FINAL
               :                                   SUMMARY_TTL_SCHED;
    if (Date.now() - cached.fetchedAt < ttl) return cached.game;
  }

  const { slug, eventId } = parseGameId(gameId);

  // Try slug-specific endpoint first, then generic
  let data = await safeJson(`${ESPN_CRICKET}/${slug}/summary?event=${eventId}`);
  if (!data) {
    data = await safeJson(`${ESPN_CRICKET}/summary?event=${eventId}`);
  }

  // Get base game from scoreboard cache
  const scoreboardGames = await fetchScoreboard(slug);
  const base = scoreboardGames.find((g) => g.id === gameId) ?? null;

  if (!data && !base) return null;

  const { innings, players: playerMap } = parseSummary(data);

  // Merge players into innings team rosters
  const enrichedInnings = innings.map((inn) => {
    const battingPlayers = Object.values(playerMap)
      .filter((p) => p.stats?.batting)
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: "bat",
        credits: null,
        isPlaying: true,
        teamAbbreviation: inn.battingTeam.abbreviation,
        stats: p.stats,
      }));

    const bowlingPlayers = Object.values(playerMap)
      .filter((p) => p.stats?.bowling && !p.stats?.batting)
      .map((p) => ({
        id: p.id,
        name: p.name,
        role: "bowl",
        credits: null,
        isPlaying: true,
        teamAbbreviation: inn.bowlingTeam.abbreviation,
        stats: p.stats,
      }));

    return {
      ...inn,
      battingTeam: { ...inn.battingTeam, players: battingPlayers },
      bowlingTeam: { ...inn.bowlingTeam, players: bowlingPlayers },
    };
  });

  // Build all players list for optimizer
  const allPlayers = Object.values(playerMap).map((p) => ({
    id: p.id,
    name: p.name,
    role: "all",
    credits: null,
    isPlaying: true,
    teamAbbreviation: "",
    stats: p.stats,
    fantasyPoints: null,
  }));

  const game = {
    ...(base ?? {
      id: gameId,
      competitionSlug: slug,
      competitionName: SLUG_META.get(slug)?.name ?? "Cricket",
      format: SLUG_META.get(slug)?.format ?? "T20",
      homeTeam: { id: "h", name: "Home", abbreviation: "HME", score: null, overs: null, players: [] },
      awayTeam: { id: "a", name: "Away", abbreviation: "AWY", score: null, overs: null, players: [] },
      startTime: "",
      startTimeIso: null,
      status: "scheduled",
      innings: [],
      result: null,
      venue: null,
    }),
    innings: enrichedInnings,
    allPlayers,
  };

  SUMMARY_CACHE.set(gameId, { game, fetchedAt: Date.now(), status: game.status });
  return game;
}

/**
 * Returns the roster (playing XI) for a game — used by the optimizer.
 * Reuses fetchGameById so no extra network call.
 */
export async function fetchGameRoster(gameId) {
  const game = await fetchGameById(gameId);
  if (!game) return { homeTeam: null, awayTeam: null, allPlayers: [] };

  // Deduplicate players across innings
  const seen = new Set();
  const allPlayers = [];
  for (const inn of game.innings ?? []) {
    for (const p of [...(inn.battingTeam.players ?? []), ...(inn.bowlingTeam.players ?? [])]) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        allPlayers.push(p);
      }
    }
  }

  return {
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    allPlayers: allPlayers.length > 0 ? allPlayers : (game.allPlayers ?? []),
  };
}

/** Returns the match format for a given game ID (from cache). */
export function getMatchFormat(gameId) {
  const cached = SUMMARY_CACHE.get(gameId);
  if (cached?.game?.format) return cached.game.format;
  const { slug } = parseGameId(gameId);
  return SLUG_META.get(slug)?.format ?? "T20";
}
