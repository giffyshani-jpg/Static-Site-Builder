# HoopIQ — Changelog

All notable changes are appended here. Newest entries at the top.

---

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
