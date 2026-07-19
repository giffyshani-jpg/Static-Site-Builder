# HoopIQ — AI Handoff

## Latest Work

### Task 1: AI Fantasy Coach — COMPLETE

New files:
- `artifacts/hoopiq/src/lib/ai-coach.ts` — pure computation for 12 named coach picks
- `artifacts/hoopiq/src/components/ai-fantasy-coach.tsx` — collapsible pick-card UI

Modified:
- `artifacts/hoopiq/src/pages/fantasy-optimizer.tsx` — AI Coach integrated above budget section; live indicator fixed to primary (orange)
- `artifacts/hoopiq/src/pages/box-score.tsx` — live indicator fixed to primary + ping animation

### Session: UI/UX Redesign + Provider Reliability — COMPLETE

Modified (all in `artifacts/hoopiq/src/`):
- `index.css` — dark theme, orange primary, skeleton shimmer
- `providers/espn.js` — retry + timeout
- `providers/nba.js` — NBA CDN fallback
- `providers/nbadotcom.js` — getNbaOverview, getSummerLeagueOverview
- `providers/thesportsdb.js` — timezone-safe date matching, status handling
- `providers/nznbl.js` — always use TSDB primary; date format fix
- `components/game-card.tsx` — live pulse, leading team highlight, odds footer
- `components/layout.tsx` — basketball logo, FANTASY INTELLIGENCE tagline
- `pages/home.tsx` — LiveNowBanner, skeleton, date header
- `pages/box-score.tsx` — premium scoreboard header
- `pages/league-games.tsx` — shimmer skeleton
- `tsconfig.json` — allowJs, noImplicitAny: false
- `package.json` — tesseract.js

## What the Next AI Session Must Know

### Architecture
- **No backend** — all data from public ESPN/TheSportsDB APIs via browser fetch (CORS open)
- Provider contract: all UI imports via `src/api.js`, never directly from providers
- `safeCall()` wraps every provider call — never remove it
- `LINEUP_SIZE = 8`, `MAX_SAME_TEAM = 4` (lineup-storage.ts)
- TypeScript tsconfig has `allowJs: true`, `noImplicitAny: false` (required for JS provider imports)

### League status (July 2026)
- **NBA**: off-season, next game ~Oct 2026, `active: false`
- **WNBA**: in-season, active ✅ (7 upcoming games today)
- **NBA Summer League**: active during July, `active: true`
- **NBL**: off-season, next game ~Oct 2026, `active: false`
- **NZ NBL**: in-season (May–Aug), TheSportsDB source, `active: true`
- **FIBA**: varies by tournament, `active: true`

### Key invariants
- `game.league` must always be set correctly (Summer League was a past bug)
- NZ NBL games have `players: []` by design — TheSportsDB free tier has no player stats
- ESPN provider: 2 retries, 9s timeout, 600ms/1200ms backoff; 4xx NOT retried
- NBA CDN fallback: `cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`
- AI Coach computation: in `src/lib/ai-coach.ts` — pure functions, no side effects
- AI Coach UI: `src/components/ai-fantasy-coach.tsx` — uses `usePregameIntel` hook for scheduled games
- Fantasy Optimizer: `handleAutoPick()` skips OUT/DNP; doesn't assign C/VC (known limitation)

### Dev commands
- Typecheck: `pnpm --filter @workspace/hoopiq run typecheck` (must be 0 errors)
- Dev server: workflow `artifacts/hoopiq: web` (port from $PORT env)
- Working directory: `artifacts/hoopiq/src/` (NOT hoopiq-repo)

## Next Steps (Roadmap)

### Task 2: Player Intelligence (priority next)
- Upgrade Player Detail page with last 5/10 games, home/away averages, win/loss averages, starter/bench averages, minutes trend, fantasy trend, Boom%, Bust%, consistency score, value score, opponent history
- Use `src/hooks/use-player-game-log.ts` (already exists) and `src/lib/game-log-metrics.ts`
- Clean mobile-first cards

### Task 3: Provider Health Monitor
- Track response time, success rate, last update, current status per provider
- Auto-prioritize healthiest provider; retry intelligently; fallback automatically; silent failure logging

### Task 4: Optimizer Improvements
- Lock Player, Exclude Player, Core Players features
- Save Lineup, Better validation, Better lineup summary, Better mobile layout

### Task 5: General Improvements
- Bug fixes discovered during development
- Loading states, error handling, performance, responsiveness, accessibility
