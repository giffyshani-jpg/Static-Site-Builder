---
name: Provider reliability approach
description: Multi-provider fallback patterns, ESPN retry logic, known provider quirks
---

## Provider chain (July 2026)
- NBA: ESPN primary → NBA CDN fallback (nbadotcom.js `getNbaTodayGames`/`getNbaOverview`)
- WNBA: ESPN primary (active season, reliable)
- NBA Summer League: ESPN NBA slug filtered to season.type===3 → NBA CDN `getSummerLeagueOverview`
- NZ NBL: TheSportsDB ID 5066 primary (ESPN returns HTTP 400 for "nznbl" slug)
- Australia NBL: ESPN (off-season July 2026, next season Oct 2026)
- FIBA: ESPN (varies by tournament window)

## ESPN retry logic
- `fetchJson()` in providers/espn.js: 2 retries, 600ms*attempt backoff, 9s timeout per attempt
- 4xx errors are NOT retried (ESPN returns 400/404 for unsupported leagues — don't hammer)
- 5xx and network errors ARE retried

## TheSportsDB
- Free tier: next/past 15 events per league, no live scores, no player stats
- `dateEvent` field is local timezone, not UTC — compare against both local AND utc date
- `isEventFinished()`: handles "Match Finished", "FT", "AET", "AP", "PSO", "Abandoned"
- Postponed/cancelled events kept as "scheduled" so they don't pollute Last Played

## NBA CDN
- Base: `https://cdn.nba.com/static/json`
- `todaysScoreboard_00.json` — live scoreboard (includes Summer League)
- Summer League identification: `g.gameLabel.includes("Summer")` OR gameId.startsWith("001")
- CORS: requires `Origin: https://www.nba.com` header from browser

## api.js caching
- Overview cache: 2 min TTL, memory + sessionStorage, keyed by `${league}:${scan ? "1" : "0"}`
- In-flight coalescing: concurrent requests for same key share one Promise
- Game detail cache: 30s (live), 5min (final), 2min (scheduled)

**Why:** ESPN rate-limits; NBA CDN is more reliable for live game detection
