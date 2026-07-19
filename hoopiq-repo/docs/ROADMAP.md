# HoopIQ — Roadmap

## ✅ Completed Features

### Home Page
- [x] NBA + WNBA premium full-width gradient cards
- [x] "Other Basketball" collapsible group card (NBL, NZ NBL, FIBA, Summer League)
- [x] NBA Summer League auto-hides when no live/upcoming games
- [x] League status chips (live count, upcoming count, last played date)
- [x] Inline game expand (show live/upcoming games without navigating)
- [x] Show last-played game on home card
- [x] LiveNowBanner (appears when any game is in progress)
- [x] Skeleton shimmer loading
- [x] Today's Games header with current date

### League Pages
- [x] Date navigator (yesterday / today / tomorrow)
- [x] Game cards with live scores, team abbreviations, status
- [x] Router-aware back navigation
- [x] Improved shimmer skeleton

### Box Score / Game Pages
- [x] Full box score with player stats (PTS, REB, AST, STL, BLK, TO, MIN)
- [x] Live polling every 5s for in-progress games
- [x] Play-by-play view
- [x] Player comparison (up to 2 players side-by-side)
- [x] Player detail sheet (game log chart, recent form)
- [x] Pre-Game Intelligence panel for scheduled games (starter status, projected minutes, injury report, back-to-back, blowout risk, recommendation badge)
- [x] Premium scoreboard header (large scores, winner/leader highlighted)

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
- [x] Auto-Pick Best lineup button
- [x] Clear Lineup button
- [x] Lineup progress bar
- [x] AI Fantasy Coach section (12 named picks with explanations)

### AI Fantasy Coach (new)
- [x] Best Captain 🔥 — highest avg FPTS in pool
- [x] Best Vice Captain ⚡ — second-best for 1.5× slot
- [x] Best Value Pick 💎 — best FPTS-per-credit ratio
- [x] Sleeper Pick 😴 — low credits, trending up/hot form
- [x] Fade Pick ⚠️ — high credits, declining form/minutes
- [x] Trending Up 📈 — rising minutes + hot form
- [x] Trending Down 📉 — falling minutes + cold form
- [x] Safest Pick 🛡️ — consistent + confirmed starter + not B2B
- [x] Highest Ceiling 🚀 — peak single-game FPTS in history
- [x] Home Advantage 🏠 — best home-team player
- [x] Back-to-Back Fatigue ✈️ — flags teams playing consecutive nights
- [x] Injury Impact 🚑 — high-production players with injury designation

### Data Providers
- [x] ESPN NBA, WNBA, NBL, FIBA providers with retry + timeout
- [x] ESPN NBA Summer League (type-3 filter + CDN fallback)
- [x] TheSportsDB NZ NBL provider
- [x] Timezone-safe league overview (ESPN default + UTC yesterday/tomorrow)
- [x] Forward/backward scan for off-season leagues
- [x] Graceful safeCall fallback on all providers
- [x] NBA CDN fallback (todaysScoreboard_00.json)

## 📋 Pending Tasks

### Task 2: Player Intelligence
- [ ] Last 5 games breakdown card
- [ ] Last 10 games breakdown card
- [ ] Home vs Away averages
- [ ] Win vs Loss averages
- [ ] Starter vs Bench averages
- [ ] Minutes trend chart
- [ ] Fantasy trend chart
- [ ] Boom % (games above 1.5× avg FPTS)
- [ ] Bust % (games below 0.5× avg FPTS)
- [ ] Consistency score (already computed in game-log-metrics.ts)
- [ ] Value score (FPTS per credit)
- [ ] Opponent history

### Task 3: Provider Health Monitor
- [ ] Track response time + success rate per provider
- [ ] Last successful update timestamp per provider
- [ ] Current status display (healthy / degraded / down)
- [ ] Auto-prioritize healthiest provider
- [ ] Silent failure logging

### Task 4: Optimizer Improvements
- [ ] Lock Player feature
- [ ] Exclude Player feature
- [ ] Core Players feature
- [ ] Better mobile layout

### Task 5: General Improvements
- [ ] Bug fixes discovered during development
- [ ] Loading state improvements
- [ ] Error handling improvements
- [ ] Accessibility (ARIA labels)
- [ ] Performance improvements

## 🚫 Won't Do
- EuroLeague / EuroCup (blocked: no public API)
- Multi-game lineup optimizer (DFS-style) — out of scope
- Lineup sharing (URL-based) — no backend
