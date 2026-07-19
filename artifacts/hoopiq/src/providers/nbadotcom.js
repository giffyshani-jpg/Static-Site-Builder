// NBA.com CDN provider.
//
// Uses NBA's public CDN and stats endpoints. These are fetched directly from
// the user's browser (HoopIQ is pure client-side), where NBA's CORS policy
// allows requests with Origin: https://www.nba.com. Server-side requests
// (e.g. during dev probing from Node) may get 403 — that is expected.
//
// Endpoints:
//   Live scoreboard : https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json
//   Box score       : https://cdn.nba.com/static/json/liveData/boxscore/boxscore_{gameId}.json
//   Schedule        : https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json
//
// Summer League identification:
//   Summer League games appear in the regular NBA scoreboard (league 00) and
//   can be identified by their `gameLabel` field containing "Summer" or by
//   their gameId prefix ("001" for Summer League vs "002" for regular season).

const NBA_CDN_BASE = "https://cdn.nba.com/static/json";

const NBA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
  Accept: "application/json, */*",
  Origin: "https://www.nba.com",
  Referer: "https://www.nba.com/",
};

async function fetchNba(path, { timeoutMs = 9_000 } = {}) {
  const url = `${NBA_CDN_BASE}/${path}`;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: NBA_HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`NBA CDN ${res.status}: ${url}`);
    return res.json();
  } finally {
    clearTimeout(timerId);
  }
}

/** Map NBA.com gameStatus (1/2/3) to our normalized status string. */
function mapStatus(gameStatus) {
  if (gameStatus === 2) return "in_progress";
  if (gameStatus === 3) return "final";
  return "scheduled";
}

/**
 * Normalize a single game object from the NBA CDN scoreboard shape.
 */
function normalizeGame(g, leagueKey) {
  const home = g.homeTeam ?? {};
  const away = g.awayTeam ?? {};

  let startTime = "";
  let startTimeIso = g.gameTimeUTC ?? null;
  if (startTimeIso) {
    try {
      startTime = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(startTimeIso));
    } catch {
      startTime = "";
    }
  }

  let clock = "";
  if (g.gameClock) {
    // NBA CDN returns ISO-8601 duration: "PT05M30.00S" → "5:30"
    const m = g.gameClock.match(/PT(\d+)M([\d.]+)S/);
    if (m) clock = `${parseInt(m[1], 10)}:${m[2].split(".")[0].padStart(2, "0")}`;
  }

  const period = g.period > 0 ? `Q${g.period}` : "";

  return {
    id: g.gameId,
    league: leagueKey,
    homeTeam: {
      id: String(home.teamId ?? ""),
      name: home.teamCity ? `${home.teamCity} ${home.teamName}` : (home.teamName ?? ""),
      abbreviation: home.teamTricode ?? "",
      score: home.score ?? null,
      players: [],
    },
    awayTeam: {
      id: String(away.teamId ?? ""),
      name: away.teamCity ? `${away.teamCity} ${away.teamName}` : (away.teamName ?? ""),
      abbreviation: away.teamTricode ?? "",
      score: away.score ?? null,
      players: [],
    },
    startTime,
    startTimeIso,
    status: mapStatus(g.gameStatus),
    period,
    clock,
  };
}

/**
 * Returns true if a game from the NBA CDN scoreboard is a Summer League game.
 */
function isSummerLeague(g) {
  if ((g.gameLabel ?? "").toLowerCase().includes("summer")) return true;
  // Game IDs: 001xxxxx = Summer League, 002xxxxx = regular, 004xxxxx = playoffs
  if (typeof g.gameId === "string" && g.gameId.startsWith("001")) return true;
  return false;
}

/**
 * Fetch and normalize today's games from the NBA CDN live scoreboard.
 * @param {(g: object) => boolean} [filter]  optional game filter
 * @param {string} leagueKey
 */
async function fetchTodayGames(leagueKey, filter) {
  const data = await fetchNba("liveData/scoreboard/todaysScoreboard_00.json");
  const games = data.scoreboard?.games ?? [];
  const filtered = filter ? games.filter(filter) : games;
  return filtered.map((g) => normalizeGame(g, leagueKey));
}

/**
 * Fetch the full-season schedule JSON and return games matching a filter.
 * The schedule file is ~2MB but is cached by the CDN and typically only
 * needed once per session for the forward-scan on the league page.
 */
