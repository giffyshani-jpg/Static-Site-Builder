# HoopIQ — AI Handoff Document

Context for any agent picking up work on this codebase.

> **Last session**: July 24, 2026 — Multi-sport platform expansion: Cricket architecture, scoring engine, optimizer, home page integration.
> **Git state**: Committed locally. Push attempted (see Git section below).
> **TypeScript**: Clean — `pnpm typecheck` passes with 0 errors.

---

## What changed this session

| Change | File(s) |
|--------|---------|
| Cricket auto-discovery provider (30+ slugs) | `src/providers/cricket.js` |
| Cricket-specific type definitions | `src/lib/cricket-types.ts` |
| Fantasy scoring rule engine (T20/ODI/Test/Hundred/T10) | `src/lib/cricket-scoring.ts` |
| Multi-provider fantasy metadata (FantasyWala, Calc11, DafaFantasy) | `src/lib/fantasy-providers.ts` |
| Cricket box score page | `src/pages/cricket-box-score.tsx` |
| Cricket fantasy optimizer | `src/pages/cricket-optimizer.tsx` |
| Home page — cricket section added | `src/pages/home.tsx` |
| Routing — cricket routes added before generic routes | `src/App.tsx` |
| API layer — cricket adapter + export functions | `src/api.js` |
| `LeagueKey` type — "cricket" added | `src/lib/types.ts` |

---

## Architecture overview (post-session)

```
artifacts/hoopiq/
  src/
    api.js                  — adapter boundary; basketball + cricket exports
    providers/
      espn.js               — ESPN basketball engine
      nba.js / wnba.js / …  — basketball providers
      cricket.js            — NEW: ESPN cricket auto-discovery (30+ slugs)
    lib/
      types.ts              — basketball types + LeagueKey includes "cricket"
      cricket-types.ts      — NEW: CricketGame, CricketPlayer, CricketInnings, …
      cricket-scoring.ts    — NEW: scoring rule engine + T20/ODI/Test/Hundred/T10 profiles
      fantasy-providers.ts  — NEW: FantasyWala, Calc11, DafaFantasy metadata fetcher
      stats.ts              — basketball calculateFantasyPoints (DraftKings)
      pregame-intel.ts      — basketball pre-game heuristics
      optimizer.ts          — basketball lineup validation
    pages/
      home.tsx              — updated: Cricket section added between WNBA and Other Basketball
      cricket-box-score.tsx — NEW: batting + bowling scorecards
      cricket-optimizer.tsx — NEW: 11-player optimizer with cricket scoring
      fantasy-optimizer.tsx — basketball optimizer (unchanged ~1914 lines)
    App.tsx                 — cricket routes added BEFORE generic /:league routes
```

---

## Cricket architecture — key decisions

### Auto-discovery
- `COMPETITION_REGISTRY` in `providers/cricket.js` is the single list of ESPN cricket slugs.
- `getLeagueOverview()` queries all slugs in parallel; each failure is swallowed gracefully.
- **Adding a new T20 league = add one object to COMPETITION_REGISTRY. Zero other changes.**

### Scoring rule engine
- Rules are DATA, not code. `ScoringProfile` encodes all rules as plain objects.
- `getScoringProfile(format, competitionName)` auto-selects profile from match format.
- The Hundred: SR and Economy bonuses are disabled (per spec). Test: lower wicket value, no SR/Economy.
- New formats: add a new `ScoringProfile` object to `SCORING_PROFILES` map.

### Fantasy providers
- All three providers (FantasyWala, Calc11, DafaFantasy) are tried in parallel.
- Any that fail (404, timeout, parse error) are silently swallowed.
- Optimizer works with or without credit data (falls back to 8.5 credits default).

### Routing
- Cricket routes: `/cricket/:competition/game/:id` (NOT under `/:league/game/:id`)
- Game IDs: `{competitionSlug}:{espnEventId}` — box score/optimizer pages parse the slug out.
- The home page Cricket section links to `/cricket/{slug}/game/{id}` format.

---

## What the app does (updated)

HoopIQ is a mobile-first **multi-sport** fantasy intelligence assistant:
- **Basketball**: NBA, WNBA (primary); NBL, NZ NBL, FIBA, Summer League (secondary)
- **Cricket**: Auto-discovered competitions (30+ slugs covering IPL, BBL, CPL, PSL, SA20, ILT20, The Hundred, MLC, LPL, Vitality Blast, TNPL, and many more)
- **Box Score**: Live/final stats for ESPN-covered games
- **Fantasy Optimizer**: 
  - Basketball: DraftKings showdown (8 players, C×2.0, VC×1.5)
  - Cricket: 11-player lineup (C×2.0, VC×1.5, 100-credit budget)
- **Pre-Game Intel**: Projected minutes, injury, B2B, blowout risk (basketball)
- **Cricket scoring profiles**: T20, ODI, Test, The Hundred, T10 — auto-detected from match format

---

## Key invariants

- **Never import from a provider directly** — always go through `src/api.js`.
- **Cricket game IDs** are `{slug}:{eventId}`. Parse with `gameId.indexOf(":")` to extract slug.
- **Cricket scoring** uses `calculateCricketFantasyPoints(stats, profile)` — never the basketball `calculateFantasyPoints`.
- **Basketball scoring** uses `calculateFantasyPoints(stats)` from `src/lib/stats.ts`.
- **The Hundred** must never apply SR or Economy bonuses — detected by format string OR competition name containing "hundred".
- **Mobile-first** — every new UI component must work at 390px before 1200px.
- **TypeScript** — run `pnpm --filter @workspace/hoopiq typecheck` after edits.

---

## Git

The GitHub remote is `origin` → `https://github.com/giffyshani-jpg/Static-Site-Builder`.

Push status: If push fails with auth error, use Replit's Git pane or configure a PAT:
```
git remote set-url origin https://<PAT>@github.com/giffyshani-jpg/Static-Site-Builder.git
git push origin main
```

---

## Where to start next

### Near-term cricket improvements
1. **ESPN cricket slug validation** — some slugs return 404; pre-validate and cache known-good slugs to avoid unnecessary requests on every home page load.
2. **Cricket player game log** — ESPN cricket gamelog endpoint for individual player history.
3. **Pre-game intel for cricket** — batting form, bowling form, pitch conditions, head-to-head.
4. **CricketGameCard on League Games page** — `league-games.tsx` currently shows basketball-style game cards for cricket slugs. Create a cricket-specific variant.

### Basketball
1. **Home/away split indicators** — player rows in pre-game panel.
2. **Opponent defensive rating** — heuristic matchup rating.
3. **Export lineup to clipboard** — DraftKings CSV format.

### Platform
1. **Retire NBL/NZ NBL/FIBA/Summer** gradually — these are off-season. Consider hiding them behind a toggle or only showing when active.
2. **Mobile UI polish** — animations, better loading states, haptic feedback.
