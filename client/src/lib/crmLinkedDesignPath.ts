import { designOpenPath } from "@/lib/designOwnerScope";
import type { CustomerLookupResult } from "@/lib/crmCustomerLookupProcedures";

/**
 * Adds the CRM context to a Designer link. The route and the `load` parameter
 * come from `designOpenPath` (main's #274), which builds them from the DESIGN's
 * own store — never from the store whose CRM happens to be open. `crmDeal` only
 * tells the Designer which deal to come back to.
 */
export function withCrmDealContext(path: string, dealId: number): string {
  return `${path}${path.includes("?") ? "&" : "?"}crmDeal=${dealId}`;
}

/**
 * Where one linked design opens from the CRM. Call sites use `designOpenPath`
 * from lib/designOwnerScope directly (that is the rule main's wiring test pins);
 * this is the same composition for code that does not have the design unpacked.
 */
export function linkedDesignOpenPath(
  design: { id: number; affiliateSlug?: string | null },
  dealId: number,
): string {
  return withCrmDealContext(
    designOpenPath({ id: design.id, affiliateSlug: design.affiliateSlug ?? null }),
    dealId,
  );
}

/** The URL a one-design lookup result opens, or null when there is not exactly one. */
export function oneDesignOpenUrl(result: CustomerLookupResult | undefined): string | null {
  if (!result?.ok || result.outcome !== "one") return null;
  const design = result.designs[0];
  if (!design) return null;
  return linkedDesignOpenPath(design, result.dealId);
}
