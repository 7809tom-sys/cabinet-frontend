import type { SupabaseClient, SupportedStorage } from "@supabase/supabase-js";

/**
 * Where supabase-js keeps the signed-in session.
 *
 * Every tab keeps its own copy: the storage adapter below is backed by
 * `window.sessionStorage`, which the browser gives each tab its own instance of
 * (a duplicated tab inherits a copy, a brand-new tab starts empty). A stable key
 * is used so the record is found again after a reload or an OAuth redirect in
 * the same tab.
 *
 * The previous behaviour used the supabase-js defaults: `localStorage` under
 * `sb-<project-ref>-auth-token`, which one origin shares between all of its
 * tabs, plus a `BroadcastChannel` on that key that relayed every sign-in,
 * sign-out and token refresh to the other tabs. That is why signing in as an
 * affiliate in one tab turned an already open admin tab into that affiliate.
 */
export const AUTH_STORAGE_KEY = "cabinetdealz.auth.session.v1";

/** supabase-js also splits the cached user out under `<key>-user`. */
const LEGACY_KEY_SUFFIXES = ["", "-user"] as const;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Project ref from `https://<ref>.supabase.co`; null when it is not a URL. */
export function projectRefFromSupabaseUrl(supabaseUrl: string | undefined): string | null {
  const raw = (supabaseUrl ?? "").trim();
  if (!raw) return null;
  try {
    const ref = new URL(raw).hostname.split(".")[0];
    return ref || null;
  } catch {
    return null;
  }
}

/**
 * Keys the default supabase-js client used for this project. Nothing reads them
 * any more; they are listed so the stale shared session can be deleted instead
 * of being left behind as a working refresh token in localStorage.
 */
export function legacySharedAuthStorageKeys(supabaseUrl: string | undefined): string[] {
  const ref = projectRefFromSupabaseUrl(supabaseUrl);
  if (!ref) return [];
  return LEGACY_KEY_SUFFIXES.map((suffix) => `sb-${ref}-auth-token${suffix}`);
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, String(value));
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}

/**
 * `window.sessionStorage` when the browser will actually let us write to it.
 * Safari private mode and some storage-locked enterprise profiles throw on
 * `setItem`, so the probe is a real write, not just a property read.
 */
export function browserSessionStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    const store = window.sessionStorage;
    const probe = `${AUTH_STORAGE_KEY}.probe`;
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

/**
 * Per-tab storage adapter for supabase-js. Falls back to tab-local memory when
 * sessionStorage is unavailable (server-side render, private mode), so a tab
 * never borrows another tab's session by accident.
 */
export function createPerTabAuthStorage(store: StorageLike | null = browserSessionStorage()): SupportedStorage {
  const perTab = store ?? memoryStorage();
  return {
    getItem(key) {
      try {
        return perTab.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        perTab.setItem(key, value);
      } catch {
        // A full or read-only store must not break sign-in state in memory.
      }
    },
    removeItem(key) {
      try {
        perTab.removeItem(key);
      } catch {
        // Nothing to clear.
      }
    },
  };
}

/**
 * Delete the session the old shared client left in localStorage. Best effort:
 * a blocked or absent localStorage is not an error, and nothing depends on the
 * result. Returns the keys it removed so the behaviour is testable.
 */
export function removeLegacySharedAuthSession(
  supabaseUrl: string | undefined,
  storage: StorageLike | null = typeof window === "undefined" ? null : window.localStorage,
): string[] {
  const removed: string[] = [];
  if (!storage) return removed;
  for (const key of legacySharedAuthStorageKeys(supabaseUrl)) {
    try {
      if (storage.getItem(key) === null) continue;
      storage.removeItem(key);
      removed.push(key);
    } catch {
      // Treat an unreadable store as nothing to clean.
    }
  }
  return removed;
}

type BroadcastHolder = { broadcastChannel?: BroadcastChannel | null };

/**
 * Close the cross-tab channel supabase-js opens on the storage key, which is
 * how a sign-in in one tab used to be replayed into every other tab. Setting it
 * to null is exactly what the library's own `dispose()` does: posting
 * (`_notifyAllSubscribers`) and receiving (`message` handler) both check this
 * field, so the client keeps refreshing and reading this tab's own session.
 */
export function detachCrossTabAuthBroadcast(
  client: Pick<SupabaseClient, "auth"> | null | undefined,
): boolean {
  const auth = client?.auth as unknown as BroadcastHolder | undefined;
  const channel = auth?.broadcastChannel;
  if (!auth || !channel) return false;
  try {
    channel.close();
  } catch {
    // Already closed, or closed by the browser on navigation.
  }
  auth.broadcastChannel = null;
  return true;
}
