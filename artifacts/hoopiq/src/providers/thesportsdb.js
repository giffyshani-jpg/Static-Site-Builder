// TheSportsDB provider — free public API (no API key required for v1/json/3/).
//
// Documentation: https://www.thesportsdb.com/api.php
// Free tier endpoints used here:
//   Next 15 events  : /api/v1/json/3/eventsnextleague.php?id={leagueId}
//   Past 15 events  : /api/v1/json/3/eventspastleague.php?id={leagueId}
//   Season events   : /api/v1/json/3/eventsseason.php?id={leagueId}&s={season}
//   Single event    : /api/v1/json/3/lookupevent.php?id={eventId}
//
// Known league IDs used by this project:
//   NZ NBL          : 5066   (New Zealand National Basketball League)
//
// Note: TSDB event data doesn't include live scores or play-by-play.
// Use it only for schedule (upcoming/past) when no better source is available.

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const FETCH_TIMEOUT_MS = 9_000;

async function fetchTsdb(path) {
  const url = `${TSDB_BASE}/${path}`;
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`TheSportsDB ${res.status}: ${url}`);
    return res.json();
  } finally {
    clearTimeout(timerId);
  }
}

/**
 * Derive a short 3-letter abbreviation from a team name.
 * Prefers the first 3 characters of the first word (city/region) to match
 * the NBA-style convention (AUC for Auckland, WEL for Wellington, etc.).
 */
function makeAbbreviation(teamName) {
  if (!teamName) return "UNK";
  const words = teamName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words[0].slice(0, 3).toUpperCase();
}

/**
 * Determine whether a TSDB event is finished.
 * Handles: "Match Finished", "FT", "AET", "AP", "PSO", "Abandoned".
 */
function isEventFinished(strStatus) {
  const s = (strStatus ?? "").toLowerCase().trim();
  return (
    s.includes("match finished") ||
    s === "ft" ||
    s === "aet" ||
    s === "ap" ||
    s === "pso" ||
    s.includes("abandoned")
  );
}

function normalizeEvent(ev, leagueKey) {
  const finished = isEventFinished(ev.strStatus);

  // Postponed / cancelled games should stay as "scheduled" (not final)
  // so they don't pollute the "Last Played" slot with a no-score entry.
  const postponed =
    (ev.strStatus ?? "").toLowerCase().includes("postponed") ||
    (ev.strStatus ?? "").toLowerCase().includes("cancelled") ||
    (ev.strStatus ?? "").toLowerCase().includes("canceled");

  let startTimeIso = null;
  let startTime = "";
  if (ev.strTimestamp) {
    try {
      startTimeIso = new Date(ev.strTimestamp).toISOString();
      startTime = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(ev.strTimestamp));
    } catch { /* ignore */ }
  }

  const homeScore = ev.intHomeScore != null ? Number(ev.intHomeScore) : null;
  const awayScore = ev.intAwayScore != null ? Number(ev.intAwayScore) : null;

  return {
    id: ev.idEvent,
    league: leagueKey,
    homeTeam: {
      id: ev.idHomeTeam ?? "",
      name: ev.strHomeTeam ?? "Home",
      abbreviation: makeAbbreviation(ev.strHomeTeam ?? "HOM"),
      score: homeScore,
      players: [],
    },
    awayTeam: {
      id: ev.idAwayTeam ?? "",
      name: ev.strAwayTeam ?? "Away",
      abbreviation: makeAbbreviation(ev.strAwayTeam ?? "AWY"),
      score: awayScore,
      players: [],
    },
    startTime,
    startTimeIso,
    // Postponed/cancelled events stay scheduled to avoid cluttering Last Played.
    status: (finished && !postponed) ? "final" : "scheduled",
    period: "",
    clock: "",
  };
}

/**
 * Fetches a league overview (upcoming + last played) from TheSportsDB.
 * TSDB doesn't provide live scores, so `live` is always [].
 *
 * @param {string | number} leagueId  TSDB numeric league ID
 * @param {string} leagueKey          our internal key, e.g. "nznbl"
 */
