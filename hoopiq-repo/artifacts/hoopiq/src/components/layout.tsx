// MobileLayout — app shell for all HoopIQ pages.
//
// Renders a sticky header with back navigation + title/logo, then a
// scrollable content area. On desktop (sm+) the shell is centered with a
// max-width and subtle outer shadow, making it feel like a mobile app even on a
// large screen.
//
// Route hierarchy used by the back button:
//   /:league/game/:id/optimizer|plays|compare  →  /:league/game/:id
//   /:league/game/:id                          →  /:league
//   /:league/player/:playerId                  →  /:league
//   /:league                                   →  /

import React from "react";
import { Link, useLocation } from "wouter";

interface MobileLayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  backHref?: string;
  headerRight?: React.ReactNode;
}

function deriveBackHref(pathname: string): string {
  const segs = pathname.split("/").filter(Boolean);
  if (segs.length === 4 && segs[1] === "game") return `/${segs[0]}/game/${segs[2]}`;
  if (segs.length === 3 && segs[1] === "game") return `/${segs[0]}`;
  if (segs.length === 3 && segs[1] === "player") return `/${segs[0]}`;
  if (segs.length === 1) return "/";
  return "/";
}

// Basketball icon used in the logo
function BasketballIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary-foreground"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93C6.87 6.87 8 9.35 8 12c0 2.65-1.13 5.13-3.07 7.07" />
      <path d="M19.07 4.93C17.13 6.87 16 9.35 16 12c0 2.65 1.13 5.13 3.07 7.07" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function BackArrow() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function MobileLayout({
  children,
  title,
  showBack = false,
  backHref,
  headerRight,
}: MobileLayoutProps) {
  const [pathname, setLocation] = useLocation();

  function handleBack() {
    const dest = backHref ?? deriveBackHref(pathname);
    setLocation(dest);
  }

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex justify-center">
      {/* Outer glow for desktop */}
      <div className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl xl:max-w-5xl bg-card sm:my-6 sm:rounded-2xl sm:border sm:border-border sm:shadow-2xl min-h-[100dvh] sm:min-h-0 flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="flex items-center h-14 sm:h-16 px-4 sm:px-5 border-b border-border/70 bg-background/95 backdrop-blur-sm sticky top-0 z-20 shrink-0 sm:rounded-t-2xl">
          {showBack ? (
            <button
              onClick={handleBack}
              className="mr-2.5 p-1.5 -ml-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50"
              aria-label="Go back"
            >
              <BackArrow />
            </button>
          ) : null}

          <div className="flex-1 min-w-0">
            {title ? (
              <h1 className="font-bold text-base sm:text-lg tracking-tight truncate">{title}</h1>
            ) : (
              <Link href="/">
                <div className="flex items-center gap-2.5 cursor-pointer group">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-sm shadow-primary/30 shrink-0">
                    <BasketballIcon size={16} />
                  </div>
                  <span className="font-black text-lg tracking-tighter text-foreground group-hover:text-primary/90 transition-colors">
                    HoopIQ
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mt-0.5 hidden sm:block">
                    Fantasy Intelligence
                  </span>
                </div>
              </Link>
            )}
          </div>

          {/* Right slot */}
          {headerRight && (
            <div className="shrink-0 ml-3">{headerRight}</div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden sm:max-h-[calc(100dvh-7rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
