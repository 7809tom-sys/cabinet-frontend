import { describe, expect, it } from "vitest";
import { favoriteSyncStatusText } from "./favoriteSyncStatus";

describe("favoriteSyncStatusText", () => {
  const now = new Date("2026-08-12T20:00:00.000Z").getTime();

  it("clearly identifies guest-local favorites", () => {
    expect(favoriteSyncStatusText({ authenticated: false, lastSyncedAt: null, isPending: false, hasError: false }, now))
      .toBe("Saved on this device. Sign in to sync across devices.");
  });

  it("reports a recent completed account sync", () => {
    expect(favoriteSyncStatusText({ authenticated: true, lastSyncedAt: new Date(now - 2 * 60_000), isPending: false, hasError: false }, now))
      .toBe("Last synced 2 minutes ago");
  });

  it("prioritizes pending and connection-error states", () => {
    expect(favoriteSyncStatusText({ authenticated: true, lastSyncedAt: null, isPending: true, hasError: false }, now))
      .toBe("Syncing favorites across devices…");
    expect(favoriteSyncStatusText({ authenticated: true, lastSyncedAt: null, isPending: false, hasError: true }, now))
      .toBe("Favorites are saved here and will retry syncing when your connection returns.");
  });
});