export async function getLeagueOverviewFromTsdb(leagueId, leagueKey) {
  const [nextData, pastData] = await Promise.all([
    fetchTsdb(`eventsnextleague.php?id=${leagueId}`).catch(() => ({ events: null })),
    fetchTsdb(`eventspastleague.php?id=${leagueId}`).catch(() => ({ events: null })),
  ]);

  const upcoming = (nextData.events ?? [])
    .filter((e) => e.strSport?.toLowerCase().includes("basketball") || !e.strSport)
    .map((e) => normalizeEvent(e, leagueKey))
    .filter((g) => g.status === "scheduled")
    .sort(
      (a, b) =>
        new Date(a.startTimeIso ?? 0).getTime() -
        new Date(b.startTimeIso ?? 0).getTime()
    );

  const past = (pastData.events ?? [])
    .filter((e) => e.strSport?.toLowerCase().includes("basketball") || !e.strSport)
    .map((e) => normalizeEvent(e, leagueKey))
    .filter((g) => g.status === "final")
    .sort(
      (a, b) =>
        new Date(b.startTimeIso ?? 0).getTime() -
        new Date(a.startTimeIso ?? 0).getTime()
    );

  return {
    live: [],
    upcoming,
    lastPlayed: past[0] ?? null,
  };
}

/**
 * Fetch a single game by its TheSportsDB event ID.
 * @param {string | number} eventId  TSDB numeric event ID (e.g. "2467092")
 * @param {string} leagueKey         our internal key, e.g. "nznbl"
 * @returns {Promise<object|null>}   normalized Game or null
 */
export async function getGameFromTsdb(eventId, leagueKey) {
  try {
    const data = await fetchTsdb(`lookupevent.php?id=${eventId}`);
    const events = data.events ?? [];
    if (events.length === 0) return null;
    const ev = events[0];
    const sport = (ev.strSport ?? "").toLowerCase();
    if (sport && !sport.includes("basketball")) return null;
    return normalizeEvent(ev, leagueKey);
  } catch (err) {
    return null;
  }
}

/**
 * Fetches today's events for a league from TSDB.
 * Compares against the viewer's LOCAL date string (not UTC) since TSDB
 * `dateEvent` is in the event's local timezone. Falls back to UTC if
 * the local comparison yields nothing.
 *
 * @param {string | number} leagueId
 * @param {string} leagueKey
 */
export async function getTodayGamesFromTsdb(leagueId, leagueKey) {
  try {
    const data = await fetchTsdb(`eventsnextleague.php?id=${leagueId}`);
    const events = data.events ?? [];

    // Use the viewer's local date (YYYY-MM-DD) as the primary match string.
    const localDate = new Date().toLocaleDateString("sv-SE"); // sv-SE = ISO date format
    const utcDate = new Date().toISOString().slice(0, 10);

    const matchDate = (e) =>
      (e.dateEvent ?? "") === localDate || (e.dateEvent ?? "") === utcDate;

    return events.filter(matchDate).map((e) => normalizeEvent(e, leagueKey));
  } catch {
    return [];
  }
}

/**
 * Fetch events by date string (YYYY-MM-DD) using TSDB's next/past events.
 * TSDB free tier has no per-date query, so we fetch the next/past 15 and filter.
 *
 * @param {string | number} leagueId
 * @param {string} leagueKey
 * @param {string} dateStr  YYYY-MM-DD (not YYYYMMDD)
 */
export async function getGamesByDateFromTsdb(leagueId, leagueKey, dateStr) {
  try {
    const [nextData, pastData] = await Promise.all([
      fetchTsdb(`eventsnextleague.php?id=${leagueId}`).catch(() => ({ events: null })),
      fetchTsdb(`eventspastleague.php?id=${leagueId}`).catch(() => ({ events: null })),
    ]);
    const all = [
      ...(nextData.events ?? []),
      ...(pastData.events ?? []),
    ];
    return all
      .filter((e) => (e.dateEvent ?? "") === dateStr)
      .map((e) => normalizeEvent(e, leagueKey));
  } catch {
    return [];
  }
}
