// Provider Health Monitor
//
// Tracks per-provider: response time, success rate, last update, last error.
// Used by UI to show provider status and by providers to self-report.
// All state lives in memory (resets on page refresh — intentional, we want
// fresh data each session). No external dependencies.

export type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";

export type ProviderHealthRecord = {
  /** Provider identifier string, e.g. "espn", "thesportsdb" */
  name: string;
  successCount: number;
  failureCount: number;
  /** Total milliseconds from all successful requests */
  totalResponseMs: number;
  /** Timestamp of last successful call */
  lastSuccessAt: number | null;
  /** Timestamp of last failure */
  lastFailureAt: number | null;
  /** Most recent error message (shortened) */
  lastError: string | null;
};

// In-memory store
const store = new Map<string, ProviderHealthRecord>();

function ensure(name: string): ProviderHealthRecord {
  if (!store.has(name)) {
    store.set(name, {
      name,
      successCount: 0,
      failureCount: 0,
      totalResponseMs: 0,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
    });
  }
  return store.get(name)!;
}

/** Call at the start of a provider request. Returns a function to call when the request completes. */
export function startProviderRequest(name: string): (success: boolean, error?: string) => void {
  const startMs = performance.now();
  return function complete(success: boolean, error?: string) {
    const elapsedMs = performance.now() - startMs;
    const rec = ensure(name);
    if (success) {
      rec.successCount++;
      rec.totalResponseMs += elapsedMs;
      rec.lastSuccessAt = Date.now();
    } else {
      rec.failureCount++;
      rec.lastFailureAt = Date.now();
      rec.lastError = error ? error.slice(0, 120) : "Unknown error";
    }
  };
}

/** Record a successful call. */
export function recordSuccess(name: string, responseMs: number): void {
  const rec = ensure(name);
  rec.successCount++;
  rec.totalResponseMs += responseMs;
  rec.lastSuccessAt = Date.now();
}

/** Record a failed call. */
export function recordFailure(name: string, error: string): void {
  const rec = ensure(name);
  rec.failureCount++;
  rec.lastFailureAt = Date.now();
  rec.lastError = error.slice(0, 120);
}

/** Get the full health record for a provider. */
export function getProviderHealth(name: string): ProviderHealthRecord {
  return ensure(name);
}

/** Get all health records, sorted by name. */
export function getAllProviderHealth(): ProviderHealthRecord[] {
  return Array.from(store.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Derive status label from health record. */
export function getProviderStatus(name: string): ProviderStatus {
  const rec = ensure(name);
  const total = rec.successCount + rec.failureCount;
  if (total === 0) return "unknown";
  const failRate = rec.failureCount / total;
  if (rec.successCount === 0) return "down";
  if (failRate > 0.4) return "degraded";
  return "healthy";
}

/** Average response time in ms for a provider. */
export function getAvgResponseMs(name: string): number | null {
  const rec = ensure(name);
  if (rec.successCount === 0) return null;
  return rec.totalResponseMs / rec.successCount;
}

/** Format elapsed time for display (e.g. "2s ago", "5m ago"). */
export function formatAgo(ts: number | null): string {
  if (!ts) return "never";
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
