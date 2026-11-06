// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTabAuthFetch, TAB_TEST_ACCOUNT_TOKEN_KEY, tabAccessToken } from "./trpcAuthFetch";

/**
 * Each tab's API calls must carry that tab's own identity. Before this, the
 * token came from whichever session the shared `localStorage` record held, so a
 * tab signed in as an affiliate spoke for the admin session in another tab.
 */

function fakeAuth(tokensByCall: Array<string | null>) {
  let call = 0;
  return {
    getSession: vi.fn(async () => {
      const token = tokensByCall[Math.min(call, tokensByCall.length - 1)];
      call += 1;
      return { data: { session: token ? { access_token: token } : null }, error: null };
    }),
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("tabAccessToken", () => {
  it("returns the token of the session in this tab", async () => {
    expect(await tabAccessToken(fakeAuth(["tab-token"]) as never)).toBe("tab-token");
  });

  it("returns null for a tab that is signed out", async () => {
    expect(await tabAccessToken(fakeAuth([null]) as never)).toBeNull();
  });

  it("treats an empty token as signed out", async () => {
    expect(await tabAccessToken(fakeAuth([""]) as never)).toBeNull();
  });
});

describe("createTabAuthFetch", () => {
  it("sends this tab's access token as an Authorization bearer header", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    const request = createTabAuthFetch(fakeAuth(["admin-token"]) as never, fetchImpl);

    await request("https://api.test/api/trpc/auth.me", { method: "POST" });

    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(headers.get("authorization")).toBe("Bearer admin-token");
  });

  it("gives two tabs the two different identities they are signed in as", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    const adminTab = createTabAuthFetch(fakeAuth(["admin-token"]) as never, fetchImpl);
    const affiliateTab = createTabAuthFetch(fakeAuth(["affiliate-token"]) as never, fetchImpl);

    await adminTab("https://api.test/api/trpc/auth.me", { method: "POST" });
    await affiliateTab("https://api.test/api/trpc/auth.me", { method: "POST" });

    const sent = fetchImpl.mock.calls.map((call) =>
      new Headers(call[1]?.headers as HeadersInit).get("authorization"),
    );
    expect(sent).toEqual(["Bearer admin-token", "Bearer affiliate-token"]);
  });

  it("sends no Authorization header from a signed-out tab, even with a stale token elsewhere", async () => {
    // Another tab's leftover token is invisible to this request.
    window.sessionStorage.setItem("cd.testAccountToken.other-tab", "not-this-tab");
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    const request = createTabAuthFetch(fakeAuth([null]) as never, fetchImpl);

    await request("https://api.test/api/trpc/auth.me", { method: "POST" });

    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-cd-test-account")).toBeNull();
  });

  it("forwards this tab's test-account token without changing the bearer header", async () => {
    window.sessionStorage.setItem(TAB_TEST_ACCOUNT_TOKEN_KEY, "test-account-token");
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    const request = createTabAuthFetch(fakeAuth(["admin-token"]) as never, fetchImpl);

    await request("https://api.test/api/trpc/auth.me", { method: "POST" });

    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(headers.get("authorization")).toBe("Bearer admin-token");
    expect(headers.get("x-cd-test-account")).toBe("test-account-token");
  });

  it("keeps headers the caller already set", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    const request = createTabAuthFetch(fakeAuth(["admin-token"]) as never, fetchImpl);

    await request("https://api.test/api/trpc/auth.me", {
      method: "POST",
      headers: { "x-custom": "kept" },
    });

    const headers = new Headers(fetchImpl.mock.calls[0]?.[1]?.headers as HeadersInit);
    expect(headers.get("x-custom")).toBe("kept");
    expect(headers.get("authorization")).toBe("Bearer admin-token");
  });

  it("never falls back to a shared cookie-only request when a token exists", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { headers: { "content-type": "application/json" } }));
    const request = createTabAuthFetch(fakeAuth(["admin-token"]) as never, fetchImpl);

    await request("https://api.test/api/trpc/auth.me", { method: "POST" });

    // The bearer header is present, so the request cannot be authenticated as
    // whatever the shared app_session_id cookie happens to say.
    expect(new Headers(fetchImpl.mock.calls[0]?.[1]?.headers as HeadersInit).get("authorization")).toBeTruthy();
  });
});
