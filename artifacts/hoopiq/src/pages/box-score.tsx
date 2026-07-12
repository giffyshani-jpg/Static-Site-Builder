import React, { useState } from "react";
import { useParams } from "wouter";
import { MobileLayout } from "../components/layout";
import { getGameById } from "../lib/mock-data";
import { calculateFantasyPoints } from "../lib/stats";
import { Team } from "../lib/types";

export default function BoxScore() {
  const params = useParams();
  const gameId = params.id;
  const game = getGameById(gameId || "");

  const [activeTab, setActiveTab] = useState<"away" | "home">("away");

  if (!game) {
    return (
      <MobileLayout showBack title="Not Found">
        <div className="p-8 text-center text-muted-foreground">Game not found</div>
      </MobileLayout>
    );
  }

  const activeTeam = activeTab === "away" ? game.awayTeam : game.homeTeam;

  return (
    <MobileLayout showBack title={`${game.awayTeam.abbreviation} vs ${game.homeTeam.abbreviation}`}>
      
      {/* Scoreboard Header */}
      <div className="bg-card border-b border-border p-6 flex flex-col items-center">
        <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-4">
          {game.status === "scheduled" ? game.startTime : game.period}
          {game.clock && ` - ${game.clock}`}
        </div>
        
        <div className="flex justify-between items-center w-full max-w-[280px]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground border-2 border-border shadow-sm">
              {game.awayTeam.abbreviation}
            </div>
            <span className="font-bold text-2xl tabular-nums tracking-tight">
              {game.awayTeam.score ?? "-"}
            </span>
          </div>
          
          <div className="text-muted-foreground font-medium text-sm">
            AT
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center text-lg font-bold text-secondary-foreground border-2 border-border shadow-sm">
              {game.homeTeam.abbreviation}
            </div>
            <span className="font-bold text-2xl tabular-nums tracking-tight">
              {game.homeTeam.score ?? "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Team Tabs */}
      <div className="flex border-b border-border bg-background sticky top-0 z-10">
        <button
          onClick={() => setActiveTab("away")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "away" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {game.awayTeam.name}
        </button>
        <button
          onClick={() => setActiveTab("home")}
          className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === "home" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {game.homeTeam.name}
        </button>
      </div>

      {/* Stats Table */}
      <div className="w-full overflow-x-auto bg-card pb-12">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-muted-foreground bg-muted/40 uppercase sticky top-0">
            <tr>
              <th className="px-4 py-3 font-medium sticky left-0 bg-muted/95 z-10 shadow-[1px_0_0_0_var(--color-border)] min-w-[140px]">Player</th>
              <th className="px-3 py-3 font-medium text-right">FPTS</th>
              <th className="px-3 py-3 font-medium text-right">PTS</th>
              <th className="px-3 py-3 font-medium text-right">REB</th>
              <th className="px-3 py-3 font-medium text-right">AST</th>
              <th className="px-3 py-3 font-medium text-right">STL</th>
              <th className="px-3 py-3 font-medium text-right">BLK</th>
              <th className="px-3 py-3 font-medium text-right">TO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activeTeam.players.map((player) => {
              const fpts = calculateFantasyPoints(player.stats);
              return (
                <tr key={player.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 sticky left-0 bg-card z-10 shadow-[1px_0_0_0_var(--color-border)]">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground truncate max-w-[120px]">{player.name}</span>
                      <span className="text-xs text-muted-foreground">#{player.number} • {player.position}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-primary tabular-nums">
                    {fpts.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.points}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.rebounds}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.assists}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.steals}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{player.stats.blocks}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{player.stats.turnovers}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MobileLayout>
  );
}
