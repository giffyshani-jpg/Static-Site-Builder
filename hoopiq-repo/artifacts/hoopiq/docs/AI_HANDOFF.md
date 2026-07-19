# HoopIQ — AI Handoff Document

Context for any agent picking up work on this codebase.

---

## What this app does

HoopIQ is a mobile-first fantasy basketball assistant. Core features:
- **Box Score page**: live/final game stats for any ESPN-covered basketball game
- **Pre-Game Intelligence panel**: projected minutes, form trends, injury status, back-to-back detection, blowout risk, opponent matchup context — for scheduled games
- **Fantasy Optimizer**: build an 8-player DFS lineup with Captain (×2) and Vice Captain (×1.5) multipliers, budget tracking, credit suggestions, saved lineups, OCR import, lineup slot visualization
- **Player detail**: full ESPN game log with Recharts charts; also a quick-access bottom sheet from the optimizer
- **League/date browser**: supports NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer League via ESPN public API

---

## Architecture

```
artifacts/hoopiq/
  src/
    api.js                  — ESPN fetch helpers + overview cache + game detail cache
    lib/
      espn.js               — ESPN provider (all network calls)
      types.ts              — shared TypeScript types (Game, Player, etc.)
      pregame-intel.ts      — heuristics: projectMinutes, computeRecommendation, etc.
      game-log-cache.ts     — sessionStorage cache for ESPN game logs (45-min TTL)
      game-log-metrics.ts   — computeGameLogMetrics (trend, consistency, avg FPTS)
      player-history.ts     — localStorage game tracking (builds "App Avg")
      stats.ts              — calculateFantasyPoints, DraftKings scoring
      player-status.ts      — minutesValue, inactiveStatusLabel, starterBadgeLabel
      optimizer.ts          — validateLineup (typed errors: lineup_size, etc.)
    hooks/
      use-pregame-intel.ts  — orchestrates all pre-game fetches; dedupes per game
      use-live-game.ts      — polls game every 5s (live) or 60s (scheduled); returns isStale
      use-player-game-log.ts — reads game-log-cache first, fetches on miss
    components/
      pregame-intel-panel.tsx — pre-game roster + intel panel (with skeleton loading)
      player-detail-sheet.tsx — quick-access bottom sheet overlay
      recommendation-badge.tsx — tier badge (Elite / Strong / Safe / Risky / Avoid)
      recent-form-badge.tsx   — inline L{N} avg badge with trend arrow
      injury-badge.tsx        — status badge (Out / Questionable / Starter / etc.)
      box-score.tsx           — live box score table
    pages/
      fantasy-optimizer.tsx  — main optimizer page (~1820 lines)
      player-detail.tsx      — full game log page
      league-games.tsx        — league game list
      home.tsx                — home page
```

---

## Key design decisions

### Data sources
- **All data from ESPN public API** — no paid sources, no auth required. The `espn.js` provider handles rate-limiting gracefully via `safeCall`.
- **"App Avg"** is locally tracked across box score views (localStorage), NOT an official season average. It's labeled clearly throughout.
- **Recent form** in the bottom sheet is from localStorage too — only games the user has viewed in the app.

### Caching strategy
| Data | Cache | TTL |
|------|-------|-----|
| Player game logs | sessionStorage | 45 min |
| League overview | in-memory + sessionStorage | 2 min |
| Game detail (`fetchGameById`) | in-memory only | 30s live · 2min scheduled · 5min final |
| Pre-game intel | `loadedForGameId` ref (per-mount) | session |
| Live game | re-fetched on poll interval (noCache: true) | 5s live / 60s scheduled |

### Live polling and stale detection
`useLiveGame` polls every 5 s (live) or 60 s (pregame). Poll loops always pass `{ noCache: true }` to `fetchGameById`. After 2 consecutive polls returning no data the hook sets `isStale: true`, which surfaces as an amber "Reconnecting…" indicator in the box score header. Resets automatically on the next successful poll.

### Confidence indicator (pre-game panel)
Derived heuristic — not official. Score: +2 Consistent, +1 SomewhatConsistent, +1 ConfirmedStarter, -1 B2B, -1 Questionable/GTD. ≥3 = High, ≥1 = Moderate, else Low.

### Optimizer validation
`validateLineup` lives in `lib/optimizer.ts`. Returns an array of typed errors: `lineup_size`, `no_captain`, `no_vice_captain`, `team_limit`. The checklist in the UI maps these to human-readable items with actionable hints. A slot visualization card (Roster Slots) always shows the 8 named slots to make C/VC assignment obvious.

### Optimizer filters
The filter panel is **collapsible** — sort + search are always visible; team/position/toggle filters collapse behind a Filters button with an active-count badge. Auto-opens when saved prefs contain non-default values.

### ESPN API quirks
- See `docs/espn-api-notes.md` for league slug issues.
- `scan: true` on `fetchLeagueOverview` can hit 60–180+ endpoint calls (date range scan). Cached for 2 min.
- Game IDs are ESPN's internal numeric IDs (not dates). Game status is `scheduled | in_progress | final`.
- Injury status comes from `athlete.injuries[]` in the roster endpoint — not always populated before tip-off.

---

## What was just completed (July 2026 Reliability & Intelligence pass)

Full details in `docs/CHANGELOG.md`. Summary:

1. **Import fixes** — restored `Link` and `useRef` which had been removed in error
2. **Game detail cache** — `fetchGameById` now has TTL-based in-memory cache (30s/2min/5min by status); poll loops opt out via `noCache: true` but still write to cache on success
3. **Opponent matchup context** — pre-game panel player rows now show `vs ABBR` or `@ ABBR`
4. **Collapsible filter panel** — optimizer filter section collapses behind a Filters button; active count badge when collapsed
5. **Lineup slot visualization** — 8 named roster rows below the checklist; C/VC slots show hints when unassigned
6. **Live update error handling** — `isStale` / "Reconnecting…" amber indicator after 2 consecutive poll misses
7. **Pregame panel skeleton** — animated skeleton bars replace the plain "Loading…" text

---

## Known limitations (not bugs)

- `computeTrend` in `recent-form-badge.tsx` compares only the *last single entry* to the prior average — one good game can show "Hot". Intentional simplification.
- App Avg is only as useful as how many box scores the user has opened. New users see "—" everywhere. By design.
- The optimizer doesn't enforce position limits — DraftKings showdown format has no position limits, which is the primary use case.
- NZ NBL live scores can lag 2–5 min vs. TheSportsDB's update frequency.
- Injury status not always populated by ESPN until ~1 hr before tip-off.

---

## Where to start next

See `docs/ROADMAP.md` for the full backlog. Highest-impact near-term items:

1. **Home/away split indicators** — player rows in pre-game panel; needs game-log data to derive home/away performance diff
2. **Opponent defensive rating context** — heuristic matchup rating without a paid source
3. **Background refresh** — stale-while-revalidate for league overview (requires React subscription mechanism or polling at component level)
4. **Export lineup to clipboard** — copy DraftKings CSV format
