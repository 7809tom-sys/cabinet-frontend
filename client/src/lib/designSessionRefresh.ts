/**
 * View-only share pages re-read the server's confirmed saved design rather
 * than accepting browser-to-browser edits. Keeping this interval centralized
 * ensures every shared viewer follows the same refresh and recovery behavior.
 */
export const SHARED_DESIGN_AUTO_REFRESH_MS = 4_000;

export const sharedDesignAutoRefreshQueryOptions = {
  refetchInterval: SHARED_DESIGN_AUTO_REFRESH_MS,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: "always" as const,
  retry: false,
};

export function sharedDesignRefreshLabel(isRefreshing: boolean, lastCheckedAt: number): string {
  if (isRefreshing) return "Refreshing saved design…";
  if (lastCheckedAt <= 0) return "Connecting to saved design…";
  return `Last checked ${new Date(lastCheckedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
}
