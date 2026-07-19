import React from "react";
import { useLocation } from "wouter";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  /** Override the back destination. When omitted the parent route is derived
   *  automatically from the current URL path. */
  backHref?: string;
}

/**
 * Derive the logical parent route from the current pathname so the back
 * button always lands on a meaningful HoopIQ page, even on a direct/shared
 * URL where the browser history stack is empty.
 *
 * Route hierarchy:
 *   /:league/game/:id/optimizer|plays|compare  →  /:league/game/:id
 *   /:league/game/:id                          →  /:league
 *   /:league/player/:playerId                  →  /:league
 *   /:league                                   →  /
 *   /                                          →  / (no-op; showBack should be false here)
 */
function deriveBackHref(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);

  // /:league/game/:id/optimizer|plays|compare  (4 segments)
  if (segs.length === 4 && segs[1] === "game") {
    return `/${segs[0]}/game/${segs[2]}`;
  }
  // /:league/game/:id  (3 segments, second is "game")
  if (segs.length === 3 && segs[1] === "game") {
    return `/${segs[0]}`;
  }
  // /:league/player/:playerId  (3 segments, second is "player")
  if (segs.length === 3 && segs[1] === "player") {
    return `/${segs[0]}`;
  }
  // /:league  (1 segment)
  if (segs.length === 1) {
    return "/";
  }
  return "/";
}

export function MobileLayout({ children, title, showBack = false, backHref }: MobileLayoutProps) {
  const [pathname, setLocation] = useLocation();

  function handleBack() {
    const dest = backHref ?? deriveBackHref(pathname);
    setLocation(dest);
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex justify-center">
      <div className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl bg-card sm:my-6 sm:rounded-2xl sm:border sm:border-border shadow-2xl min-h-[100dvh] sm:min-h-0 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="flex items-center h-14 sm:h-16 px-4 sm:px-6 border-b border-border bg-background sticky top-0 z-10 shrink-0 sm:rounded-t-2xl">
          {showBack && (
            <button
              onClick={handleBack}
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
