---
name: HoopIQ / ESPN player game log
description: ESPN's undocumented gamelog endpoint provides real per-player historical box scores (date, opponent, home/away, W/L, full stat line), keyed by the same athlete id used elsewhere in ESPN's Site API. Missing fields and open CORS behavior documented here.
---

## What it is
`https://site.web.api.espn.com/apis/common/v3/sports/basketball/{league}/athletes/{athleteId}/gamelog`
(league = `nba` or `wnba`). This is separate from `site.api.espn.com/.../scoreboard` (today's games only)
and `.../summary?event={id}` (single game box score) already used elsewhere in this codebase.

**Why this matters:** an earlier pass at this codebase assumed ESPN had no historical
per-player endpoint and built a localStorage-only "recent form" fallback
(games viewed in-app). That assumption was wrong — always check this endpoint
before reaching for a third-party fallback provider for basketball player history.

## Capabilities confirmed
- Real historical games grouped by season type (regular season, playoffs/play-in, preseason),
  each with a parallel `names`/`stats` array covering MIN, FG, 3PT, FT, REB, AST, BLK, STL, PF, TO, PTS.
- Per-event date, opponent (id/abbreviation/name), home/away (`atVs`: `"vs"` = home, `"@"` = away),
  final score, and W/L result.
- Keyed by the same athlete id already returned in box score/summary responses — no separate
  id-lookup step needed.
- CORS is open (`Access-Control-Allow-Origin: *`), safe to call directly from the browser like
  the other ESPN Site API endpoints this app uses.

## Known gaps (must be documented to users of this data, not silently guessed)
- No starter/bench status per historical game (only a specific game's live summary has it).
- No plus/minus per historical game (same limitation).
- Preseason games are mixed into `seasonTypes` — filter them out unless preseason data is wanted.

## How it's used in HoopIQ
Client-side only: `providers/espn.js` → `getPlayerGameLog`, wrapped per-league in
`providers/nba.js`/`wnba.js`, exposed via `api.js` → `fetchPlayerGameLog`. Cached in
`lib/game-log-cache.ts` (sessionStorage, 45 min TTL) — the cache is a performance layer only,
never a substitute for the network call. Derived metrics (avg FPTS, high/low, trend, consistency)
live in `lib/game-log-metrics.ts`. Surfaced on a dedicated `/​:league/player/:playerId` page,
linked from the existing `PlayerDetailSheet` modal via a `league` prop.
