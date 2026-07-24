# HoopIQ Changelog

All notable changes to HoopIQ are documented here in reverse-chronological order.

---

## [Unreleased] — Multi-Sport Platform + Cricket Architecture (July 24, 2026)

### Feat — Cricket auto-discovery provider (`src/providers/cricket.js`)
- `COMPETITION_REGISTRY` contains 30+ ESPN cricket competition slugs spanning T20, ODI, Test, and The Hundred.
- `getLeagueOverview()` queries ALL slugs in parallel, merges results, deduplicates by game ID.
- Graceful: each slug failure is swallowed independently so one 404 never breaks the home page.
- `fetchGameById(gameId)` fetches detailed batting/bowling scorecard for any match.
- `fetchGameRoster(gameId)` returns the playing XI for the optimizer.
- Cache: 2-min scoreboard TTL; 30s/2min/5min summary TTL by match status.
- **Adding a new T20 league = one line in `COMPETITION_REGISTRY`. No other changes needed.**

### Feat — Cricket fantasy scoring rule engine (`src/lib/cricket-scoring.ts`)
- `ScoringProfile` type encodes all rules as data, not code.
- Five built-in profiles: **T20**, **ODI**, **Test**, **The Hundred**, **T10**.
- T20 defaults per spec: run +1, four +4, six +6, 25/50/75/100 milestones, duck −2, wicket +30, LBW/Bowled +8, 3/4/5 wicket hauls, catch +8, 3-catch bonus +4, stumping +12, run-out direct +12, indirect +6.
- Strike Rate tiers (min 10 balls): >170 → +6, 150.01–170 → +4, 130–150 → +2, 70.01–129.99 → 0, 60–70 → −2, 50–59.99 → −4, <50 → −6.
- Economy tiers (min 2 overs): <5 → +6, 5–5.99 → +4, 6–7 → +2, 7.01–9.99 → 0, 10–11 → −2, 11.01–12 → −4, >12 → −6.
- **The Hundred**: SR and Economy bonuses disabled (per format rules).
- **Test**: no SR/Economy; lower wicket value (16pts); higher duck penalty (−4).
- `getScoringProfile(format, competitionName)` auto-detects profile from match format string or competition name (e.g., "hundred" in name → The Hundred profile).
- `calculateCricketFantasyPoints(stats, profile)` returns full breakdown (batting, bowling, fielding, SR bonus, economy bonus, total).
- Captain (×2.0) / Vice Captain (×1.5) handled by `calculateLineupPoints`.

### Feat — Multi-provider fantasy metadata (`src/lib/fantasy-providers.ts`)
- Attempts to fetch player credits/roles from **FantasyWala**, **Calc11**, **DafaFantasy** in parallel.
- Each provider failure is silently swallowed; optimizer works normally without any provider data.
- `fetchFantasyMetadata(team1, team2)` returns merged `MergedFantasyMeta` with priority order: FantasyWala → Calc11 → DafaFantasy.
- `lookupPlayerMeta(name, meta)` fuzzy-matches player names to handle minor spelling differences.

### Feat — Cricket box score page (`src/pages/cricket-box-score.tsx`)
- Route: `/cricket/:competition/game/:id`
- Renders match header with teams, scores, overs, competition, format.
- Batting scorecard: runs, balls, 4s, 6s, dismissal, live FPTS per batter.
- Bowling scorecard: overs, maidens, runs conceded, wickets, live FPTS per bowler.
- Live polling every 30s for in-progress matches.
- "Fantasy Optimizer →" CTA in match header.
- Graceful "No scorecard available" state for pre-game or data-unavailable matches.

### Feat — Cricket fantasy optimizer (`src/pages/cricket-optimizer.tsx`)
- Route: `/cricket/:competition/game/:id/optimizer`
- 11-player lineup: Captain (×2.0), Vice Captain (×1.5), 9 players.
- 100-credit budget with live credit bar (amber >90%, red over budget).
- Auto-picks profile from match format on load (T20 → T20 profile, etc.).
- Profile switcher: T20 / ODI / Test / The Hundred / T10 — with inline rules summary.
- Auto-Pick: greedy algorithm by FPTS (or credits as proxy pre-match).
- Clear button, per-player +/− toggle, C/VC assignment buttons.
- Fantasy provider enrichment: credits fetched from FantasyWala/Calc11/DafaFantasy and merged in.
- Player pool with name search and role filter (BAT/BOWL/ALL/WK).
- Status chips: players selected, captain set, VC set, within budget.

### Feat — Cricket section on home page (`src/pages/home.tsx`)
- New `CricketSection` card between WNBA and Other Basketball.
- Shows live count, active competitions count, summary text while loading.
- Renders `CricketGameCard` for each active/live/upcoming match.
- "No active competitions" state with helpful message when nothing is discovered.
- Collapsible (default expanded).

### Feat — Updated routing (`src/App.tsx`)
- Added cricket routes BEFORE generic `/:league` routes to prevent mis-matching:
  - `/cricket/:competition/game/:id/optimizer` → `CricketOptimizer`
  - `/cricket/:competition/game/:id` → `CricketBoxScore`
  - `/cricket/:competition` → `LeagueGames` (existing, now handles cricket slugs)

### Feat — API layer updates (`src/api.js`)
- Cricket adapter: wraps cricket provider in standard `{getLeagueOverview, getGame, getPlayerGameLog, getTeamSchedule}` interface.
- `fetchCricketOverview()` — cached cricket overview (2-min TTL).
- `fetchCricketGame(gameId, options)` — cricket match detail.
- `fetchCricketRoster(gameId)` — playing XI for optimizer.
- `LEAGUE_CONFIGS.cricket` added (green theme, "T20, ODI, Test & more" description).

### Types
- `"cricket"` added to `LeagueKey` union in `src/lib/types.ts`.
- New `src/lib/cricket-types.ts` with `CricketGame`, `CricketPlayer`, `CricketInnings`, `CricketPlayerStats`, `CricketLeagueOverview`, `PlayerFantasyMeta`, etc.

---

## [Unreleased] — UI & Intelligence Polish (July 20, 2026)

### Task 1 — Box Score Polish
- Removed ★ Favorite Star column from box-score table. Sticky player col at `left-0`.
- "Favorites only" toggle improved label + empty state hint.

### Task 2 — UI Polish (Fantasy Optimizer)
- Re-injected `AiFantasyCoach` above budget section.
- Live indicator unified to primary orange.

### Task 4 — Fantasy Intelligence Polish
- AI Coach explanations: all 12 picks carry specific numbers + data source.
- PickCard: wider cards, accent-matched label colours, `line-clamp-4` explanation.

### Merge resolution
- Resolved 20 add/add conflicts from diverged local and remote branches.

---

## Earlier sessions — see git log for full history
