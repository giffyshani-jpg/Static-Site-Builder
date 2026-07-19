---
name: HoopIQ project overview
description: Stack, architecture, key invariants for the HoopIQ basketball fantasy assistant
---

## Stack
- React + Vite + TypeScript (TSX pages, JS providers/api)
- Tailwind CSS v4 with custom dark sports theme (orange primary #f97316, deep navy background)
- Wouter for routing
- No backend — pure client-side, all data from public APIs

## Artifact location
- `artifacts/hoopiq/` — the active workspace
- `hoopiq-repo/artifacts/hoopiq/` — cloned GitHub repo (reference only, don't edit)
- Source: `https://github.com/giffyshani-jpg/Static-Site-Builder`

## Key invariants
- `safeCall()` in api.js must wrap every provider call — never remove
- UI never imports from providers directly — only from `src/api.js`
- `LINEUP_SIZE = 8`, `MAX_SAME_TEAM = 4` (fantasy optimizer constants)
- `src/lib/stats.ts` is the fantasy points formula source of truth
- NZ NBL games have `players: []` by design (TheSportsDB free tier has no player stats)
- TypeScript check must pass before committing: `pnpm --filter @workspace/hoopiq run typecheck`
- tsconfig has `allowJs: true, noImplicitAny: false` to allow JS provider imports from TSX files

## Routes
- `/` → Home
- `/:league` → LeagueGames
- `/:league/game/:id` → BoxScore (+ pregame intel panel when status=scheduled)
- `/:league/game/:id/optimizer` → FantasyOptimizer
- `/:league/game/:id/plays` → PlayByPlay
- `/:league/game/:id/compare` → PlayerComparison
- `/:league/player/:playerId` → PlayerDetail

## CSS theme
- Background: 222 20% 7% (deep navy)
- Primary: 24 95% 53% (basketball orange)
- Card: 222 18% 10%
- index.css has `.skeleton-shimmer` and `.live-dot` utility classes

## Fantasy Intelligence architecture
- `lib/stats.ts` — `calculateFantasyPoints()` formula
- `lib/game-log-metrics.ts` — `computeGameLogMetrics()` for hot/cold trend, consistency, avg FPTS
- `lib/pregame-intel.ts` — `computeRecommendation()`, `buildLineupStatus()`, `projectMinutes()`
- `components/pregame-intel-panel.tsx` — full pregame intelligence card shown on scheduled games
- `components/recommendation-badge.tsx` — Elite/Strong/Safe/Risky/Avoid badge
- `components/recent-form-badge.tsx` — L5 form badge shown in box score
