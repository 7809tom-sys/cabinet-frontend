import { affiliateSlugFromHostname, affiliateSlugFromPath } from "@/lib/affiliateContext";

/** Label the directory API uses for a customer with no affiliate store. */
export const DIRECT_CUSTOMER_STORE_LABEL = "Cabinet Dealz (direct)";

export type DirectoryQuery =
  | { affiliateId: number }
  | { house: true }
  | { adminAll: true };

/**
 * Customer directory scope from cabinet-backend#44.
 * A store id selects that store. `house` selects unattributed Cabinet Dealz rows.
 * Otherwise `adminAll`, which the server allows only when role === "admin".
 *
 * list, get, and summaries accept this object. setStatus, addNote, setFollowUp,
 * and openDeal read the same fields in the handler, but their zod objects in
 * cabinet-backend#44 still list affiliateId only, so the server drops house
 * and adminAll on those four mutations until that input includes them.
 */
export function customerDirectoryInput(affiliateId: number | null, house: boolean): DirectoryQuery {
  if (affiliateId != null) return { affiliateId };
  if (house) return { house: true };
  return { adminAll: true };
}

/** CRM board, summaries, and importable leads. No store id is the admin directory. */
export function crmBoardQueryInput(affiliateId: number | null | undefined): { affiliateId: number } | { adminAll: true } {
  if (affiliateId != null) return { affiliateId };
  return { adminAll: true };
}

/** A deal with no store is a house customer, not every store. */
export function dealCustomerInput(affiliateId: number | null | undefined): { affiliateId: number } | { house: true } {
  if (affiliateId != null) return { affiliateId };
  return { house: true };
}

/** Named store for orders, samples, and contractor requests. Omitted keeps the caller's own rows. */
export function affiliateStoreInput(affiliateId: number | null | undefined): { affiliateId: number } | undefined {
  if (affiliateId != null) return { affiliateId };
  return undefined;
}

/** Path slug wins, then a branded subdomain. The owner site sends no store. */
export function signupStoreScope(location?: { pathname: string; hostname: string }): string | undefined {
  if (!location && typeof window === "undefined") return undefined;
  const pathname = location?.pathname ?? window.location.pathname;
  const hostname = location?.hostname ?? window.location.hostname;
  return affiliateSlugFromPath(pathname) ?? affiliateSlugFromHostname(hostname) ?? undefined;
}

export function customerOwnerStoreLabel(row: {
  ownerStoreName?: string | null;
  ownerAffiliateId?: number | null;
}): string | null {
  const named = row.ownerStoreName?.trim();
  if (named) return named;
  if (row.ownerAffiliateId === null) return DIRECT_CUSTOMER_STORE_LABEL;
  return null;
}
