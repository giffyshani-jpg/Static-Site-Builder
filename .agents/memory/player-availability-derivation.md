---
name: Deriving player availability without an explicit DNP field
description: How to classify OUT/DNP/Inactive/Not-in-lineup when the data feed has no such field, and how that classification should feed into UI sort order.
---

Some sports data feeds (e.g. ESPN's box score/summary endpoints) only expose two real signals about a player's availability: an injury-report status string (OUT/GTD/Questionable/Probable) and per-player box score stats (which include minutes played, absent entirely for players who didn't dress/play). There is no explicit "DNP", "Inactive", or "Not-in-lineup" field.

**Rule:** classify a player as inactive if either (a) their injury status is explicitly "OUT", or (b) the game has actually started or finished (not merely scheduled) and their parsed minutes are zero/absent. Pregame, nobody has "not played" yet, so minutes-based inactivity does not apply before tip-off.

**Why:** this was needed to satisfy a product requirement ("OUT/DNP/Inactive/Not-in-lineup always pinned last, with a status badge") when the underlying data model had no such field to read directly — confirmed via repo-wide grep that no DNP/Inactive concept existed anywhere before this derivation was added.

**How to apply:** when a UI needs to distinguish "actually available to contribute" from "not going to score more points" for sorting or badging purposes, and the feed only gives injury-status + minutes, use this two-part rule rather than inventing a new data field or relying on injury status alone (which misses healthy scratches / DNP-Coach's Decision / bench players who never checked in).
