---
name: HoopIQ Pre-Game Intelligence architecture
description: How pregame lineup/injury/minutes/recommendation data is sourced and computed; ESPN endpoint capabilities and limitations.
---

## ESPN capability findings (verified July 2026 against live WNBA data)

**Pregame box score players array is always empty** (`summary.boxscore.players = []`) for scheduled games — ESPN does not publish starter flags until at/near tipoff. "Confirmed Starter" only becomes available once ESPN actually publishes the box score (which appears to happen at or just after tipoff).

**Pregame injury report IS available** (`summary.injuries`) for scheduled games, same payload as live/final — team-level blocks with OUT / GTD / Questionable / Probable statuses. This is reliable and is what we expose as `Game.injuryReport[]`.

**Team schedule endpoint works** (`/apis/site/v2/sports/basketball/{league}/teams/{teamId}/schedule`) — returns all-season events with `state: "pre"|"in"|"post"`. Used for back-to-back detection and finding previous completed game ID.

**pickcenter/odds block** (`summary.pickcenter[0]`) contains spread + `homeTeamOdds.favorite` + `overUnder` for scheduled games when a market has been posted. Not always present. Exposed as `Game.pregameOdds`.

**No ESPN depth-chart endpoint** — `/sports.core.api.espn.com/.../depthcharts` returns 404. No official "expected starter" designation exists pregame.

## Heuristic approach for "Expected Starter"

Since ESPN provides no pregame starter list, we derive it from the **most recently completed game's box score** for each team (fetched via `fetchGameById(prevGameId)` after finding the previous game ID from the team schedule). Players who had `starter === true` or played ≥8 minutes in that game form the "rotation baseline" (capped at 10 per team). This is labeled "Expected Starter" in the UI, distinct from "Confirmed Starter" (which only appears once the current game's own box score is published).

## Data flow

1. `useLiveGame` polls every 60s while `status === "scheduled"` (new pregame poll added alongside existing 5s in-progress poll).
2. `usePregameIntel` runs once per `game.id`: fetches team schedules + previous game + player gamelogs via `Promise.all`, stores as `rotationBaseline` state.
3. On each `game` update (every 60s), the `useMemo` cheaply recomputes lineup status / recommendations from already-fetched baseline + current `game.injuryReport` + `game.pregameOdds`.

## Why

Pregame box score emptiness means we can't trust `game.homeTeam.players` / `game.awayTeam.players` for scheduled games — they're always empty arrays. The previous-game heuristic + injury overlay is the best real-data approach available without a dedicated lineup service.

## Back-to-back threshold

≤30h gap between prior game date and tonight's tipoff ISO timestamp. 30h (not strict 24h) accounts for early-afternoon-to-late-evening scheduling while still catching only consecutive-night sets.

## Recommendation badge thresholds (lib/pregame-intel.ts)

- Elite Play: avgFptsLast5 ≥ 45
- Strong Play: ≥ 32
- Safe Value: ≥ 20
- Risky: ≥ 10
- Avoid: < 10 or `status === "Out"`

Adjustments: Questionable/GTD → -1 tier; minutesTrend "down" → -1; "up" (non-bench) → +1; backToBack → -1; blowoutRisk High (and player's team is favorite) → -1.
