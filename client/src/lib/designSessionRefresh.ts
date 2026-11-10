/**
 * View-only share pages re-read the server's confirmed saved design rather
 * than accepting browser-to-browser edits. Keeping this interval centralized
 * ensures every shared viewer follows the same refresh and recovery behavior.
 *
 * The cadence stays at 3 seconds. A tick only asks for the saved design: it
 * does not reload the page, and it does not rebuild the WebGL renderer. A tick
 * is skipped while one fetch is still running or the tab is hidden, and
 * repeated failures wait longer instead of retrying at full speed.
 */
export const SHARED_DESIGN_AUTO_REFRESH_MS = 3_000;

/** Longest wait after a run of failed refreshes. The view keeps the last good design. */
export const SHARED_DESIGN_REFRESH_MAX_BACKOFF_MS = 24_000;

type SharedDesignRefreshQuery = {
  state: {
    fetchStatus: string;
    fetchFailureCount: number;
  };
};

export function sharedDesignRefreshIntervalMs(input: {
  hidden: boolean;
  fetching: boolean;
  failureCount: number;
}): number | false {
  // A hidden tab and an in-flight fetch must not schedule another request.
  // Returning false clears the timer; the next successful or failed settle,
  // or focusing the tab, schedules it again.
  if (input.hidden || input.fetching) return false;
  const failures = Math.max(0, Math.floor(input.failureCount));
  if (failures === 0) return SHARED_DESIGN_AUTO_REFRESH_MS;
  const backedOff = SHARED_DESIGN_AUTO_REFRESH_MS * 2 ** Math.min(failures, 4);
  return Math.min(backedOff, SHARED_DESIGN_REFRESH_MAX_BACKOFF_MS);
}

export function sharedDesignRefreshInterval(query: SharedDesignRefreshQuery): number | false {
  const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
  return sharedDesignRefreshIntervalMs({
    hidden,
    fetching: query.state.fetchStatus === "fetching",
    failureCount: query.state.fetchFailureCount,
  });
}

export const sharedDesignAutoRefreshQueryOptions = {
  refetchInterval: sharedDesignRefreshInterval,
  // The interval callback also checks focus. A hidden tab does not keep fetching.
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: "always" as const,
  retry: false,
};

/**
 * Keep the previous design object when a refresh returned the same payload.
 * A new object with the same cabinets would rebuild the 3D scene on a timer.
 */
export function retainUnchangedValue<T>(previous: T | null, next: T | null): T | null {
  if (next == null) return previous;
  if (previous != null && JSON.stringify(previous) === JSON.stringify(next)) return previous;
  return next;
}

export function sharedDesignRefreshLabel(isRefreshing: boolean, lastCheckedAt: number): string {
  if (isRefreshing) return "Refreshing saved design…";
  if (lastCheckedAt <= 0) return "Connecting to saved design…";
  return `Last checked ${new Date(lastCheckedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
}