async function fetchScheduleGames(leagueKey, filter) {
  const data = await fetchNba("staticData/scheduleLeagueV2_1.json", { timeoutMs: 15_000 });
  const gameDates = data.leagueSchedule?.gameDates ?? [];
  const all = [];
  for (const gd of gameDates) {
    for (const g of gd.games ?? []) {
      if (!filter || filter(g)) {
        all.push({
          gameId: g.gameId,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          gameTimeUTC: g.gameDateTimeUTC ?? null,
          gameLabel: g.gameLabel ?? "",
          gameStatus: 1,
          gameClock: "",
          period: 0,
        });
      }
    }
  }
  return all.map((g) => normalizeGame(g, leagueKey));
}

// ─── Public exports (follow the provider contract used by api.js) ────────────

/**
 * Today's Summer League games (live or scheduled today).
 * @returns {Promise<object[]>}
 */
export async function getSummerLeagueTodayGames() {
  return fetchTodayGames("nba-summer", isSummerLeague);
}

/**
 * Today's regular-season NBA games (excludes Summer League).
 * @returns {Promise<object[]>}
 */
export async function getNbaTodayGames() {
  return fetchTodayGames("nba", (g) => !isSummerLeague(g));
}

/**
 * Timezone-safe Summer League overview: { live, upcoming, lastPlayed }.
 * @param {{ scan?: boolean }} [options]
 */
export async function getSummerLeagueOverview({ scan = true } = {}) {
  const todayGames = await fetchTodayGames("nba-summer", isSummerLeague);

  const live = todayGames.filter((g) => g.status === "in_progress");
  const todayScheduled = todayGames.filter((g) => g.status === "scheduled");
  const todayFinal = todayGames.filter((g) => g.status === "final");

  if (live.length > 0 || todayScheduled.length > 0) {
    return {
      live,
      upcoming: todayScheduled.sort(
        (a, b) =>
          new Date(a.startTimeIso ?? 0).getTime() -
          new Date(b.startTimeIso ?? 0).getTime()
      ),
      lastPlayed: todayFinal[0] ?? null,
    };
  }

  if (scan) {
    try {
      const allScheduled = await fetchScheduleGames("nba-summer", isSummerLeague);
      const now = Date.now();
      const future = allScheduled
        .filter((g) => new Date(g.startTimeIso ?? 0).getTime() > now)
        .sort(
          (a, b) =>
            new Date(a.startTimeIso ?? 0).getTime() -
            new Date(b.startTimeIso ?? 0).getTime()
        );
      return {
        live: [],
        upcoming: future,
        lastPlayed: todayFinal[0] ?? null,
      };
    } catch (schedErr) {
      // Schedule scan failed silently — return what we have
    }
  }

  return { live, upcoming: todayScheduled, lastPlayed: todayFinal[0] ?? null };
}

/**
 * Timezone-safe NBA overview (regular season, no Summer League).
 * Used as fallback when ESPN NBA scoreboard is unavailable.
 * @param {{ scan?: boolean }} [options]
 */
export async function getNbaOverview({ scan = true } = {}) {
  const todayGames = await fetchTodayGames("nba", (g) => !isSummerLeague(g));

  const live = todayGames.filter((g) => g.status === "in_progress");
  const upcoming = todayGames
    .filter((g) => g.status === "scheduled")
    .sort((a, b) => new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime());
  const final = todayGames
    .filter((g) => g.status === "final")
    .sort((a, b) => new Date(b.startTimeIso ?? 0).getTime() - new Date(a.startTimeIso ?? 0).getTime());

  if (live.length > 0 || upcoming.length > 0) {
    return { live, upcoming, lastPlayed: final[0] ?? null };
  }

  // Optional schedule scan for next upcoming NBA game
  if (scan) {
    try {
      const allScheduled = await fetchScheduleGames("nba", (g) => !isSummerLeague(g));
      const now = Date.now();
      const future = allScheduled
        .filter((g) => new Date(g.startTimeIso ?? 0).getTime() > now)
        .sort((a, b) => new Date(a.startTimeIso ?? 0).getTime() - new Date(b.startTimeIso ?? 0).getTime());
      return { live: [], upcoming: future, lastPlayed: final[0] ?? null };
    } catch {
      // Schedule scan failed silently
    }
  }

  return { live, upcoming, lastPlayed: final[0] ?? null };
}
