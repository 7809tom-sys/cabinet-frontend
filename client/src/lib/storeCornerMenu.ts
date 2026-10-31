import { affiliateDashboardPath } from "@/lib/affiliateStorefrontUrl";

export type StoreCornerKind = "signed-out" | "store-admin" | "account";

/**
 * Corner menu for every affiliate store.
 * Any role === "admin" gets Store admin. A non-admin gets it only when the
 * affiliate record loaded for their login is this store. Everyone else who is
 * signed in sees Account. Signed-out visitors see Sign in and Create account.
 */
export function storeCornerKind(input: {
  signedIn: boolean;
  role: string | null | undefined;
  storeId: number | null | undefined;
  ownedAffiliateId: number | null | undefined;
}): StoreCornerKind {
  if (!input.signedIn) return "signed-out";
  if (input.role === "admin") return "store-admin";
  if (input.storeId != null && input.ownedAffiliateId != null && input.ownedAffiliateId === input.storeId) {
    return "store-admin";
  }
  return "account";
}

export function storeAccountPath(slug: string): string {
  return `/store/${encodeURIComponent(slug)}/account`;
}

export function storeSignInPath(slug: string, options?: { createAccount?: boolean }): string {
  const params = new URLSearchParams();
  params.set("returnTo", storeAccountPath(slug));
  if (options?.createAccount) params.set("tab", "signup");
  return `/store/${encodeURIComponent(slug)}/signin?${params.toString()}`;
}

export function storeAdminPath(storeId: number): string {
  return affiliateDashboardPath(storeId);
}

/** Stay on this sign-in page (store or platform) and open the login tab. */
export function signInStayHref(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("tab");
  const query = params.toString();
  const path = pathname || "/signin";
  return query ? `${path}?${query}` : path;
}
