// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_STORAGE_KEY,
  browserSessionStorage,
  createPerTabAuthStorage,
  detachCrossTabAuthBroadcast,
  legacySharedAuthStorageKeys,
  projectRefFromSupabaseUrl,
  removeLegacySharedAuthSession,
} from "./supabaseAuthStorage";

/**
 * Tom (admin) reported that signing in on one tab changes every other tab: a
 * new tab opened under the 'firstclassfcd' affiliate account instead of his own
 * admin session. Root cause was the supabase-js default auth store: localStorage
 * under `sb-<ref>-auth-token` plus a BroadcastChannel on that key, both shared
 * by every tab of the origin. These tests pin the replacement: per-tab storage.
 */

const SUPABASE_URL = "https://abcdefghijklmnop.supabase.co";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("per-tab auth storage", () => {
  it("keeps a stable, app-owned storage key instead of the shared default", () => {
    expect(AUTH_STORAGE_KEY).toBe("cabinetdealz.auth.session.v1");
  });

  it("reads and writes through the tab's own sessionStorage", () => {
    const storage = createPerTabAuthStorage(window.sessionStorage);

    storage.setItem(AUTH_STORAGE_KEY, "session-json");

    expect(window.sessionStorage.getItem(AUTH_STORAGE_KEY)).toBe("session-json");
    expect(window.localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(AUTH_STORAGE_KEY)).toBe("session-json");

    storage.removeItem(AUTH_STORAGE_KEY);
    expect(storage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("never writes the session to localStorage, so another tab cannot inherit it", () => {
    const storage = createPerTabAuthStorage(browserSessionStorage());

    storage.setItem(`${AUTH_STORAGE_KEY}-user`, '{"user":{"id":1}}');

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.getItem(`${AUTH_STORAGE_KEY}-user`)).toBe('{"user":{"id":1}}');
  });

  it("falls back to tab-local memory when sessionStorage is unavailable", () => {
    const storage = createPerTabAuthStorage(null);

    expect(() => storage.setItem(AUTH_STORAGE_KEY, "x")).not.toThrow();
    expect(storage.getItem(AUTH_STORAGE_KEY)).toBe("x");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("survives a store that throws on every call (private mode)", () => {
    const hostile = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("quota"); },
      removeItem: () => { throw new Error("denied"); },
    };
    const storage = createPerTabAuthStorage(hostile);

    expect(storage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(() => storage.setItem(AUTH_STORAGE_KEY, "x")).not.toThrow();
    expect(() => storage.removeItem(AUTH_STORAGE_KEY)).not.toThrow();
  });

  it("reports no browser sessionStorage instead of throwing when it is blocked", () => {
    const blocked = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new Error("blocked by policy");
    });

    expect(browserSessionStorage()).toBeNull();
    blocked.mockRestore();
  });
});

describe("legacy shared session cleanup", () => {
  it("derives the project-ref keys the default supabase-js client used", () => {
    expect(projectRefFromSupabaseUrl(SUPABASE_URL)).toBe("abcdefghijklmnop");
    expect(projectRefFromSupabaseUrl("not a url")).toBeNull();
    expect(projectRefFromSupabaseUrl(undefined)).toBeNull();
    expect(legacySharedAuthStorageKeys(SUPABASE_URL)).toEqual([
      "sb-abcdefghijklmnop-auth-token",
      "sb-abcdefghijklmnop-auth-token-user",
    ]);
  });

  it("removes a refresh token the old shared client left in localStorage", () => {
    window.localStorage.setItem("sb-abcdefghijklmnop-auth-token", '{"refresh_token":"old"}');
    window.localStorage.setItem("sb-abcdefghijklmnop-auth-token-user", '{"user":{"id":1}}');
    window.localStorage.setItem("unrelated", "keep me");

    const removed = removeLegacySharedAuthSession(SUPABASE_URL, window.localStorage);

    expect(removed).toEqual([
      "sb-abcdefghijklmnop-auth-token",
      "sb-abcdefghijklmnop-auth-token-user",
    ]);
    expect(window.localStorage.getItem("sb-abcdefghijklmnop-auth-token")).toBeNull();
    expect(window.localStorage.getItem("sb-abcdefghijklmnop-auth-token-user")).toBeNull();
    expect(window.localStorage.getItem("unrelated")).toBe("keep me");
  });

  it("leaves other Supabase project keys and other storage alone", () => {
    window.localStorage.setItem("sb-otherproject-auth-token", '{"refresh_token":"theirs"}');

    expect(removeLegacySharedAuthSession(SUPABASE_URL, window.localStorage)).toEqual([]);
    expect(window.localStorage.getItem("sb-otherproject-auth-token")).toBe('{"refresh_token":"theirs"}');
    expect(window.sessionStorage.length).toBe(0);
  });

  it("does nothing when localStorage is unavailable", () => {
    expect(removeLegacySharedAuthSession(SUPABASE_URL, null)).toEqual([]);
  });
});

describe("cross-tab broadcast", () => {
  function fakeClient() {
    const close = vi.fn();
    const holder: { auth: { broadcastChannel: BroadcastChannel | null } } = {
      auth: { broadcastChannel: { close } as unknown as BroadcastChannel },
    };
    return { holder, close };
  }

  it("closes supabase-js's BroadcastChannel and nulls it so it cannot reopen a relay", () => {
    const { holder, close } = fakeClient();

    expect(detachCrossTabAuthBroadcast(holder as never)).toBe(true);

    expect(close).toHaveBeenCalledTimes(1);
    expect(holder.auth.broadcastChannel).toBeNull();
  });

  it("is a no-op for a client that never opened a channel", () => {
    const holder = { auth: { broadcastChannel: null } };

    expect(detachCrossTabAuthBroadcast(holder as never)).toBe(false);
    expect(detachCrossTabAuthBroadcast(null)).toBe(false);
  });

  it("does not throw when the channel is already closed", () => {
    const holder = {
      auth: {
        broadcastChannel: {
          close: () => { throw new Error("already closed"); },
        } as unknown as BroadcastChannel,
      },
    };

    expect(() => detachCrossTabAuthBroadcast(holder as never)).not.toThrow();
    expect(holder.auth.broadcastChannel).toBeNull();
  });
});
