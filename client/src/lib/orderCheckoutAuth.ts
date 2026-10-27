/**
 * Client inputs for the locked order procedures in cabinet-backend#19.
 *
 * Confirm allows an admin, a paid Stripe session, or the signed-in owner
 * presenting this order's access token. Charge and the installation estimate
 * allow an admin or the signed-in owner, and require that token only when one
 * is stored. A guest token without a signed-in owner is not accepted.
 */

export function createdOrderAccessToken(result: object): string | undefined {
  const value = (result as { accessToken?: unknown }).accessToken;
  if (typeof value !== "string") return undefined;
  const token = value.trim();
  if (token.length < 1 || token.length > 256) return undefined;
  return token;
}

/** Omit the field when absent so a signed-in owner still matches a null or missing token column. */
export function orderAccessTokenInput(
  accessToken: string | null | undefined,
): { accessToken: string } | Record<string, never> {
  const token = createdOrderAccessToken({ accessToken });
  return token ? { accessToken: token } : {};
}

export function installationEstimateQueryEnabled(input: {
  submittedId: number | null;
  emailValid: boolean;
  isAuthenticated: boolean;
}): boolean {
  return input.submittedId != null && input.emailValid && input.isAuthenticated;
}
