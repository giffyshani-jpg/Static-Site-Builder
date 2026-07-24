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

### Multi-Sport Cricket Platform — July 24, 2026
- ✅ Cricket auto-discovery provider — queries 30+ ESPN slugs in parallel (IPL, BBL, CPL, PSL, SA20, ILT20, The Hundred, MLC, LPL, Vitality Blast, TNPL, and more)
- ✅ `COMPETITION_REGISTRY` is the single place to add new leagues — zero other code changes
- ✅ Fantasy scoring rule engine — `ScoringProfile` type with T20, ODI, Test, The Hundred, T10 profiles
- ✅ T20 scoring: run +1, four +4, six +6, milestones (25/50/75/100), duck −2, wicket +30, LBW/Bowled +8, 3/4/5 haul bonuses, catch +8, 3-catch bonus, stumping +12, run-out direct +12, indirect +6
- ✅ Strike Rate tiers (min 10 balls) — T20 and T10 only
- ✅ Economy tiers (min 2 overs) — T20 and T10 only
- ✅ The Hundred: SR and Economy disabled (per format rules)
- ✅ Test cricket: lower wicket value (16pts), no SR/Economy, higher duck penalty (−4)
- ✅ `getScoringProfile(format, name)` auto-detects correct profile
- ✅ Multi-provider fantasy metadata — FantasyWala, Calc11, DafaFantasy tried in parallel with graceful fallback
- ✅ Cricket box score page — batting + bowling scorecards, live FPTS per player
- ✅ Cricket fantasy optimizer — 11-player, C×2/VC×1.5, 100-credit budget, auto-pick, profile switcher
- ✅ Cricket section on home page — auto-shows active competitions, collapses gracefully when none active
- ✅ Cricket routing — `/cricket/:competition/game/:id` and `/optimizer` routes
- ✅ `"cricket"` added to `LeagueKey` type

### UI & Intelligence Polish — July 20, 2026
- ✅ Box score: removed ★ star column; sticky player col at `left-0`
- ✅ Fantasy Optimizer: re-injected AI Fantasy Coach above budget section
- ✅ Live indicator unified to primary orange
- ✅ AI Coach explanations: all 12 picks carry specific numbers + data source
- ✅ PickCard: wider, accent-matched label colours, `line-clamp-4` explanation
- ✅ Merge resolution: 20 add/add conflicts resolved

### Reliability & Intelligence Pass — July 2026
- ✅ Game detail cache (30s/2min/5min TTL by status)
- ✅ Poll-loop noCache opt-out
- ✅ Opponent matchup context in pre-game panel
- ✅ Collapsible filter panel in Optimizer
- ✅ Lineup slot visualization
- ✅ Live update error handling (`isStale` / Reconnecting… indicator)
- ✅ Pregame panel skeleton loading state

### Earlier (pre-reliability pass) — July 2026
- ✅ AI Fantasy Coach (12 picks from real data)
- ✅ Auto-Pick Best, Suggest Credits, lineup progress bar
- ✅ Saved lineups with live stats, OCR import
- ✅ Compare bar, player detail game log
- ✅ Pre-Game Intel panel
- ✅ Game-log sessionStorage cache (45-min TTL)
- ✅ Back-to-back detection, blowout risk, skeleton loading states

---

## Near-Term Cricket

- 📋 **ESPN slug validation** — pre-validate which slugs are active; avoid wasted requests on every home load
- 📋 **Cricket player game log** — ESPN cricket gamelog endpoint for individual history
- 📋 **Pre-game intel for cricket** — batting/bowling form, pitch conditions, head-to-head stats
- 📋 **CricketGameCard in LeagueGames** — cricket-specific card for `/cricket/:competition` page
- 📋 **Cricket live banner** — show live cricket games in the LIVE NOW banner alongside basketball
- 📋 **Scorecard polish** — fall of wickets, partnership data, extras

## Near-Term Basketball

- 📋 **Home/away split indicators** — player rows in pre-game panel
- 📋 **Opponent defensive rating** — heuristic matchup rating without paid source
- 📋 **Export lineup to clipboard** — copy DraftKings CSV format
- 📋 **Injury report timestamp** — show when ESPN last updated injury report

## Platform

- 📋 **Retire old basketball leagues** — NBL, NZ NBL, FIBA, Summer League are mostly off-season; hide behind toggle or only show when active
- 📋 **Background refresh** — stale-while-revalidate for league overviews
- 📋 **Mobile animations** — micro-interactions, screen transitions
- 📋 **Dark theme polish** — card depth, color hierarchy improvements

## Medium-Term

- 💡 **Roster differentiation score** — suggest lightly-owned players for lineup diversity
- 💡 **Cricket captain picks** — data-driven C/VC recommendations based on form + matchup
- 💡 **DFS contest presets** — GPP vs. cash game credit allocation strategy
- 💡 **Notification for confirmed starters** — push when Questionable player is confirmed
- 💡 **Multi-game slate** — optimizer currently one-game; slate view for multi-match contests
- 💡 **Women's cricket** — WBBL, Women's T20 World Cup, Women's IPL via ESPN
