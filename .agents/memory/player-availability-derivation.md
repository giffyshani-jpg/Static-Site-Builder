---
name: Deriving player availability and starter/bench status from ESPN data
description: ESPN's box score athlete entries do carry explicit starter/didNotPlay booleans — prefer those over any minutes-based heuristic; heuristic is only a fallback.
---

Correction to an earlier assumption: ESPN's box score/summary endpoint athlete entries (each `athleteEntry` under a team's `statistics`/roster in the game summary) *do* expose explicit `starter` (boolean) and `didNotPlay` (boolean) fields, in addition to the injury-report status string (OUT/GTD/Questionable/Probable). Confirmed via a live call to the ESPN summary API. Both are `undefined` pregame (no box score published yet), not `false`.

**Rule:** prefer `player.didNotPlay`/`player.starter` when defined. Only fall back to the old minutes-based heuristic (zero minutes once the game has started/finished ⇒ inactive) for feed shapes/entries where these explicit flags are absent.

**Why:** the explicit flags are strictly more accurate (they cover DNP-Coach's-Decision, healthy scratches, and bench-never-checked-in cases the minutes heuristic can't distinguish from "on the bench and about to play"), and avoid guessing when the real signal is already in the payload.

**How to apply:** when adding new ESPN-sourced fields or availability/lineup-role logic, check the raw athlete entry for existing explicit flags before deriving one — don't assume a heuristic is necessary just because an older pass through this feed didn't find the flag.
