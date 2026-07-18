# HoopIQ Changelog

All notable changes to HoopIQ are documented here in reverse-chronological order.

---

## [Unreleased] — Polish Pass (Tasks 1–5)

### Task 1 — Fantasy Intelligence panel (`pregame-intel-panel.tsx`)
- **Redesigned `PlayerIntelRow`**: replaced dense single-row chip layout with a two-section design — name/badges row + a clean metrics row (Proj Min · FPTS L5 with 🔥/❄️ · Min Trend only when non-flat · Confidence).
- **Confidence indicator**: new "High / Moderate / Low" signal derived from `consistency` rating, starter status, B2B flag, and injury designation. Color-coded green / amber / rose.
- **Simplified blowout risk banner**: from verbose multi-sentence explanation to a concise one-liner (⚡ `{risk} blowout risk · {X} pt spread · Favored team's starters may rest in Q4`). Only shown for Medium and High risk — Low was noise.
- **OUT players dimmed**: opacity-55 + no metrics row + explicit "OUT" chip instead of recommendation badge.
- **B2B shown on team availability cards**: each card now shows a "B2B" pill when the team is on back-to-back nights.
- **Header simplified**: panel label + tip-off time + refresh timestamp in one compact strip. Removed the verbose "Auto-updating · Updated HH:MM:SS" format.
- **"No injury concerns" line**: availability cards now show this only when there actually are no OUT/GTD players — removes the previous noisy "Out: None" line.
- **Methodology footnote**: condensed and placed at the bottom of the panel.

### Task 2 — Player detail sheet (`player-detail-sheet.tsx`)
- **Color-coded bar chart**: bars now reflect performance relative to average — green ≥ 110%, red ≤ 90%, purple within ±10%. Makes hot/cold stretches visible at a glance.
- **Average reference line**: thin dashed horizontal line across the bar chart at the average FPTS height.
- **FPTS value labels**: each bar now shows its FPTS value below the bar (was invisible before).
- **Trend badge moved to chart header**: `RecentFormBadge` is now right-aligned next to the chart title with a context label ("above avg / below avg / on avg").
- **"View Full Game Log" button moved up**: now appears immediately after the status badges, near the top of the sheet, instead of at the very bottom.
- **Scheduled game stats hidden**: "This Game" stat grid is now hidden when `gameStatus === "scheduled"` — was showing misleading all-zero stats.
- **Cleaner "App Avg" label**: renamed from "Season Avg*" (confusing footnote). Now shows inline `{N} tracked` sub-label and the footnote explains app-tracked vs. official.
- **Empty form state improved**: clear explanation that form builds as you view box scores, with a dashed placeholder card.
- **"Last N Fantasy Games" heading**: now says "Last {N} Viewed Games" (using actual count) and "Recent Form" when empty — removes the misleading "Last 5" when nothing is tracked.

### Task 3 — Optimizer polish (`fantasy-optimizer.tsx`)
- **Credit usage visualization bar**: visual progress bar below the budget input shows credits used vs. remaining. Color shifts amber when >85% used, red when over budget.
- **Unified requirements checklist**: replaced separate amber error banner + green valid banner with a single persistent checklist (players filled ✓/○, Captain ✓/○ with name, Vice Captain ✓/○ with name, team limit violations). Visible as soon as any player is selected.
- **Actionable C/VC hints**: when Captain or Vice Captain is not set, the checklist item reads "Set a Captain (×2.0) — tap C on any selected player" to guide the user.
- **Larger C/VC role buttons**: increased from `w-7 h-7` to `w-8 h-8` for easier mobile tapping.

### Task 4 — Performance (`api.js`)
- **League overview cache**: `fetchLeagueOverview` results cached for 2 minutes using a two-layer strategy (in-memory Map + sessionStorage JSON). Eliminates redundant full scans when navigating Back → League page.
- **In-flight deduplication**: concurrent calls with the same `(league, scan)` key share a single network request via a Promise Map — no duplicate fetches when multiple components mount simultaneously.
- **Failure passthrough**: failed fetches are never cached so the next call retries properly.

### Task 5 — Bug fixes
- `player-detail-sheet`: "This Game" stats hidden on scheduled games (was showing misleading zeros).
- `player-detail-sheet`: "Last N Fantasy Games" no longer shows "5" when zero games are tracked.
- `pregame-intel-panel`: OUT players no longer show projected minutes or a recommendation — projections are meaningless for players not playing.
- `pregame-intel-panel`: B2B pill now appears on team availability cards as well as individual player rows (was only on player rows before).
