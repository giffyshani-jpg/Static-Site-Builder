# HoopIQ — Changelog

All notable changes are appended here. Newest entries at the top.

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
