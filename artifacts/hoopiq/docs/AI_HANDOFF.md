# HoopIQ — AI Handoff Document

Context for any agent picking up work on this codebase.

---

## What this app does

HoopIQ is a mobile-first fantasy basketball assistant. Core features:
- **Box Score page**: live/final game stats for any ESPN-covered basketball game
- **Pre-Game Intelligence panel**: projected minutes, form trends, injury status, back-to-back detection, blowout risk — for scheduled games
- **Fantasy Optimizer**: build an 8-player DFS lineup with Captain (×2) and Vice Captain (×1.5) multipliers, budget tracking, credit suggestions, saved lineups, OCR import
- **Player detail**: full ESPN game log with Recharts charts; also a quick-access bottom sheet from the optimizer
- **League/date browser**: supports NBA, WNBA, NBL, NZNBL, FIBA, NBA Summer League via ESPN public API

---

## Architecture

```
artifacts/hoopiq/
  src/
    api.js                  — ESPN fetch helpers + league overview cache
    lib/
      espn.js               — ESPN provider (all network calls)
      types.ts              — shared TypeScript types (Game, Player, etc.)
      pregame-intel.ts      — heuristics: projectMinutes, computeRecommendation, etc.
      game-log-cache.ts     — sessionStorage cache for ESPN game logs (45-min TTL)
      game-log-metrics.ts   — computeGameLogMetrics (trend, consistency, avg FPTS)
      player-history.ts     — localStorage game tracking (builds "App Avg")
      stats.ts              — calculateFantasyPoints, DraftKings scoring
      player-status.ts      — minutesValue, inactiveStatusLabel, starterBadgeLabel
    hooks/
      use-pregame-intel.ts  — orchestrates all pre-game fetches; dedupes per game
      use-live-game.ts      — polls game every 5s (live) or 60s (scheduled)
      use-player-game-log.ts — reads game-log-cache first, fetches on miss
    components/
      pregame-intel-panel.tsx — pre-game roster + intel panel
      player-detail-sheet.tsx — quick-access bottom sheet overlay
      recommendation-badge.tsx — tier badge (Elite / Strong / Safe / Risky / Avoid)
      recent-form-badge.tsx   — inline L{N} avg badge with trend arrow
      injury-badge.tsx        — status badge (Out / Questionable / Starter / etc.)
      box-score.tsx           — live box score table
    pages/
      fantasy-optimizer.tsx  — main optimizer page (~1730 lines)
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
| Pre-game intel | `loadedForGameId` ref (per-mount) | session |
| Live game | re-fetched on poll interval | 5s live / 60s scheduled |

### Confidence indicator (pre-game panel)
Derived heuristic — not official. Score: +2 Consistent, +1 SomewhatConsistent, +1 ConfirmedStarter, -1 B2B, -1 Questionable/GTD. ≥3 = High, ≥1 = Moderate, else Low.

### Optimizer validation
`validateLineup` lives in `lib/optimizer.ts`. Returns an array of typed errors: `lineup_size`, `no_captain`, `no_vice_captain`, `team_limit`. The checklist in the UI maps these to human-readable items with actionable hints.

### ESPN API quirks
- See `docs/espn-api-notes.md` for league slug issues.
- `scan: true` on `fetchLeagueOverview` can hit 60–180+ endpoint calls (date range scan). Cached for 2 min.
- Game IDs are ESPN's internal numeric IDs (not dates). Game status is `scheduled | in_progress | final`.
- Injury status comes from `athlete.injuries[]` in the roster endpoint — not always populated before tip-off.

---

## What was just completed (July 2026 polish pass)

Full details in `docs/CHANGELOG.md`. Summary:

1. **Pre-game panel** — redesigned player rows (Proj Min + FPTS L5 + Confidence), simplified blowout risk, OUT players dimmed, better availability cards
2. **Player detail sheet** — color-coded bar chart (green/red/purple), average reference line, moved "Full Game Log" link to top, hidden scheduled-game zeros, better labels
3. **Optimizer** — credit usage bar, unified requirements checklist with actionable hints, larger C/VC buttons
4. **API layer** — 2-min cache + in-flight dedup for `fetchLeagueOverview`
5. **Bugs fixed** — scheduled game stats hidden, empty form heading fixed, OUT player projections suppressed

---

## Known limitations (not bugs)

- `computeTrend` in `recent-form-badge.tsx` compares only the *last single entry* to the prior average — one good game can show "Hot". This is a deliberate simplification; calling it out so it doesn't get "fixed" prematurely.
- App Avg is only as useful as how many box scores the user has opened. New users see "—" everywhere. This is by design — we never show misleading small-sample averages as if they're official.
- The optimizer doesn't enforce position limits (e.g. max 2 guards) — DraftKings showdown format has no position limits, which is the primary use case.

---

## Where to start next

See `docs/ROADMAP.md` for the full backlog. Highest-impact near-term items:
1. **Lineup slot visualization** — show the 8 slots as named cards so C/VC assignment is obvious
2. **Game detail cache** — short-TTL sessionStorage cache for `fetchGameById` to reduce remount refetches
3. **Collapsible filter section** — reduce scrolling in the optimizer player list
