// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sign-in page shows a "Sign out" button when an existing session would
 * bounce the browser back to /signin. That button must also be a this-browser
 * sign-out: scope 'local'. The supabase-js default is 'global', which revokes
 * the person's refresh tokens everywhere (main site, affiliate /store/:slug
 * stores, admin, contractor portal) instead of only ending this session.
 */

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { auth } }));

const meFetch = vi.hoisted(() => vi.fn());
const destinationFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      auth: {
        me: { invalidate: vi.fn().mockResolvedValue(undefined), fetch: meFetch },
        signInDestination: { fetch: destinationFetch },
      },
    }),
    auth: {
      testAccountsEnabled: { useQuery: () => ({ data: { enabled: false } }) },
      testLogin: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    affiliates: {
      bySlug: { useQuery: () => ({ data: undefined }) },
    },
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key, lang: "en" }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import SignIn from "./SignIn";

describe("SignIn stuck-session sign out", () => {
  beforeEach(() => {
    for (const fn of Object.values(auth)) {
      if (typeof fn === "function" && "mockReset" in fn) (fn as { mockReset: () => void }).mockReset();
    }
    meFetch.mockReset();
    destinationFetch.mockReset();
    auth.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
    auth.signOut.mockResolvedValue({ error: null });
    meFetch.mockResolvedValue({ id: 1, role: "user", email: "tom@example.com" });
    // The server would send this person straight back to /signin: the page
    // stops the loop and offers the sign-out button.
    destinationFetch.mockResolvedValue({ destination: "/signin" });
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("signs out with scope 'local' when stopping a redirect loop", async () => {
    render(<SignIn />);

    const button = await screen.findByRole("button", { name: "Sign out" });
    await act(async () => {
      button.click();
    });

    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1));
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
});
