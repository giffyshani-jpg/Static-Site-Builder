import React from "react";
import { Link } from "wouter";
import { MAX_COMPARE_PLAYERS } from "../lib/comparison";

interface CompareBarProps {
  league: string;
  gameId: string;
  count: number;
}

/**
 * Floating action bar shown on any page that lets the user add players
 * to a comparison (box score, fantasy optimizer). Appears once at least
 * one player is selected and links to the comparison page for the
 * current game.
 */
export function CompareBar({ league, gameId, count }: CompareBarProps) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-background via-background/95 to-transparent">
      <Link href={`/${league}/game/${gameId}/compare`}>
        <div className="rounded-xl bg-primary text-primary-foreground border border-primary-border shadow-lg py-3 px-4 flex items-center justify-center gap-2 text-sm font-semibold cursor-pointer active:scale-[0.98] transition-transform">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10" />
            <path d="M12 20V4" />
            <path d="M6 20v-6" />
          </svg>
          Compare Players ({count}/{MAX_COMPARE_PLAYERS})
        </div>
      </Link>
    </div>
  );
}
