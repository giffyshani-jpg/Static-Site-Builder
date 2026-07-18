# HoopIQ — Known Issues

## Active Bugs

### NZ NBL
- **No live scores**: TheSportsDB free tier doesn't provide live scores. Status is always "scheduled" or "final". Live dot never appears for NZ NBL games.
- **No player box scores**: TheSportsDB free tier returns no player-level stats. Game pages for NZ NBL show team scores only, no roster.
- **`getGamesByDate` falls back to ESPN** which returns 400 for "nznbl" slug — any per-date query returns empty for NZ NBL.

### FIBA
- **Intermittent ESPN availability**: FIBA events only appear when ESPN has active FIBA coverage. Between tournaments, the league may show empty.
- **No play-by-play**: ESPN FIBA scoreboard doesn't always include play-by-play data.

### NBA Summer League
- **Season-specific**: Runs only in July. Provider is kept live year-round but auto-hides on home page when no games are returned.
- **getGame uses NBA summary**: Summer League game detail fetches via `espn.getGame("nba", gameId)` — works because game IDs are shared, but relies on the NBA summary endpoint which may have different data availability.

### NBA / NBL
- **Off-season gaps**: Forward scan in `getLeagueOverview` searches up to 180 days. If ESPN doesn't populate a future slate that far out, "Next game" may show incorrectly or not at all.

### Fantasy Optimizer
- **OCR accuracy**: Tesseract.js name matching is fuzzy (Levenshtein distance). Short or hyphenated names sometimes fail to match. Users can manually correct via the dropdown.
- **Credits not game-scoped**: Player credits are stored globally by player ID. If a player appears in multiple games, their credit carries over (by design, but can surprise users).
- **No auto-assign C/VC in Auto-Pick**: The Auto-Pick button fills the 8 slots but doesn't assign Captain or Vice Captain. Users must do that manually.

## Limitations

### ESPN API
- Undocumented, unofficial endpoint — shapes can change without notice.
- No API key required; CORS open. Can be rate-limited under heavy load.
- Pre-game injury report only available for ESPN-backed leagues (NBA, WNBA, NBL, FIBA, Summer).

### General
- **No push notifications**: App is a static SPA; no service worker or background sync.
- **No user accounts**: All data is localStorage. Clearing browser storage loses saved lineups.
- **Mobile-first only**: Desktop experience is functional but not optimized.
- **EuroLeague/EuroCup blocked**: No public API available. ESPN returns 400.

## Future Improvements
- Consider caching ESPN responses in sessionStorage to reduce redundant requests
- Add a "no lineup yet" empty state with step-by-step onboarding in the optimizer
- Improve OCR matching for international player names
- Investigate TheSportsDB paid tier for NZ NBL live scores
