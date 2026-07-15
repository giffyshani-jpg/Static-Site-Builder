import React from "react";
import { Link } from "wouter";
import { MobileLayout } from "../components/layout";

export default function Home() {
  return (
    <MobileLayout>
      <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-6 pt-8 sm:pt-10">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Today's Slate</h2>
          <p className="text-muted-foreground text-sm sm:text-base">Select a league to view live scores and fantasy stats.</p>
        </div>

        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 mt-4">
          <Link href="/nba">
            <div className="relative overflow-hidden group rounded-2xl bg-gradient-to-br from-blue-900 to-slate-900 border border-border p-6 cursor-pointer active:scale-[0.98] transition-all shadow-lg">
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <div className="relative z-10">
                <h3 className="text-3xl font-black tracking-tighter text-white mb-1">NBA</h3>
                <p className="text-blue-200 font-medium text-sm">Men's Professional Basketball</p>
                <div className="mt-8 flex items-center text-sm font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                  View Games
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/wnba">
            <div className="relative overflow-hidden group rounded-2xl bg-gradient-to-br from-orange-900 to-slate-900 border border-border p-6 cursor-pointer active:scale-[0.98] transition-all shadow-lg">
              <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-30 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <div className="relative z-10">
                <h3 className="text-3xl font-black tracking-tighter text-white mb-1">WNBA</h3>
                <p className="text-orange-200 font-medium text-sm">Women's Professional Basketball</p>
                <div className="mt-8 flex items-center text-sm font-semibold text-orange-400 group-hover:text-orange-300 transition-colors">
                  View Games
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </MobileLayout>
  );
}
