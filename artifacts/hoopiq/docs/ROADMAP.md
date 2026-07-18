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

---

## Near-Term

### UX
- 📋 **Lineup slot visualization**: show the 8 roster slots with assigned players instead of just a count (improves C/VC assignment discoverability)
- 📋 **Collapsible filter section**: save vertical space in the player list when filters are at defaults
- 📋 **Player compare sheet**: tap "Compare" to get a side-by-side stats card without navigating away
- 📋 **Haptic feedback** on player add/remove (mobile devices that support it)

### Intelligence
- 📋 **Home/away split indicators** on player rows (players often perform differently at home vs. away)
- 📋 **Opponent defensive rating context** in pre-game intel (DraftKings-style matchup rating)
- 📋 **Injury report timestamp**: show when ESPN last updated the injury report, not just when the app refreshed

### Performance
- 📋 **Game detail cache** (`fetchGameById`): short TTL (30s live, 5min scheduled/final) to reduce refetches on component remount
- 📋 **Background refresh**: stale-while-revalidate pattern for the league overview so the page loads instantly from cache then updates silently

---

## Medium-Term Ideas

- 💡 **Roster differentiation score**: given N saved lineups, suggest players that are lightly-owned across your own lineups to maximize lineup diversity
- 💡 **DFS contest type presets**: one-and-done showdown vs. GPP vs. cash game changes the right credit allocation strategy
- 💡 **Notification for confirmed starters**: push/badge when a previously Questionable player is confirmed ~1hr before tip-off
- 💡 **Multi-game slate support**: the optimizer currently locks to one game; slate view (multiple games) for DraftKings-style contests

---

## Won't Do (for now)
- Live odds integration (requires a paid data source)
- Season-long fantasy (this tool is DFS / showdown focused)
- Social / sharing features
