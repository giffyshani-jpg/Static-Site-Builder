# HoopIQ — AI Handoff

## Latest Commit
`c028048` — feat(Phase 1+2): redesign home page — NBA/WNBA premium cards, Other Basketball group, Summer League auto-hide

## Current Project State
- App is a mobile-first React+Vite SPA in `artifacts/hoopiq/`
- All three task groups are in progress (Task 1 first, per workflow rules)
- Docs directory just created at `docs/` (PROJECT_CONTEXT, ROADMAP, CHANGELOG, AI_HANDOFF, KNOWN_ISSUES)
- Workflow name: `HoopIQ` — runs `pnpm --filter @workspace/hoopiq run dev`

## Current Task
**Task 1: Improve Fantasy Intelligence UX** (in progress)

Changes being made to `artifacts/hoopiq/src/pages/fantasy-optimizer.tsx`:
1. `handleAutoPick()` — greedy best-FPTS within budget, skips OUT/DNP players
2. `handleClearLineup()` — clears all 8 slots + C/VC roles
3. Lineup progress bar (visual slot fill indicator)
4. Remaining credits color: amber when 1–19% of budget remaining
5. "Auto-Pick Best" + "Clear" buttons in the controls row
6. Shorten "Avoid players already used in previous saved teams" → "Avoid players used in other lineups"

## Remaining Tasks (in order)
1. **Task 2**: Improve NBA and WNBA reliability and polish
   - Investigate what "reliability" means: possibly improve error states, add retry logic, better loading skeletons
   - Polish: cleaner game cards, better score display, improved typography
2. **Task 3**: Improve Other Basketball (NBL/NZ NBL/FIBA) without adding new providers
   - NZ NBL: better empty states for missing box score data
   - FIBA: graceful handling of between-tournament periods
   - NBL: off-season messaging

## Important Implementation Notes
- **Never import from providers directly** — always go through `src/api.js`
- **safeCall wraps every provider** — never remove it
- **LINEUP_SIZE = 8**, **MAX_SAME_TEAM = 4** (from `src/lib/lineup-storage.ts`)
- **LeagueKey** union type in `src/lib/types.ts` must be updated if leagues change
- `game.league` field must be set correctly on all returned games (Summer League bug was fixed in 39c4235)
- TheSportsDB NZ NBL returns no player-level stats — don't try to render box score players for NZ NBL games
- ESPN API base: `https://site.api.espn.com/apis/site/v2/sports/basketball`
- Gamelog base: `https://site.web.api.espn.com/apis/common/v3/sports/basketball`

## Files Modified (this session)
- `docs/PROJECT_CONTEXT.md` (created)
- `docs/ROADMAP.md` (created)
- `docs/CHANGELOG.md` (created)
- `docs/AI_HANDOFF.md` (created)
- `docs/KNOWN_ISSUES.md` (created)
- `artifacts/hoopiq/src/pages/fantasy-optimizer.tsx` (Task 1 changes)

## What the Next AI Session Must Know
- Read `docs/PROJECT_CONTEXT.md` before touching any provider or api.js
- The app has NO backend — all data is client-side fetch from public ESPN/TSDB APIs
- Checking typecheck: `pnpm --filter @workspace/hoopiq run typecheck`
- Building: `pnpm --filter @workspace/hoopiq run build` (needs PORT env var from workflow)
- The Summer League `nba-summer` provider hits the NBA scoreboard and filters for `seasonType.type === 3` events
- NZ NBL uses TheSportsDB league ID 5066 — not ESPN
