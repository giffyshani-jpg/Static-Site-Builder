---
name: ESPN API basketball league slugs
description: Which ESPN public API slugs return data vs 400 for basketball; verified July 2026.
---

## Working ESPN basketball slugs (HTTP 200)

| LeagueKey | ESPN slug |
|---|---|
| nba | `nba` |
| wnba | `wnba` |
| nbl | `nbl` |
| fiba | `fiba` |
| ncaam | `mens-college-basketball` |
| ncaaw | `womens-college-basketball` |

Base URL: `https://site.api.espn.com/apis/site/v2/sports/basketball/<slug>/scoreboard`

## Unsupported (HTTP 400 — no public endpoint)

- `nba-summer-league` → 400 (NBA Summer League not served via public API)
- `nznbl` → 400 (New Zealand NBL not served)
- `eurocup`, `euroleague` → 400 (ESPN does not carry these leagues at all)

**Why:** These leagues have provider files in `providers/` for future use but are excluded from `ALL_LEAGUES` in `api.js` so they don't appear as permanent "No games soon" cards.

## Notes on dated queries

Some ESPN slugs support `?dates=YYYYMMDD` while others only return current-day data. `getLeagueOverview` in `providers/espn.js` handles 400 errors from dated queries gracefully (returns empty array), so only the default scoreboard result is used for those leagues.

## Timezone-safe live detection

`getLeagueOverview` always fetches the *default* scoreboard (no date param) first — this is ESPN's authoritative "now" view and correctly shows LIVE games regardless of the viewer's timezone (IST, PST, etc.). Classifies purely by `status.type.state`, never by comparing calendar dates.
