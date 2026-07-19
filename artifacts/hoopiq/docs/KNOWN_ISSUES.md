# HoopIQ — Known Issues

Tracked limitations, design decisions that look like bugs, and confirmed defects. Update this file whenever a new issue is discovered or an existing one is resolved.

---

## Open

### K-001 · `computeTrend` is single-sample

**File:** `src/components/recent-form-badge.tsx`
**Severity:** Minor / cosmetic
**Description:** `computeTrend` compares only the last entry to the prior rolling average. One exceptional game can flip the indicator to "Hot" or "Cold" even if the overall trend is flat.
**Status:** Intentional simplification. Do not "fix" without user sign-off — the metric is clearly labeled as a recent trend, not a season-long trend.

---

### K-002 · App Avg is useless for new users

**File:** `src/lib/player-history.ts` + `src/components/player-detail-sheet.tsx`
**Severity:** UX / informational
**Description:** "App Avg" accumulates from box scores the user has opened in the app. A brand-new user sees "—" everywhere because nothing is tracked yet.
**Status:** By design. We show "—" rather than a misleading zero or a fabricated average. The UI explains the mechanic inline.

---

### K-003 · Optimizer has no position-limit enforcement

**File:** `src/pages/fantasy-optimizer.tsx`, `src/lib/optimizer.ts`
**Severity:** Minor (primary use case is position-agnostic)
**Description:** The lineup validator does not enforce per-position maximums (e.g. max 2 guards). DraftKings showdown format has no position limits, which is the primary use case, so this is correct. Classic-format contests would need an additional check.
**Status:** Won't fix for showdown format. Document if a classic-format mode is ever added.

---

### K-004 · NZ NBL live scores sometimes lag

**File:** `src/providers/nznbl.js` (TheSportsDB provider)
**Severity:** Minor
**Description:** TheSportsDB (ID 5066) updates live scores less frequently than ESPN. Box scores may show 2–5 min stale data during live NZ NBL games.
**Status:** Accepted limitation of the free data source. No fix without a paid real-time feed.

---

### K-005 · Injury status not always populated before tip-off

**File:** `src/lib/espn.js`
**Severity:** Minor
**Description:** Injury status in the Pre-Game Intelligence panel comes from `athlete.injuries[]` in ESPN's roster endpoint. This array is not always populated until ~1 hr before tip-off (sometimes not until warm-ups). Players may show as "Expected" when they are actually listed as Questionable.
**Status:** ESPN API limitation. No workaround. Panel header shows the last-refresh timestamp so users can judge data freshness.

---

### K-006 · OCR lineup import accuracy varies

**File:** `src/pages/fantasy-optimizer.tsx` (OCR import section)
**Severity:** Minor
**Description:** OCR import from DraftKings screenshots works well for standard fonts and clean screenshots but can misread names with special characters or clipped cards.
**Status:** Known limitation of client-side OCR. Users are prompted to review the import before confirming.

---

### K-007 · `isStale` indicator only fires for live games

**File:** `src/hooks/use-live-game.ts`, `src/pages/box-score.tsx`
**Severity:** Minor / informational
**Description:** The "Reconnecting…" amber indicator only shows when `isLive` is true (game in progress). Network failures during pregame polling (every 60s) are tracked internally but not surfaced in the UI because the pregame panel has its own refresh timestamp.
**Status:** Intentional. The pregame case is low-urgency (60s cadence); surfacing a reconnect banner would be distracting.

---

## Resolved

| ID | Description | Fixed in |
|----|-------------|----------|
| R-001 | Scheduled game stats showed misleading all-zero "This Game" grid | Polish pass Tasks 1–5 (July 2026) |
| R-002 | OUT players showed projected minutes + recommendation badge | Polish pass Tasks 1–5 (July 2026) |
| R-003 | `Link` and `useRef` removed from imports that actively use them | Import fix commit (July 2026) |
