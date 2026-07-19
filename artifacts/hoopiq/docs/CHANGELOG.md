# HoopIQ Changelog

All notable changes to HoopIQ are documented here in reverse-chronological order.

---

## [Unreleased] — Reliability & Intelligence Pass (July 2026)

### Fix — broken imports
- Restored `Link` (wouter) import in `box-score.tsx` and `useRef` import in `fantasy-optimizer.tsx` — both had been removed incorrectly by a prior automated pass, causing a runtime crash on the box score page.

### Feat — game detail cache (`api.js`)
- `fetchGameById` now caches results in-memory with status-aware TTLs: 30 s for `in_progress` games, 2 min for `scheduled`, 5 min for `final`.
- Poll loops in `use-live-game.ts` pass `{ noCache: true }` so live/pregame updates always hit the network; the result is still written to cache so remounts after a poll see fresh data instead of refetching.
- Concurrent initial mounts share a single in-flight Promise via an in-flight Map (same dedup pattern as the overview cache).

### Feat — opponent matchup context in Pre-Game Intel panel
- Each player row in `pregame-intel-panel.tsx` now shows a subtle `vs <ABBR>` or `@ <ABBR>` tag after the position label so fantasy users can see the matchup without scrolling to the team header.

### Feat — collapsible filter panel in Fantasy Optimizer
- Sort row (always visible) gains a **Filters** toggle button. Team filter, position filter, Favorites Only, and Avoid Used toggles collapse behind it.
- A badge on the Filters button shows the count of active non-default filters so the list never looks silently filtered.
- Filter panel auto-opens on load when saved preferences contain non-default values.
- `aria-expanded` and `aria-label` set on the toggle for keyboard/screen-reader users.

### Feat — lineup slot visualization in Fantasy Optimizer
- A new **Roster Slots** card appears below the requirements checklist whenever any player is selected. Shows all 8 slots in order: Captain (C ×2.0), Vice Captain (VC ×1.5), then up to 6 FLEX rows.
- Empty C/VC slots show an inline hint ("Set Captain — tap C on a player") and a Required badge.
- Improves C/VC assignment discoverability on first use.

### Feat — live update error handling (`use-live-game.ts`, `box-score.tsx`)
- `useLiveGame` now tracks consecutive empty/undefined poll responses via a `stallCount` ref. After 2 consecutive misses the hook sets `isStale: true`.
- `box-score.tsx` surfaces this as an amber **Reconnecting…** pulse indicator, replacing the "Auto-updating" text. Resets automatically when the next poll succeeds.

### Feat — pregame panel skeleton loading state
- The "Loading lineups & injury reports…" plain-text loading message replaced with animated skeleton bars for the team availability cards and player rows, consistent with the box score and player detail skeletons.

### Docs
- Created `docs/PROJECT_CONTEXT.md` — single-page project orientation for any new agent.
- Created `docs/KNOWN_ISSUES.md` — tracked limitations, design decisions, and resolved bugs.

---

## [Phase 2 Polish] — July 2026 (committed earlier)

### Skeleton loading states
- `play-by-play.tsx`: "Loading game…" replaced with 4 animated skeleton bars.
- `player-detail.tsx`: "Loading game log from ESPN…" replaced with 3 skeleton bars + subtle label.
- `home.tsx`: "No data" chip text improved to "Unavailable".

---

## [Phase 1 Polish] — Tasks 1–5, July 2026 (commit 33140a3)

### Task 1 — Fantasy Intelligence panel (`pregame-intel-panel.tsx`)
- Redesigned `PlayerIntelRow`: two-section design — name/badges row + metrics row (Proj Min · FPTS L5 with 🔥/❄️ · Min Trend only when non-flat · Confidence).
- Confidence indicator: "High / Moderate / Low" derived from consistency, starter status, B2B, injury. Color-coded green / amber / rose.
- Blowout risk simplified to one-liner (only Medium/High shown).
- OUT players dimmed, no projections shown.
- B2B pill on team availability cards.
- Header simplified; methodology footnote moved to bottom.

### Task 2 — Player detail sheet (`player-detail-sheet.tsx`)
- Color-coded bar chart (green ≥ 110%, red ≤ 90%, purple within ±10%).
- Average reference line on bar chart.
- FPTS value labels on bars.
- "View Full Game Log" button moved to top.
- Scheduled game stats hidden.
- "App Avg" label (was "Season Avg*").
- Better empty form state.

### Task 3 — Optimizer polish (`fantasy-optimizer.tsx`)
- Credit usage visualization bar (amber >85%, red over budget).
- Unified requirements checklist (replaces separate error + valid banners).
- Larger C/VC role buttons (28px → 32px).

### Task 4 — Performance (`api.js`)
- League overview cache: 2-min TTL + in-memory + sessionStorage dual-layer.
- In-flight deduplication for `fetchLeagueOverview`.

### Task 5 — Bug fixes
- Scheduled game stats no longer show misleading zeros.
- OUT player projections suppressed.
- Form heading shows real game count.
