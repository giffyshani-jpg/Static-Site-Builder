// Provider Health Panel
//
// Displays per-provider status (healthy / degraded / down / unknown),
// average response time, and last successful update. Auto-updates every 5s
// while mounted. Collapses by default.

import React, { useState, useEffect } from "react";
import {
  getAllProviderHealth,
  getProviderStatus,
  getAvgResponseMs,
  formatAgo,
  ProviderStatus,
} from "../lib/provider-health";

const STATUS_DOT: Record<ProviderStatus, string> = {
  healthy:  "bg-emerald-400",
  degraded: "bg-amber-400",
  down:     "bg-rose-400",
  unknown:  "bg-muted-foreground/40",
};
const STATUS_LABEL: Record<ProviderStatus, string> = {
  healthy:  "Healthy",
  degraded: "Degraded",
  down:     "Down",
  unknown:  "No requests yet",
};

function ProviderRow({ name }: { name: string }) {
  const status = getProviderStatus(name);
  const health = getAllProviderHealth().find((h) => h.name === name);
  const avgMs  = getAvgResponseMs(name);
  const total  = (health?.successCount ?? 0) + (health?.failureCount ?? 0);
  const successRate = total > 0
    ? `${Math.round(((health?.successCount ?? 0) / total) * 100)}%`
    : "—";

  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-muted/10 transition-colors">
      {/* Status dot */}
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[status]} ${
          status === "healthy" ? "shadow-[0_0_4px_1px] shadow-emerald-400/50" : ""
        }`}
        title={STATUS_LABEL[status]}
      />

      {/* Provider name */}
      <span className="text-xs font-semibold text-foreground capitalize flex-1 min-w-0 truncate">
        {name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
      </span>

      {/* Success rate */}
      <span className={`text-[10px] tabular-nums w-10 text-right shrink-0 ${
        status === "degraded" ? "text-amber-400" : status === "down" ? "text-rose-400" : "text-muted-foreground"
      }`}>
        {successRate}
      </span>

      {/* Avg response time */}
      <span className="text-[10px] tabular-nums text-muted-foreground/70 w-14 text-right shrink-0">
        {avgMs !== null ? `${avgMs.toFixed(0)}ms` : "—"}
      </span>

      {/* Last success */}
      <span className="text-[10px] text-muted-foreground/60 w-16 text-right shrink-0 tabular-nums">
        {formatAgo(health?.lastSuccessAt ?? null)}
      </span>
    </div>
  );
}

export function ProviderHealthPanel() {
  const [expanded, setExpanded] = useState(false);
  const [tick, setTick] = useState(0);

  // Refresh display every 5s while expanded
  useEffect(() => {
    if (!expanded) return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [expanded]);

  const providers = getAllProviderHealth();
  if (providers.length === 0 && !expanded) return null;

  // Derive overall status
  const allStatuses = providers.map((h) => getProviderStatus(h.name));
  const overallStatus: ProviderStatus =
    allStatuses.every((s) => s === "unknown") ? "unknown"
    : allStatuses.some((s) => s === "down") ? "down"
    : allStatuses.some((s) => s === "degraded") ? "degraded"
    : providers.length === 0 ? "unknown"
    : "healthy";

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-muted/10 transition-colors"
        aria-expanded={expanded}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[overallStatus]}`}
        />
        Provider Status
        {expanded && providers.length > 0 && (
          <span className="text-muted-foreground/50 normal-case tracking-normal font-normal ml-1">
            {providers.length} provider{providers.length !== 1 ? "s" : ""} tracked
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-auto text-muted-foreground/50 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="pb-2">
          {providers.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground/60">
              No requests recorded yet this session. Navigate to league pages to populate provider stats.
            </p>
          ) : (
            <>
              {/* Header row */}
              <div className="flex items-center gap-3 px-3 py-1 border-b border-border/50">
                <span className="w-2 shrink-0" />
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex-1">Provider</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-10 text-right shrink-0">OK%</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-14 text-right shrink-0">Avg RT</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 w-16 text-right shrink-0">Last OK</span>
              </div>
              {providers.map((h) => (
                <ProviderRow key={h.name + tick} name={h.name} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
