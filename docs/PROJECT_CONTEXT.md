# HoopIQ — Project Context

## Vision
HoopIQ is a mobile-first basketball hub for serious fantasy basketball players and fans. It aggregates live scores, box scores, player stats, and pre-game intelligence from multiple leagues in one clean interface. The core differentiator is the Fantasy Optimizer — a lineup-building tool with credit budgeting, captain/VC roles, auto-pick, OCR import, and pre-game intelligence powered by real ESPN data.

## Architecture

### Stack
- **Frontend**: React + Vite, TypeScript, Tailwind CSS, shadcn/ui components
- **Routing**: Wouter (lightweight SPA routing)
- **State**: React useState/useEffect (no Redux), TanStack Query not used — raw fetch in hooks
- **Persistence**: Browser localStorage only (no backend, no database)
- **Build**: pnpm monorepo, artifact at `artifacts/hoopiq/`

### Data Sources
| League | Source | Status |
|--------|--------|--------|
| NBA | ESPN Site API (`nba`) | Off-season; returns Oct 2026 |
| WNBA | ESPN Site API (`wnba`) | Active ✅ |
| NBA Summer League | ESPN NBA scoreboard filtered for type-3 events | Active during July ✅ |
| NBL (Australia) | ESPN Site API (`nbl`) | Off-season; returns Oct 2026 |
| NZ NBL | TheSportsDB ID 5066 + ESPN fallback | Active May–Aug ✅ |
| FIBA | ESPN Site API (`fiba`) | Varies by tournament |

### Key Files
| Path | Purpose |
|------|---------|
| `src/api.js` | Adapter layer — UI imports only from here |
| `src/providers/espn.js` | All ESPN API logic (shared by NBA, WNBA, NBL, FIBA, Summer) |
| `src/providers/thesportsdb.js` | TheSportsDB integration (NZ NBL) |
| `src/providers/nznbl.js` | NZ NBL: TheSportsDB primary, ESPN fallback |
| `src/providers/nba-summer.js` | NBA Summer League: ESPN NBA with type-3 filter |
| `src/pages/fantasy-optimizer.tsx` | The Fantasy Optimizer UI (1500+ lines) |
| `src/pages/home.tsx` | Home page with premium league cards + Other Basketball group |
| `src/lib/pregame-intel.ts` | Pre-game intelligence heuristics |
| `src/lib/lineup-storage.ts` | Saved lineups, lineup validation |
| `src/lib/fantasy-storage.ts` | Budget + credits localStorage persistence |
| `src/lib/stats.ts` | Fantasy points formula |
| `src/components/pregame-intel-panel.tsx` | Pre-Game Intelligence UI panel |

### Routing (Wouter)
```
/                    → Home
/:league             → League Games (e.g. /nba, /wnba)
/:league/game/:id    → Box Score
/:league/game/:id/optimizer → Fantasy Optimizer
/:league/game/:id/plays     → Play-by-Play
/:league/game/:id/compare   → Player Comparison
/:league/player/:playerId   → Player Detail
```

## League Priorities
1. **NBA** — #1, full-width premium card on home page
2. **WNBA** — #2, full-width premium card on home page
3. **Other Basketball** (grouped under collapsible card):
   - Australian NBL
   - NZ NBL (TheSportsDB)
   - FIBA
   - NBA Summer League (auto-hides when no live/upcoming games)

## Coding Standards
- TypeScript for all new files; JS preserved for providers/api to avoid migration churn
- No backend — all data from public ESPN/TheSportsDB APIs via browser fetch (CORS open)
- `safeCall()` wraps every provider call so one failure never crashes the app
- Use `req.log` / `logger` for server code, never `console.log` — but hoopiq is frontend-only
- Components in `src/components/`, pages in `src/pages/`, lib utilities in `src/lib/`
- Provider contract: every provider must export `getTodayGames`, `getGamesByDate`, `getGame`, `getPlayerGameLog`, `getTeamSchedule`, `getLeagueOverview`

## Things That Should NEVER Be Rewritten
- `src/providers/espn.js` — battle-tested ESPN API normalization; only add to it
- `src/lib/stats.ts` — fantasy points formula is the source of truth for FPTS
- `src/lib/pregame-intel.ts` — carefully calibrated heuristics; change thresholds with documentation
- `src/lib/lineup-storage.ts` — lineup validation rules (8 players, max 4 per team, C/VC)
- Provider contract in `src/api.js` — UI never imports from providers directly
- The `safeCall()` wrapper — it must stay around every provider invocation
