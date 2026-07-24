// Cricket Box Score page.
//
// Route: /cricket/:competition/game/:id
//
// Shows batting and bowling scorecards for each innings, live status,
// and a link to the cricket fantasy optimizer.

import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { fetchCricketGame } from "../api";
import type { CricketGame, CricketInnings, CricketPlayer } from "../lib/cricket-types";
import { calculateCricketFantasyPoints, getScoringProfile } from "../lib/cricket-scoring";

// ─── Icons ─────────────────────────────────────────────────────────────────

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

// ─── Skeleton ──────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 rounded-xl skeleton-shimmer" />
      ))}
    </div>
  );
}

// ─── Score header ─────────────────────────────────────────────────────────

function MatchHeader({ game }: { game: CricketGame }) {
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";

  return (
    <div className="bg-gradient-to-br from-green-900/80 to-slate-900 border border-green-800/30 rounded-2xl overflow-hidden shadow-lg">
      {/* Competition + format */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-green-400/80">
          {game.competitionName}
        </span>
        <span className="text-[10px] font-semibold bg-green-900/50 text-green-300 rounded-full px-2 py-0.5 border border-green-700/40">
          {game.format}
        </span>
      </div>

      {/* Teams and scores */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          {/* Home team */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-black text-white leading-tight truncate">
              {game.homeTeam.abbreviation}
            </p>
            <p className="text-xs text-slate-400 truncate">{game.homeTeam.name}</p>
            {game.homeTeam.score && (
              <p className="text-xl font-black text-green-300 mt-0.5">
                {game.homeTeam.score}
                {game.homeTeam.overs && (
                  <span className="text-xs font-normal text-slate-400 ml-1">({game.homeTeam.overs} ov)</span>
                )}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="flex flex-col items-center gap-1 px-2">
            {isLive ? (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            ) : null}
            <span className={`text-[11px] font-bold ${isLive ? "text-primary" : isFinal ? "text-slate-400" : "text-slate-500"}`}>
              {isLive ? "LIVE" : isFinal ? "FT" : "vs"}
            </span>
          </div>

          {/* Away team */}
          <div className="flex-1 min-w-0 text-right">
            <p className="text-base font-black text-white leading-tight truncate">
              {game.awayTeam.abbreviation}
            </p>
            <p className="text-xs text-slate-400 truncate">{game.awayTeam.name}</p>
            {game.awayTeam.score && (
              <p className="text-xl font-black text-green-300 mt-0.5">
                {game.awayTeam.score}
                {game.awayTeam.overs && (
                  <span className="text-xs font-normal text-slate-400 ml-1">({game.awayTeam.overs} ov)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Result / status detail */}
        {(game.result || game.statusDetail) && (
          <div className="mt-2 text-center">
            <p className="text-xs font-semibold text-green-300/80">
              {game.result ?? game.statusDetail}
            </p>
          </div>
        )}

        {/* Venue */}
        {game.venue && (
          <p className="text-[10px] text-slate-500 text-center mt-1">{game.venue}</p>
        )}
      </div>

      {/* Optimizer CTA */}
      <Link href={`/cricket/${game.competitionSlug}/game/${encodeURIComponent(game.id)}/optimizer`}>
        <div className="flex items-center justify-center gap-2 py-2.5 bg-green-800/30 hover:bg-green-800/50 transition-colors border-t border-green-800/30 cursor-pointer group">
          <ZapIcon size={13} />
          <span className="text-xs font-bold text-green-300 group-hover:text-green-200 transition-colors">
            Fantasy Optimizer
          </span>
        </div>
      </Link>
    </div>
  );
}

// ─── Batting scorecard ────────────────────────────────────────────────────

function BattingCard({ innings, profile }: { innings: CricketInnings; profile: ReturnType<typeof getScoringProfile> }) {
  const players = innings.battingTeam.players.filter((p) => p.stats?.batting);

  if (players.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {innings.battingTeam.abbreviation} Batting
        </span>
        <span className="text-xs text-muted-foreground/60">
          {innings.totalRuns}/{innings.totalWickets} ({innings.totalOvers} ov)
        </span>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-1 px-4 py-1.5 border-b border-border/20">
        <span className="text-[10px] font-semibold text-muted-foreground/60">Batter</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">R</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">B</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">4s</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">6s</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-12">FPTS</span>
      </div>

      {players.map((p, i) => {
        const bat = p.stats.batting!;
        const pts = calculateCricketFantasyPoints(p.stats, profile);
        const notOut = !bat.dismissed;
        return (
          <div key={p.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-1 px-4 py-2.5 items-start ${i < players.length - 1 ? "border-b border-border/15" : ""}`}>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">
                {p.name}
                {notOut && <span className="ml-1 text-[10px] text-green-400 font-bold">*</span>}
              </p>
              {bat.dismissal && !notOut && (
                <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{bat.dismissal}</p>
              )}
            </div>
            <span className={`text-sm font-bold text-right w-7 ${bat.runs >= 50 ? "text-yellow-400" : bat.runs >= 25 ? "text-orange-400" : "text-foreground"}`}>
              {bat.runs}
            </span>
            <span className="text-xs text-muted-foreground text-right w-7">{bat.balls}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bat.fours}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bat.sixes}</span>
            <span className={`text-xs font-bold text-right w-12 ${pts.total > 0 ? "text-green-400" : pts.total < 0 ? "text-red-400" : "text-muted-foreground/50"}`}>
              {pts.total > 0 ? "+" : ""}{pts.total.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Bowling scorecard ────────────────────────────────────────────────────

function BowlingCard({ innings, profile }: { innings: CricketInnings; profile: ReturnType<typeof getScoringProfile> }) {
  const players = innings.bowlingTeam.players.filter((p) => p.stats?.bowling);
  if (players.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/40 overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {innings.bowlingTeam.abbreviation} Bowling
        </span>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-1 px-4 py-1.5 border-b border-border/20">
        <span className="text-[10px] font-semibold text-muted-foreground/60">Bowler</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">O</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">M</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">R</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-7">W</span>
        <span className="text-[10px] font-semibold text-muted-foreground/60 text-right w-12">FPTS</span>
      </div>

      {players.map((p, i) => {
        const bowl = p.stats.bowling!;
        const oversStr = bowl.extraBalls > 0 ? `${bowl.overs}.${bowl.extraBalls}` : `${bowl.overs}`;
        const pts = calculateCricketFantasyPoints(p.stats, profile);
        return (
          <div key={p.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-1 px-4 py-2.5 items-center ${i < players.length - 1 ? "border-b border-border/15" : ""}`}>
            <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
            <span className="text-xs text-muted-foreground text-right w-7">{oversStr}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bowl.maidens}</span>
            <span className="text-xs text-muted-foreground text-right w-7">{bowl.runsConceded}</span>
            <span className={`text-sm font-bold text-right w-7 ${bowl.wickets >= 3 ? "text-yellow-400" : bowl.wickets > 0 ? "text-orange-400" : "text-foreground"}`}>
              {bowl.wickets}
            </span>
            <span className={`text-xs font-bold text-right w-12 ${pts.total > 0 ? "text-green-400" : pts.total < 0 ? "text-red-400" : "text-muted-foreground/50"}`}>
              {pts.total > 0 ? "+" : ""}{pts.total.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Innings section ──────────────────────────────────────────────────────

function InningsSection({ innings, game }: { innings: CricketInnings; game: CricketGame }) {
  const profile = getScoringProfile(game.format, game.competitionName);
  const label = innings.inningsNumber === 1 ? "1st Innings" : "2nd Innings";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{label}</span>
        {innings.status === "in_progress" && (
          <span className="text-[10px] font-bold text-primary bg-primary/10 rounded-full px-2 py-0.5">In Progress</span>
        )}
      </div>
      <BattingCard innings={innings} profile={profile} />
      <BowlingCard innings={innings} profile={profile} />
    </div>
  );
}

// ─── No scorecard fallback ────────────────────────────────────────────────

function NoScorecard({ game }: { game: CricketGame }) {
  return (
    <div className="rounded-2xl border border-border/40 border-dashed p-6 text-center">
      <p className="text-2xl mb-2">🏏</p>
      <p className="text-sm font-semibold text-muted-foreground">
        {game.status === "scheduled"
          ? "Match hasn't started yet"
          : "Detailed scorecard not available"}
      </p>
      <p className="text-xs text-muted-foreground/50 mt-1">
        {game.status === "scheduled"
          ? `Starts ${game.startTime || "soon"}`
          : "ESPN may not have provided ball-by-ball data"}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CricketBoxScore() {
  const params = useParams<{ competition: string; id: string }>();
  const competition = params.competition ?? "";
  const rawId = params.id ?? "";
  // id may be encoded as slug:eventId or just the raw game ID
  const gameId = decodeURIComponent(rawId).includes(":") ? decodeURIComponent(rawId) : `${competition}:${rawId}`;

  const [game, setGame] = useState<CricketGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(noCache = false) {
      try {
        const data = await fetchCricketGame(gameId, { noCache });
        if (!cancelled && data) {
          setGame(data as CricketGame);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) setError("Failed to load match data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [gameId]);

  // Live polling
  useEffect(() => {
    if (!game || game.status !== "in_progress") return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchCricketGame(gameId, { noCache: true })
        .then((d) => { if (d) setGame(d as CricketGame); })
        .catch(() => {});
    }, 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [game?.status, gameId]);

  return (
    <MobileLayout>
      <div className="p-4 sm:p-5 flex flex-col gap-4 pb-12">
        {/* Back navigation */}
        <div className="flex items-center gap-2">
          <Link href={`/cricket/${competition}`}>
            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium">
              <ArrowLeft />
              <span>{competition.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
            </button>
          </Link>
        </div>

        {/* Loading */}
        {loading && (
          <>
            <div className="h-40 rounded-2xl skeleton-shimmer" />
            <Skeleton />
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && game && (
          <>
            <MatchHeader game={game} />

            {game.innings.length === 0 ? (
              <NoScorecard game={game} />
            ) : (
              game.innings.map((inn) => (
                <InningsSection key={inn.inningsNumber} innings={inn} game={game} />
              ))
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
}
