export type FavoriteSyncStatusInput = {
  authenticated: boolean;
  lastSyncedAt: Date | string | null;
  isPending: boolean;
  hasError: boolean;
};

export function favoriteSyncStatusText(
  { authenticated, lastSyncedAt, isPending, hasError }: FavoriteSyncStatusInput,
  now = Date.now()
): string {
  if (!authenticated) return "Saved on this device. Sign in to sync across devices.";
  if (hasError) return "Favorites are saved here and will retry syncing when your connection returns.";
  if (isPending) return "Syncing favorites across devices…";
  if (!lastSyncedAt) return "Your favorites sync to your account across devices.";

  const timestamp = new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(timestamp)) return "Your favorites sync to your account across devices.";
  const ageMs = Math.max(0, now - timestamp);
  if (ageMs < 60_000) return "Last synced just now";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `Last synced ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last synced ${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `Last synced ${new Date(timestamp).toLocaleDateString()}`;
}
