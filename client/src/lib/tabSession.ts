import { TAB_TEST_ACCOUNT_TOKEN_KEY } from "./trpcAuthFetch";

/**
 * Per-tab sign-in state that is not the Supabase session itself: the
 * test-account token, and the short redirect history that stops /signin
 * bouncing a signed-in tab back to the page it came from.
 *
 * Both live in `sessionStorage`, so signing out of one tab never affects
 * another. `sessionStorage` writes can throw (Safari private mode, storage
 * disabled), and none of these are important enough to break sign-out over.
 */
export function clearTabSessionHints(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TAB_TEST_ACCOUNT_TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}
