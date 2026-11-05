// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Logging out must end only this browser's session. supabase.auth.signOut()
 * with no options defaults to scope 'global', which revokes every refresh
 * token the person has and signs them out of the main site, each affiliate
 * /store/:slug store, admin, and the contractor portal at once.
 */

const auth = vi.hoisted(() => ({
  signOut: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

const utils = vi.hoisted(() => ({
  auth: {
    me: {
      setData: vi.fn(),
      invalidate: vi.fn(),
      fetch: vi.fn(),
    },
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => utils,
    auth: {
      me: {
        useQuery: () => ({ data: { id: 1, role: "user" }, isLoading: false, error: null, refetch: vi.fn() }),
      },
      logout: {
        useMutation: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false, error: null }),
      },
    },
  },
}));

import { useAuth } from "./useAuth";

describe("useAuth logout", () => {
  beforeEach(() => {
    auth.signOut.mockReset();
    auth.signOut.mockResolvedValue({ error: null });
    utils.auth.me.invalidate.mockReset();
    utils.auth.me.invalidate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("signs out with scope 'local' so other sites and devices stay signed in", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(auth.signOut).not.toHaveBeenCalledWith();
  });

  it("never reaches for a global sign-out", async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    for (const call of (auth.signOut as Mock).mock.calls) {
      expect(call[0]).toEqual({ scope: "local" });
    }
  });

  it("drops this browser's test-account token and the cached profile after signing out", async () => {
    window.sessionStorage.setItem("cd.testAccountToken", "test-token");
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(window.sessionStorage.getItem("cd.testAccountToken")).toBeNull();
    expect(utils.auth.me.setData).toHaveBeenCalledWith(undefined, null);
  });
});
