import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchTrpcJson, type FetchLike } from "./trpcTransport";

/**
 * Where a test-account login keeps its server-issued token. It lives in
 * `sessionStorage`, so it is already per tab.
 */
export const TAB_TEST_ACCOUNT_TOKEN_KEY = "cd.testAccountToken";

type AuthWithSession = Pick<SupabaseClient["auth"], "getSession">;

/**
 * The access token belonging to *this tab*, or null when this tab is signed
 * out. `getSession()` reads the tab's own session store and refreshes an
 * expired access token, so the value is current at request time.
 *
 * Nothing here consults `localStorage` or a cookie: identity travels in the
 * request's `Authorization` header, which is what the API verifies.
 */
export async function tabAccessToken(auth: AuthWithSession): Promise<string | null> {
  const { data } = await auth.getSession();
  const token = data.session?.access_token;
  return typeof token === "string" && token ? token : null;
}

function tabTestAccountToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TAB_TEST_ACCOUNT_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * tRPC `fetch` that stamps every request with the signed-in identity of the
 * tab making it. Two tabs signed in as two different people therefore reach
 * the API as two different people, even though they share one browser profile.
 */
export function createTabAuthFetch(
  auth: AuthWithSession,
  fetchImpl: FetchLike = globalThis.fetch,
): FetchLike {
  return async (input, init) => {
    const token = await tabAccessToken(auth);
    const testToken = tabTestAccountToken();
    const headers = new Headers(init?.headers);
    if (testToken) headers.set("x-cd-test-account", testToken);
    if (token) headers.set("authorization", `Bearer ${token}`);
    if (!token && !testToken) return fetchTrpcJson(input, init, fetchImpl);
    return fetchTrpcJson(input, { ...init, headers }, fetchImpl);
  };
}
