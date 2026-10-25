import { UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCClientError } from "@trpc/client";

/**
 * Where a failing tRPC call originated. We treat the two very differently:
 *
 * - "query"  → a BACKGROUND data fetch the page kicked off (often automatic).
 *              A guest simply browsing the public site can trigger a protected
 *              query that 401s. We must NOT yank the whole window to the
 *              sign-in page for these — doing so corrupts browser history and makes the
 *              Back button appear broken (Back lands on a URL that immediately
 *              re-redirects). Pages handle their own unauthenticated state.
 *
 * - "mutation" → a DELIBERATE user action (submit/save/checkout). If the session
 *              has expired, sending them to log in is the expected behavior.
 */
export type ErrorSource = "query" | "mutation";

/**
 * Pure decision: should an errored tRPC call trigger a full-page redirect to the
 * site-owned sign-in page? Only unauthorized MUTATION errors qualify. This is the single
 * source of truth used by the query/mutation cache subscribers in main.tsx and
 * is unit-tested to guard against the "browser Back is broken" regression.
 */
export function shouldRedirectToLoginOnError(
  error: unknown,
  source: ErrorSource
): boolean {
  // Never redirect on background query errors — that's the Back-button trap.
  if (source !== "mutation") return false;
  if (!(error instanceof TRPCClientError)) return false;
  return error.message === UNAUTHED_ERR_MSG;
}
