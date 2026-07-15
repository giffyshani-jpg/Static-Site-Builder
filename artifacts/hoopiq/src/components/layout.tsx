import React from "react";
import { Link, useLocation } from "wouter";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export function MobileLayout({ children, title, showBack = false }: MobileLayoutProps) {
  const [_, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex justify-center">
      <div className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl bg-card sm:my-6 sm:rounded-2xl sm:border sm:border-border shadow-2xl min-h-[100dvh] sm:min-h-0 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="flex items-center h-14 sm:h-16 px-4 sm:px-6 border-b border-border bg-background sticky top-0 z-10 shrink-0 sm:rounded-t-2xl">
          {showBack && (
            <button 
              onClick={() => window.history.back()}
              className="mr-3 p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/40"
              aria-label="Go back"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
          )}
          <div className="flex-1">
            <h1 className="font-semibold text-lg sm:text-xl tracking-tight">
              {title || (
                <span className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-primary-foreground opacity-90" />
                  </div>
                  HoopIQ
                </span>
              )}
            </h1>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden sm:max-h-[calc(100dvh-6rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
