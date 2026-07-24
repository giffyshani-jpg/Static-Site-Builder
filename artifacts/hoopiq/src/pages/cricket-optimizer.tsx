// Cricket Fantasy Optimizer.
//
// Route: /cricket/:competition/game/:id/optimizer
//
// Builds an 11-player cricket DFS lineup with:
//   - Captain (×2.0 multiplier)
//   - Vice Captain (×1.5 multiplier)
//   - 9 remaining players
//   - 100-credit budget (standard cricket DFS)
//   - Per-format scoring profiles (T20 / ODI / Test / The Hundred)
//   - Fantasy provider credit enrichment (FantasyWala, Calc11, DafaFantasy)

import React, { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchCricketGame, fetchCricketRoster } from "../api";
import { fetchFantasyMetadata, lookupPlayerMeta } from "../lib/fantasy-providers";
import {
  calculateCricketFantasyPoints,
  getScoringProfile,
  SCORING_PROFILES,
  type ScoringProfile,
} from "../lib/cricket-scoring";
import type { CricketPlayer, CricketGame, CricketRole } from "../lib/cricket-types";

// ─── Constants ────────────────────────────────────────────────────────────

const TOTAL_BUDGET = 100;
const LINEUP_SIZE = 11;
const DEFAULT_CREDITS = 8.5;
const CAPTAIN_MULT = 2.0;
const VICE_CAPTAIN_MULT = 1.5;

// ─── Icons ────────────────────────────────────────────────────────────────

function ArrowLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
    </svg>
  );
}

function ZapIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ShieldIcon({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

// ─── Role badge ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<CricketRole, string> = {
  bat: "BAT",
  bowl: "BOWL",
  all: "ALL",
  wk: "WK",
};
const ROLE_COLORS: Record<CricketRole, string> = {
  bat: "bg-blue-900/60 text-blue-300 border-blue-700/40",
  bowl: "bg-purple-900/60 text-purple-300 border-purple-700/40",
  all: "bg-amber-900/60 text-amber-300 border-amber-700/40",
  wk: "bg-green-900/60 text-green-300 border-green-700/40",
};

function RoleBadge({ role }: { role: CricketRole }) {
  return (
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${ROLE_COLORS[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
}

// ─── Credit bar ───────────────────────────────────────────────────────────

function CreditBar({ used, total }: { used: number; total: number }) {
  const pct = Math.min((used / total) * 100, 100);
  const remaining = total - used;
  const isOver = used > total;
  const isWarning = !isOver && pct > 90;

  return (
    <div className="rounded-2xl border border-border/40 p-4 bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Credits</span>
        <span className={`text-sm font-black ${isOver ? "text-destructive" : isWarning ? "text-amber-400" : "text-foreground"}`}>
          {used.toFixed(1)} / {total}
          {isOver && <span className="text-[10px] ml-1 font-semibold">OVER</span>}
        </span>
      </div>
      <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isOver ? "bg-destructive" : isWarning ? "bg-amber-400" : "bg-green-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-muted-foreground/60">{LINEUP_SIZE - 0} players max</span>
        <span className={`text-[10px] font-semibold ${isOver ? "text-destructive" : "text-muted-foreground/60"}`}>
          {isOver ? `${Math.abs(remaining).toFixed(1)} over budget` : `${remaining.toFixed(1)} remaining`}
        </span>
      </div>
    </div>
  );
}

// ─── Lineup slot card ─────────────────────────────────────────────────────

function LineupSlot({
  index,
  player,
  role: slotRole,
  profile,
  onRemove,
}: {
  index: number;
  player: CricketPlayer | null;
  role: "captain" | "vice-captain" | "player";
  profile: ScoringProfile;
  onRemove: (id: string) => void;
}) {
  const label = slotRole === "captain" ? "C" : slotRole === "vice-captain" ? "VC" : `${index + 1}`;
  const mult = slotRole === "captain" ? CAPTAIN_MULT : slotRole === "vice-captain" ? VICE_CAPTAIN_MULT : 1;
  const accentClass = slotRole === "captain" ? "border-yellow-600/50 bg-yellow-900/20" : slotRole === "vice-captain" ? "border-blue-600/50 bg-blue-900/20" : "border-border/30";

  const pts = player
    ? calculateCricketFantasyPoints(player.stats, profile).total * mult
    : null;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${accentClass} ${!player ? "opacity-50" : ""}`}>
      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${slotRole === "captain" ? "bg-yellow-600 text-yellow-100" : slotRole === "vice-captain" ? "bg-blue-600 text-blue-100" : "bg-muted/60 text-muted-foreground"}`}>
        {label}
      </div>

      {player ? (
        <>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{player.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <RoleBadge role={player.role} />
              <span className="text-[10px] text-muted-foreground">{player.credits ?? DEFAULT_CREDITS} cr</span>
              {pts !== null && (
                <span className="text-[10px] font-bold text-green-400">{pts.toFixed(1)} pts</span>
              )}
            </div>
          </div>
          <button
            onClick={() => onRemove(player.id)}
            className="text-muted-foreground/40 hover:text-destructive transition-colors text-sm px-1"
          >
            ×
          </button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground/40 italic">
          {slotRole === "captain" ? "Tap C on a player" : slotRole === "vice-captain" ? "Tap VC on a player" : "Empty"}
        </span>
      )}
    </div>
  );
}

// ─── Player row ───────────────────────────────────────────────────────────

function PlayerRow({
  player,
  isSelected,
  isCaptain,
  isViceCaptain,
  profile,
  onToggle,
  onSetCaptain,
  onSetViceCaptain,
}: {
  player: CricketPlayer;
  isSelected: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  profile: ScoringProfile;
  onToggle: (id: string) => void;
  onSetCaptain: (id: string) => void;
  onSetViceCaptain: (id: string) => void;
}) {
  const pts = useMemo(
    () => calculateCricketFantasyPoints(player.stats, profile).total,
    [player.stats, profile]
  );
  const hasStats = pts !== 0;

  return (
    <div className={`flex items-center gap-2.5 px-4 py-3 transition-colors ${isSelected ? "bg-green-900/20" : "hover:bg-muted/20"} border-b border-border/15 last:border-0`}>
      {/* Role badge */}
      <div className="flex-shrink-0">
        <RoleBadge role={player.role} />
      </div>

      {/* Name + credits */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{player.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{player.credits ?? DEFAULT_CREDITS} cr</span>
          {hasStats && (
            <span className={`text-[10px] font-bold ${pts > 0 ? "text-green-400" : "text-red-400"}`}>
              {pts > 0 ? "+" : ""}{pts.toFixed(1)} pts
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50 truncate">{player.teamAbbreviation}</span>
        </div>
      </div>

      {/* Captain / VC / Add buttons */}
      {isSelected && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onSetCaptain(player.id)}
            className={`text-[9px] font-black px-2 py-1 rounded border transition-colors ${isCaptain ? "bg-yellow-600 border-yellow-500 text-yellow-100" : "border-yellow-700/40 text-yellow-400 hover:bg-yellow-900/40"}`}
          >
            C
          </button>
          <button
            onClick={() => onSetViceCaptain(player.id)}
            className={`text-[9px] font-black px-2 py-1 rounded border transition-colors ${isViceCaptain ? "bg-blue-600 border-blue-500 text-blue-100" : "border-blue-700/40 text-blue-400 hover:bg-blue-900/40"}`}
          >
            VC
          </button>
        </div>
      )}

      <button
        onClick={() => onToggle(player.id)}
        className={`flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isSelected ? "bg-destructive/20 border-destructive/40 text-destructive hover:bg-destructive/30" : "bg-green-900/30 border-green-700/40 text-green-400 hover:bg-green-900/50"}`}
      >
        {isSelected ? "−" : "+"}
      </button>
    </div>
  );
}

// ─── Auto-pick ────────────────────────────────────────────────────────────

function autoPick(
  players: CricketPlayer[],
  profile: ScoringProfile
): { selected: Set<string>; captain: string | null; viceCaptain: string | null } {
  // Score players by FPTS if available, or by credits as proxy
  const scored = players.map((p) => {
    const pts = calculateCricketFantasyPoints(p.stats, profile).total;
    const score = pts !== 0 ? pts : (p.credits ?? DEFAULT_CREDITS) * 1.5;
    return { player: p, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Greedy pick within budget
  const selected = new Set<string>();
  let budgetLeft = TOTAL_BUDGET;

  for (const { player } of scored) {
    if (selected.size >= LINEUP_SIZE) break;
    const cost = player.credits ?? DEFAULT_CREDITS;
    if (budgetLeft - cost >= 0 || selected.size < 2) {
      selected.add(player.id);
      budgetLeft -= cost;
    }
  }

  const selectedList = scored.filter((s) => selected.has(s.player.id));
  const captain = selectedList[0]?.player.id ?? null;
  const viceCaptain = selectedList[1]?.player.id ?? null;

  return { selected, captain, viceCaptain };
}

// ─── Scoring profile selector ─────────────────────────────────────────────

function ProfileSelector({
  current,
  onChange,
}: {
  current: ScoringProfile;
  onChange: (p: ScoringProfile) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/40 p-4 bg-card">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Scoring Profile</p>
      <div className="flex flex-wrap gap-2">
        {Object.values(SCORING_PROFILES).map((profile) => (
          <button
            key={profile.name}
            onClick={() => onChange(profile)}
            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${current.name === profile.name ? "bg-green-700 border-green-600 text-white" : "border-border/40 text-muted-foreground hover:border-green-700/50 hover:text-green-400"}`}
          >
            {profile.name}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground/60">
        <div className="flex justify-between">
          <span>Captain</span><span className="font-bold text-yellow-400">×{CAPTAIN_MULT}</span>
        </div>
        <div className="flex justify-between">
          <span>Vice Captain</span><span className="font-bold text-blue-400">×{VICE_CAPTAIN_MULT}</span>
        </div>
        <div className="flex justify-between">
          <span>Wicket</span><span className="font-bold">{current.bowling.perWicket}pts</span>
        </div>
        <div className="flex justify-between">
          <span>Run</span><span className="font-bold">{current.batting.perRun}pt</span>
        </div>
        <div className="flex justify-between">
          <span>Six</span><span className="font-bold">+{current.batting.perSix}pts</span>
        </div>
        <div className="flex justify-between">
          <span>Catch</span><span className="font-bold">+{current.fielding.perCatch}pts</span>
        </div>
        {current.strikeRate.enabled && (
          <div className="flex justify-between col-span-2">
            <span>Strike Rate bonus</span><span className="font-bold text-green-400">Enabled (min {current.strikeRate.minBalls} balls)</span>
          </div>
        )}
        {current.economy.enabled && (
          <div className="flex justify-between col-span-2">
            <span>Economy bonus</span><span className="font-bold text-green-400">Enabled (min {current.economy.minOvers} overs)</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CricketOptimizer() {
  const params = useParams<{ competition: string; id: string }>();
  const competition = params.competition ?? "";
  const rawId = params.id ?? "";
  const gameId = decodeURIComponent(rawId).includes(":") ? decodeURIComponent(rawId) : `${competition}:${rawId}`;

  const [game, setGame] = useState<CricketGame | null>(null);
  const [allPlayers, setAllPlayers] = useState<CricketPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [fantasyLoading, setFantasyLoading] = useState(false);
  const [fantasySource, setFantasySource] = useState<string | null>(null);
  const [profile, setProfile] = useState<ScoringProfile>(
    () => getScoringProfile("T20")
  );

  // Lineup state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [captain, setCaptain] = useState<string | null>(null);
  const [viceCaptain, setViceCaptain] = useState<string | null>(null);

  // Search / filter
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<CricketRole | "all">("all");

  // ── Load game + roster ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [gameData, rosterData] = await Promise.all([
          fetchCricketGame(gameId),
          fetchCricketRoster(gameId),
        ]);

        if (cancelled) return;

        if (gameData) {
          const g = gameData as CricketGame;
          setGame(g);
          // Auto-select profile from match format
          setProfile(getScoringProfile(g.format, g.competitionName));
        }

        const players: CricketPlayer[] = (rosterData as { allPlayers?: CricketPlayer[] })?.allPlayers ?? [];
        if (players.length > 0) {
          setAllPlayers(players);
        }
      } catch {
        // graceful
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId]);

  // ── Enrich with fantasy provider credits ───────────────────────────────
  useEffect(() => {
    if (!game || allPlayers.length === 0) return;
    let cancelled = false;
    setFantasyLoading(true);
    fetchFantasyMetadata(game.homeTeam.name, game.awayTeam.name)
      .then((meta) => {
        if (cancelled || !meta.hasData) return;
        setAllPlayers((prev) =>
          prev.map((p) => {
            const m = lookupPlayerMeta(p.name, meta);
            if (!m) return p;
            return {
              ...p,
              credits: m.credits ?? p.credits,
              role: m.role ?? p.role,
            };
          })
        );
        setFantasySource(meta.successfulProviders.join(", "));
      })
      .finally(() => {
        if (!cancelled) setFantasyLoading(false);
      });
    return () => { cancelled = true; };
  }, [game?.id, allPlayers.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived state ──────────────────────────────────────────────────────
  const creditsUsed = useMemo(() => {
    return [...selected].reduce((sum, id) => {
      const p = allPlayers.find((x) => x.id === id);
      return sum + (p?.credits ?? DEFAULT_CREDITS);
    }, 0);
  }, [selected, allPlayers]);

  const totalPoints = useMemo(() => {
    return [...selected].reduce((sum, id) => {
      const p = allPlayers.find((x) => x.id === id);
      if (!p) return sum;
      const pts = calculateCricketFantasyPoints(p.stats, profile).total;
      const mult = id === captain ? CAPTAIN_MULT : id === viceCaptain ? VICE_CAPTAIN_MULT : 1;
      return sum + pts * mult;
    }, 0);
  }, [selected, captain, viceCaptain, allPlayers, profile]);

  const filteredPlayers = useMemo(() => {
    return allPlayers.filter((p) => {
      const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || p.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [allPlayers, search, roleFilter]);

  const lineupPlayers = useMemo(() => {
    return allPlayers.filter((p) => selected.has(p.id));
  }, [allPlayers, selected]);

  // ── Handlers ───────────────────────────────────────────────────────────
  function togglePlayer(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (captain === id) setCaptain(null);
        if (viceCaptain === id) setViceCaptain(null);
      } else {
        if (next.size >= LINEUP_SIZE) return prev; // already full
        next.add(id);
      }
      return next;
    });
  }

  function handleSetCaptain(id: string) {
    if (viceCaptain === id) setViceCaptain(null);
    setCaptain((prev) => (prev === id ? null : id));
  }

  function handleSetViceCaptain(id: string) {
    if (captain === id) setCaptain(null);
    setViceCaptain((prev) => (prev === id ? null : id));
  }

  function handleAutoPick() {
    const result = autoPick(allPlayers, profile);
    setSelected(result.selected);
    setCaptain(result.captain);
    setViceCaptain(result.viceCaptain);
  }

  function handleClear() {
    setSelected(new Set());
    setCaptain(null);
    setViceCaptain(null);
  }

  // Build lineup slots
  const slots = [
    { role: "captain" as const, player: lineupPlayers.find((p) => p.id === captain) ?? null },
    { role: "vice-captain" as const, player: lineupPlayers.find((p) => p.id === viceCaptain) ?? null },
    ...lineupPlayers
      .filter((p) => p.id !== captain && p.id !== viceCaptain)
      .map((p, i) => ({ role: "player" as const, player: p, index: i })),
  ];

  const isLineupComplete = selected.size === LINEUP_SIZE && captain && viceCaptain;
  const isOver = creditsUsed > TOTAL_BUDGET;

  return (
    <MobileLayout>
      <div className="p-4 sm:p-5 flex flex-col gap-4 pb-16">
        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <Link href={`/cricket/${competition}/game/${encodeURIComponent(rawId)}`}>
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft />
              <span>Box Score</span>
            </button>
          </Link>
          {game && (
            <span className="text-xs font-bold text-green-400/70">
              {game.competitionName} · {profile.name}
            </span>
          )}
        </div>

        {/* Header */}
        <div>
          <h1 className="text-xl font-black tracking-tight">
            🏏 Cricket Optimizer
          </h1>
          {game && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {game.homeTeam.abbreviation} vs {game.awayTeam.abbreviation}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl skeleton-shimmer" />)}
          </div>
        ) : (
          <>
            {/* Scoring Profile selector */}
            <ProfileSelector current={profile} onChange={setProfile} />

            {/* Fantasy provider note */}
            {fantasyLoading && (
              <div className="text-xs text-muted-foreground/50 text-center animate-pulse">
                Fetching credits from fantasy providers…
              </div>
            )}
            {fantasySource && !fantasyLoading && (
              <div className="text-xs text-green-400/60 text-center">
                Credits enriched by {fantasySource}
              </div>
            )}

            {/* Credits bar */}
            <CreditBar used={creditsUsed} total={TOTAL_BUDGET} />

            {/* Lineup summary */}
            <div className="rounded-2xl border border-border/40 p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Lineup ({selected.size}/{LINEUP_SIZE})
                  </p>
                  {totalPoints > 0 && (
                    <p className="text-lg font-black text-green-400 mt-0.5">
                      {totalPoints.toFixed(1)} pts
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAutoPick}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-green-900/40 border border-green-700/50 text-green-400 hover:bg-green-900/60 transition-colors"
                  >
                    <ZapIcon size={12} />
                    Auto-Pick
                  </button>
                  <button
                    onClick={handleClear}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border/40 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Status chips */}
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: `${selected.size}/${LINEUP_SIZE} players`, ok: selected.size === LINEUP_SIZE },
                  { label: "Captain set", ok: !!captain },
                  { label: "VC set", ok: !!viceCaptain },
                  { label: "Within budget", ok: !isOver },
                ].map(({ label, ok }) => (
                  <span key={label} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ok ? "bg-green-900/30 border-green-700/40 text-green-300" : "bg-muted/30 border-border/30 text-muted-foreground/50"}`}>
                    {ok ? "✓" : "○"} {label}
                  </span>
                ))}
              </div>

              {/* Lineup slots */}
              <div className="flex flex-col gap-2">
                {slots.map((slot, i) => (
                  <LineupSlot
                    key={slot.player?.id ?? `empty-${i}`}
                    index={i}
                    player={slot.player}
                    role={slot.role}
                    profile={profile}
                    onRemove={togglePlayer}
                  />
                ))}
                {/* Empty remaining slots */}
                {Array.from({ length: Math.max(0, LINEUP_SIZE - lineupPlayers.length) }, (_, i) => (
                  <LineupSlot
                    key={`empty-${i}`}
                    index={lineupPlayers.length + i}
                    player={null}
                    role="player"
                    profile={profile}
                    onRemove={() => {}}
                  />
                ))}
              </div>

              {/* Complete indicator */}
              {isLineupComplete && !isOver && (
                <div className="mt-3 flex items-center gap-2 text-sm font-bold text-green-400 bg-green-900/20 rounded-xl px-3 py-2 border border-green-700/30">
                  <ShieldIcon />
                  Lineup complete · Ready to play
                </div>
              )}
            </div>

            {/* Player pool */}
            <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Players ({filteredPlayers.length})
                </p>
                {/* Role filter */}
                <div className="flex gap-1">
                  {(["all", "bat", "bowl", "all", "wk"] as const).filter((v, i, a) => a.indexOf(v) === i).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r as CricketRole | "all")}
                      className={`text-[9px] font-black px-1.5 py-0.5 rounded border transition-colors ${roleFilter === r ? "bg-green-700 border-green-600 text-white" : "border-border/30 text-muted-foreground/60 hover:text-foreground"}`}
                    >
                      {r === "all" ? "ALL" : ROLE_LABELS[r as CricketRole]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="px-4 py-2 border-b border-border/20">
                <input
                  type="text"
                  placeholder="Search players…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
                />
              </div>

              {allPlayers.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No player data available</p>
                  <p className="text-xs text-muted-foreground/50 mt-1">Match may not have started yet</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto">
                  {filteredPlayers.map((player) => (
                    <PlayerRow
                      key={player.id}
                      player={player}
                      isSelected={selected.has(player.id)}
                      isCaptain={captain === player.id}
                      isViceCaptain={viceCaptain === player.id}
                      profile={profile}
                      onToggle={togglePlayer}
                      onSetCaptain={handleSetCaptain}
                      onSetViceCaptain={handleSetViceCaptain}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
}
