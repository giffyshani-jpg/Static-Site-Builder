# HoopIQ — Roadmap

## ✅ Completed Features

### Home Page
- [x] NBA + WNBA premium full-width gradient cards
- [x] "Other Basketball" collapsible group card (NBL, NZ NBL, FIBA, Summer League)
- [x] NBA Summer League auto-hides when no live/upcoming games
- [x] League status chips (live count, upcoming count, last played date)
- [x] Inline game expand (show live/upcoming games without navigating)
- [x] Show last-played game on home card

### League Pages
- [x] Date navigator (yesterday / today / tomorrow)
- [x] Game cards with live scores, team abbreviations, status
- [x] Router-aware back navigation

### Box Score / Game Pages
- [x] Full box score with player stats (PTS, REB, AST, STL, BLK, TO, MIN)
- [x] Live polling every 5s for in-progress games
- [x] Play-by-play view
- [x] Player comparison (up to 2 players side-by-side)
- [x] Player detail sheet (game log chart, recent form)
- [x] Pre-Game Intelligence panel for scheduled games (starter status, projected minutes, injury report, back-to-back, blowout risk, recommendation badge)

### Fantasy Optimizer
- [x] 8-player lineup builder (max 4 from same team)
- [x] Captain (2×) and Vice Captain (1.5×) role assignment
- [x] Budget management (DraftKings/FanDuel/Custom presets)
- [x] Per-player credit inputs with auto-suggest (proportional to FPTS)
- [x] Saved lineups (name, save, load, rename, delete)
- [x] Live FPTS tracking on saved lineups
- [x] Lineup validation with inline error messages
- [x] Text export of valid lineup
- [x] OCR import from screenshot (Tesseract.js)
- [x] Sort by FPTS / PTS / REB / AST / Credits / MIN
- [x] Filter by team, position, favorites, avoid-used-players
- [x] Player status badges (OUT, GTD, Questionable, Starter, DNP)
- [x] Recent form badge on player rows

### Data Providers
- [x] ESPN NBA, WNBA, NBL, FIBA providers
- [x] ESPN NBA Summer League (type-3 filter + CDN fallback)
- [x] TheSportsDB NZ NBL provider
- [x] Timezone-safe league overview (ESPN default + UTC yesterday/tomorrow)
- [x] Forward/backward scan for off-season leagues
- [x] Graceful safeCall fallback on all providers

## 🚧 In Progress

### Task 1: Fantasy Intelligence UX
- [ ] Auto-Pick Best lineup button (fill with top FPTS players within budget)
- [ ] Clear Lineup button
- [ ] Lineup progress bar
- [ ] Improved remaining credits visual (amber warning zone)
- [ ] Compact "Avoid used" toggle label

### Task 2: NBA and WNBA reliability and polish
- [ ] TBD after Task 1 commit

### Task 3: Other Basketball (NBL/NZ NBL/FIBA) polish
- [ ] TBD after Task 2 commit

## 📋 Future / Nice-to-Have
- [ ] EuroLeague / EuroCup (blocked: no public API)
- [ ] Push notifications for live game start
- [ ] Multi-game lineup optimizer (DFS-style)
- [ ] Lineup sharing (URL-based)
- [ ] Dark/light theme toggle
- [ ] Player headshots (ESPN CDN when available)
