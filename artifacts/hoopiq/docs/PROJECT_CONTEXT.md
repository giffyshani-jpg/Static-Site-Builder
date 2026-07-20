# HoopIQ — Project Context

> One-page orientation for any agent starting fresh on this codebase.
> **Updated**: July 20, 2026 — box-score star removed; AI Coach in optimizer; all 12 pick explanations carry real numbers.

---

## What it is

HoopIQ is a **mobile-first fantasy basketball assistant** built as a React + Vite SPA, served from `artifacts/hoopiq/` inside a pnpm monorepo. There is no custom backend — all live data comes from **ESPN's public (unauthenticated) API** via `src/lib/espn.js`.

Core pages:

| Page | Route | Purpose |
|------|-------|---------|
| Home | `/` | League status cards (NBA, WNBA, Other Basketball) |
| League Games | `/:league` | Date-browsable game list |
| Box Score | `/:league/game/:id` | Live/final box score + Pre-Game Intel panel |
| Fantasy Optimizer | `/:league/game/:id/optimizer` | DFS lineup builder (DraftKings showdown format) |
| Play-by-Play | `/:league/game/:id/plays` | Live play feed |
| Player Detail | `/:league/player/:id` | Full game log (ESPN, Recharts charts) |

---

## Leagues supported

| Key | Provider | Status (July 2026) |
|-----|----------|--------------------|
| `nba` | ESPN | Off-season (returns Oct 2026) |
| `wnba` | ESPN | In-season ✅ |
| `nba-summer` | ESPN type-3 filter | Active July ✅ |
| `nbl` | ESPN | Off-season (returns Oct 2026) |
| `nznbl` | TheSportsDB ID 5066 | In-season ✅ |
| `fiba` | ESPN | Varies by tournament |

Australia NBL, NZ NBL, and FIBA are grouped under "Other Basketball" on the home page. Do not add new leagues unless strictly required.

---

## Architecture at a glance

```
src/
  api.js                  — adapter boundary; all UI imports data through here
  providers/              — one file per league (espn.js, nba.js, wnba.js, …)
  lib/
    espn.js               — ESPN API fetch helpers (safeCall, rate-limit guard)
    types.ts              — Game, Player, LeagueKey, … TypeScript types
    pregame-intel.ts      — heuristics: projectedMinutes, confidence, blowout risk
    game-log-cache.ts     — sessionStorage cache for ESPN game logs (45-min TTL)
    game-log-metrics.ts   — computeGameLogMetrics (trend, consistency, avg FPTS)
    player-history.ts     — localStorage game tracking (builds "App Avg")
    stats.ts              — calculateFantasyPoints, DraftKings scoring
    optimizer.ts          — validateLineup (typed errors: lineup_size, etc.)
    player-status.ts      — minutesValue, inactiveStatusLabel, starterBadgeLabel
  hooks/
    use-live-game.ts      — polls fetchGameById every 5s (live) or 60s (scheduled)
    use-pregame-intel.ts  — orchestrates roster/injury/schedule fetches pre-game
    use-player-game-log.ts — reads game-log-cache first, fetches on miss
  components/
    pregame-intel-panel.tsx
    player-detail-sheet.tsx
    recommendation-badge.tsx
    recent-form-badge.tsx
    injury-badge.tsx
  pages/
    home.tsx
    league-games.tsx
    box-score.tsx
    fantasy-optimizer.tsx  (~1730 lines)
    player-detail.tsx
    play-by-play.tsx
```

---

## Key invariants

- **Never import from a provider directly** — always go through `src/api.js`.
- **"App Avg"** is localStorage-tracked (only games viewed in the app), NOT an official season average. Always label it clearly.
- **Optimizer** is DraftKings showdown format: 8 players, 1 Captain (×2.0), 1 Vice Captain (×1.5), no position limits.
- **ESPN API** can return 400 for some league slugs — see `docs/espn-api-notes.md` if you hit errors. `safeCall` in `espn.js` guards every fetch.
- **Mobile-first** — every new UI component must work on a 390px-wide screen before a 1200px one.
- **TypeScript cleanliness** — run `pnpm tsc --noEmit` after every batch of edits. Do not leave type errors.

---

## Caching summary

| Data | Where | TTL |
|------|-------|-----|
| Player game logs | sessionStorage | 45 min |
| League overview | in-memory + sessionStorage | 2 min |
| Game detail (fetchGameById) | in-memory only | 30s live · 5min final · 2min scheduled |
| Pre-game intel | per-mount ref | session |

---

## Commit discipline

Commit after every completed task with a meaningful message. Update `CHANGELOG.md`, `ROADMAP.md`, `AI_HANDOFF.md` (and `KNOWN_ISSUES.md` if applicable) before every commit. Do **not** push to remote — local commits only.
