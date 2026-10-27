/**
 * Company sales forecast access.
 *
 * There is no role named "sales". The user role enum is
 * user, admin, distributor, dealer, partner, designer, sales_rep, contractor.
 * Internal sales users are `designer` (sales staff) and `sales_rep` (1099).
 * They already share the CRM with admin through crmStaffProcedure. This module
 * uses that same trio and does not grant forecast or catalog-editor access to
 * partners, dealers, contractors, members, or other vendors' accounts.
 */

export const COMPANY_SALES_FORECAST_ROLES = ["admin", "designer", "sales_rep"] as const;

export function isCompanySalesForecastRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "designer" || role === "sales_rep";
}

/** Designer and sales rep. Admins keep the full admin workspace. */
export function isInternalSalesRole(role: string | null | undefined): boolean {
  return role === "designer" || role === "sales_rep";
}

export type CatalogEditorEntry =
  | { kind: "pelican" }
  | { kind: "cabinet"; distributorId: number }
  | { kind: "unspecified" };

/**
 * A forecast "Edit product" link. `catalog=pelican` or `catalog=cabinet` is
 * required so an ordinary vendor-portal visit is not treated as this editor.
 */
export function catalogEditorEntry(params: URLSearchParams): CatalogEditorEntry {
  if (params.get("section") !== "catalog") return { kind: "unspecified" };
  const catalog = params.get("catalog");
  const distributorId = Number(params.get("as"));
  if (catalog === "cabinet" && Number.isInteger(distributorId) && distributorId > 0) {
    return { kind: "cabinet", distributorId };
  }
  if (catalog === "pelican") return { kind: "pelican" };
  return { kind: "unspecified" };
}
