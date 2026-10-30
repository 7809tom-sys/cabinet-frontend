import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";

/** Shown when Supabase has a session but auth.me did not return an app user. */
export const PROFILE_UNAVAILABLE_MESSAGE = "We couldn't load your CabinetDealz profile";

/**
 * Supabase returns a user with an empty identities list, and sends no mail,
 * when signUp is asked to create an email that already has an account.
 */
export const ACCOUNT_ALREADY_EXISTS_MESSAGE =
  "An account with this email already exists — sign in or reset your password";

export function isRepeatedSignup(user: { identities?: unknown[] | null } | null | undefined): boolean {
  return !!user && Array.isArray(user.identities) && user.identities.length === 0;
}

export type ErrorSource = "query" | "mutation";

/**
 * Send the browser to sign-in only when a deliberate action fails as
 * unauthorized AND auth.me itself has no user. A 401 from any other procedure
 * while a profile is loaded stays on the form.
 *
 * Background queries never redirect. That includes a protected query a guest
 * can trip while browsing; redirecting those broke the Back button.
 */
export function shouldRedirectToLoginOnError(
  error: unknown,
  source: ErrorSource,
  authMeUser: unknown = null,
): boolean {
  if (source !== "mutation") return false;
  if (!(error instanceof TRPCClientError)) return false;
  if (error.message !== UNAUTHED_ERR_MSG) return false;
  return authMeUser == null;
}

export function isUnauthorizedClientError(error: unknown): boolean {
  return error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG;
}
