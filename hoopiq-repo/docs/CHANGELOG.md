# HoopIQ — Changelog

All notable changes are appended here. Newest entries at the top.

---

## [Task 1] — AI Fantasy Coach

- New `src/lib/ai-coach.ts`: pure computation layer for 12 named fantasy picks
  - Picks: Best Captain 🔥, Best VC ⚡, Best Value 💎, Sleeper 😴, Fade ⚠️, Trending Up 📈, Trending Down 📉, Safest 🛡️, Highest Ceiling 🚀, Home Advantage 🏠, Back-to-Back Fatigue ✈️, Injury Impact 🚑
  - All picks include short data-backed explanations; individual picks hidden when data unavailable
  - Requires ≥3 scoreable active players to show any picks
- New `src/components/ai-fantasy-coach.tsx`: collapsible horizontal-scroll pick cards
  - Scheduled games: uses `usePregameIntel` (game-log metrics, trends, B2B, consistency)
  - Live/final games: uses current box-score stats
  - Per-kind color-coded left border; loading skeleton while pregame intel fetches
- Integrated into `src/pages/fantasy-optimizer.tsx` above the budget section
- Fixed live indicator in optimizer from `red-400` to theme primary (basketball orange)
- Fixed live indicator in box-score.tsx from `red-400` to theme primary + ping animation

## [Session] — UI/UX Redesign + Provider Reliability

- `src/index.css`: Full dark sports theme — deep navy bg, basketball orange primary, skeleton shimmer animation
- `src/providers/espn.js`: 2-retry exponential backoff (600ms/1200ms), 9-second timeout per attempt; 4xx not retried
- `src/providers/nba.js`: ESPN primary + NBA CDN `todaysScoreboard_00.json` fallback
- `src/providers/nbadotcom.js`: Added `getNbaOverview()`, `getNbaTodayGames()`, `getSummerLeagueOverview()`
- `src/providers/thesportsdb.js`: Timezone-safe date matching; AET/AP/PSO/Abandoned status handling; postponed/cancelled stay scheduled
- `src/providers/nznbl.js`: Always uses TheSportsDB primary (ESPN returns 400); date format fix YYYYMMDD→YYYY-MM-DD
- `src/components/game-card.tsx`: Live pulse dot, leading team highlighted in orange, winner in bold white, odds footer
- `src/components/layout.tsx`: Basketball SVG logo, "FANTASY INTELLIGENCE" tagline, frosted header
- `src/pages/home.tsx`: LiveNowBanner, PremiumCardSkeleton, PageHeader with date
- `src/pages/box-score.tsx`: Premium scoreboard header (large scores, winner/leader highlight, vs separator)
- `src/pages/league-games.tsx`: Improved shimmer skeleton with card structure
- `artifacts/hoopiq/tsconfig.json`: Added `allowJs: true`, `noImplicitAny: false` for JS provider imports
- `artifacts/hoopiq/package.json`: Added `tesseract.js` dependency for OCR

---

## [67a6aa4] — Task 3: Other Basketball (NBL/NZ NBL/FIBA) polish
- NZ NBL box score: provider-specific message explaining TheSportsDB doesn't include player stats
- FIBA league page: dedicated empty state explaining international tournament windows (Feb/Jun/Aug/Nov)
- thesportsdb.js: smarter status detection — handles AET, AP, PSO, "Abandoned", "Postponed", "Cancelled"
- thesportsdb.js: extracted `makeAbbreviation()` helper (first word, 3 chars — matches NBA city convention)
- thesportsdb.js: postponed/cancelled events stay "scheduled" to avoid polluting Last Played slot

## [17f42e1] — Task 2: NBA and WNBA reliability and polish
- Off-season banner on league pages for leagues with `active: false` (NBA, NBL)
- Live auto-refresh every 30s on the league page when games are in progress
- "Next game: [date]" subtitle in Upcoming section when next game is > 7 days away
- Fixed inaccurate "next 45 days" message → now says "next 6 months" (matches the 180-day scan)
- Off-season empty state now uses league-specific language
- Auto-refresh timestamp indicator when live games are present

## [eb8ee2b] — Task 1: Fantasy Intelligence UX
- Added Auto-Pick Best button (⚡): greedy fill of highest-FPTS active players within budget
- Added Clear Lineup button: visible only when lineup has players
- Added lineup progress bar (thin bar above summary grid, animates as slots fill)
- Remaining credits now amber when 1–19% of budget left (warning zone), red when negative
- Shortened "Avoid players already used" toggle label
- Improved player list empty state: onboarding hint when 0 players / no filters active

---

## [c028048] — Phase 1+2: Home page redesign
- NBA/WNBA full-width premium gradient cards
- Other Basketball collapsible group (NBL, NZ NBL, FIBA, Summer League)
- NBA Summer League auto-hides when season is inactive
- Inline game expand on premium cards
- Last-played game shown on home cards

## [39c4235] — Fix Summer League game.league propagation
- game.league field now correctly set to "nba-summer" for Summer League games
- Router-aware back navigation on box score pages

## [28cb1a2] — Replit configuration cleanup
- Updated Replit config and pnpm lock entries

## [fc25968] — Home page last-played + Fantasy Optimizer suggest-credits
- Home page premium cards now show last played game
- Fantasy Optimizer "Suggest Credits" button added

## [9006314] — NZ NBL game pages fixed
- NZ NBL game pages now open correctly via TheSportsDB lookup
