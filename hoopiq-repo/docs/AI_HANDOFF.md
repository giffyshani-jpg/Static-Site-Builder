# HoopIQ — AI Handoff

## Latest Commit
`67a6aa4` — feat(Task 3): Other Basketball polish — NZ NBL box score context, FIBA tournament window message, thesportsdb status handling

## All Three Tasks — COMPLETE

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | eb8ee2b | Fantasy Intelligence UX — Auto-Pick, Clear, progress bar, amber credits, docs |
| Task 2 | 17f42e1 | NBA/WNBA reliability — off-season banner, live auto-refresh, next-game date |
| Task 3 | 67a6aa4 | Other Basketball — NZ NBL box score message, FIBA window context, TSDB status |

## Files Modified (this session)

### New files
- `docs/PROJECT_CONTEXT.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`
- `docs/AI_HANDOFF.md`
- `docs/KNOWN_ISSUES.md`

### Modified
- `artifacts/hoopiq/src/pages/fantasy-optimizer.tsx` — Task 1 changes
- `artifacts/hoopiq/src/pages/league-games.tsx` — Task 2 + Task 3 changes
- `artifacts/hoopiq/src/pages/box-score.tsx` — Task 3 NZ NBL/FIBA box score messages
- `artifacts/hoopiq/src/providers/thesportsdb.js` — Task 3 status handling + abbreviation helper

## What the Next AI Session Must Know

### Architecture
- **No backend** — all data from public ESPN/TheSportsDB APIs via browser fetch (CORS open)
- Provider contract: all UI imports via `src/api.js`, never directly from providers
- `safeCall()` wraps every provider call — never remove it
- `LINEUP_SIZE = 8`, `MAX_SAME_TEAM = 4` (lineup-storage.ts)

### League status (July 2026)
- **NBA**: off-season, next game ~Oct 2026, `active: false`
- **WNBA**: in-season, active ✅
- **NBA Summer League**: active during July, `active: true`
- **NBL**: off-season, next game ~Oct 2026, `active: false`
- **NZ NBL**: in-season (May–Aug), TheSportsDB source, `active: true`
- **FIBA**: varies by tournament, `active: true`

### Key invariants
- `game.league` must always be set correctly (Summer League was a past bug)
- NZ NBL games have `players: []` by design — TheSportsDB free tier has no player stats
- thesportsdb.js: `isEventFinished()` now handles AET/AP/PSO/Abandoned; postponed/cancelled stay "scheduled"
- League page: FIBA gets a tournament-window specific empty state; NBA/NBL get off-season banner
- Fantasy Optimizer: `handleAutoPick()` skips OUT/DNP players; doesn't assign C/VC (known limitation)

### Dev commands
- Typecheck: `pnpm --filter @workspace/hoopiq run typecheck`
- Dev server: `pnpm --filter @workspace/hoopiq run dev` (workflow `HoopIQ`, port 5173)

## Next Steps (if any)
No further tasks requested. See `docs/ROADMAP.md` for future ideas.
