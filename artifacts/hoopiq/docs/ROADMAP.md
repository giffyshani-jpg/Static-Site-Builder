# HoopIQ Roadmap

Tracks planned improvements, in-progress work, and longer-horizon ideas.

---

## Status Legend
- ✅ Done
- 🔄 In progress / partial
- 📋 Planned
- 💡 Idea / exploratory

---

## Completed

### UI & Intelligence Polish — July 20, 2026
- ✅ Box score: removed ★ favorite star column (saves horizontal space, scroll is clean); sticky player col at `left-0`
- ✅ Fantasy Optimizer: re-injected AI Fantasy Coach above budget section; live indicator unified to primary orange
- ✅ AI Coach explanations: all 12 picks now carry specific numbers, data source, and actionable framing
- ✅ PickCard: wider cards (w-52/w-56), accent-matched label colours per pick kind, `line-clamp-4` explanation
- ✅ Box score "Favorites only" toggle: improved label + hints for empty state
- ✅ Merge resolution: brought remote (reliability+features) and local (AI coach+premium UI) back into sync

### Reliability & Intelligence Pass — July 2026
- ✅ Game detail cache (30s live · 2min scheduled · 5min final TTL) — eliminates remount refetches
- ✅ Poll-loop noCache opt-out — live/pregame polls always hit network; cache stays warm for remounts
- ✅ Opponent matchup context in pre-game panel (vs / @ abbreviation on each player row)
- ✅ Collapsible filter panel in Optimizer — sort always visible, secondary filters behind Filters toggle with active-count badge
- ✅ Lineup slot visualization — 8 named roster rows (C → VC → FLEX → empty) with role hints
- ✅ Live update error handling — `isStale` / Reconnecting… amber indicator after 2 consecutive poll misses
- ✅ Pregame panel skeleton loading state
- ✅ Broken import fixes (Link in box-score, useRef in optimizer)

### Polish Pass (Tasks 1–5) — July 2026
- ✅ Task 1: Fantasy Intelligence panel redesign (readability, confidence indicator, blowout risk)
- ✅ Task 2: Player detail sheet (color-coded bars, average line, better labels, game-log link placement)
- ✅ Task 3: Optimizer polish (credit bar, unified checklist, larger C/VC buttons)
- ✅ Task 4: League overview cache (2-min TTL + in-flight deduplication)
- ✅ Task 5: Bug fixes (scheduled game zeros, OUT player projections, form heading)

### Earlier (pre-polish)
- ✅ Auto-Pick Best greedy algorithm
- ✅ Suggest Credits proportional allocation
- ✅ Progress bar on lineup fill
- ✅ Saved lineups with live stats
- ✅ OCR lineup import from screenshots
- ✅ Compare bar for side-by-side player comparison
- ✅ Player detail full-page game log (ESPN, Recharts)
- ✅ Pre-Game Intelligence panel (scheduled games)
- ✅ Game-log sessionStorage cache (45-min TTL)
- ✅ Back-to-back detection
- ✅ Blowout risk heuristic
- ✅ Skeleton loading states (play-by-play, player-detail, pregame panel)

---

## Near-Term

### Intelligence
- 📋 **Home/away split indicators** on player rows in the pre-game panel — players often perform differently at home vs. away; show a trend or badge if the split is significant
- 📋 **Opponent defensive rating context** in pre-game intel — DraftKings-style matchup rating (requires a heuristic since no paid source is used)
- 📋 **Injury report timestamp** — show when ESPN last updated the injury report, not just when the app refreshed

### UX
- 📋 **Player compare sheet** — tap "Compare" to get a side-by-side stats card without navigating away
- 📋 **Haptic feedback** on player add/remove (mobile devices that support it)
- 📋 **Export lineup to clipboard** — copy in DraftKings CSV format for easy pasting

### Performance
- 📋 **Background refresh** — stale-while-revalidate pattern for the league overview so the page loads instantly from cache then updates silently

---

## Medium-Term Ideas

- 💡 **Roster differentiation score** — given N saved lineups, suggest lightly-owned players to maximize lineup diversity
- 💡 **DFS contest type presets** — one-and-done showdown vs. GPP vs. cash game changes the right credit allocation strategy
- 💡 **Notification for confirmed starters** — push/badge when a previously Questionable player is confirmed ~1hr before tip-off
- 💡 **Multi-game slate support** — optimizer currently locks to one game; slate view (multiple games) for DraftKings-style contests

---

## Won't Do (for now)
- Live odds integration (requires a paid data source)
- Season-long fantasy (this tool is DFS / showdown focused)
- Social / sharing features
- New leagues beyond current six (NBL, NZ NBL, FIBA, NBA, WNBA, NBA Summer)
