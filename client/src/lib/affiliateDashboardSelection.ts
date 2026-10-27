export type AffiliateDashboardSelection =
  | { kind: "admin-view-as"; affiliateId: number }
  | { kind: "admin-picker" }
  | { kind: "my-affiliate" };

export function resolveAffiliateDashboardSelection(viewAsId: string | null | undefined, isAdmin: boolean): AffiliateDashboardSelection {
  if (!isAdmin) return { kind: "my-affiliate" };
  const affiliateId = Number(viewAsId);
  if (Number.isInteger(affiliateId) && affiliateId > 0) return { kind: "admin-view-as", affiliateId };
  return { kind: "admin-picker" };
}

/** What to show when a signed-in viewer has no resolved affiliate store. */
export type AffiliatePortalFallback = "admin-empty" | "signed-in-unlinked";

/**
 * A signed-in person whose affiliate store cannot be resolved must not see the
 * public landing page. That page's Sign in button sends them back to /signin,
 * and an existing session immediately redirects them here again.
 * Administrators get the existing empty-admin state instead.
 */
export function affiliatePortalFallback(isAdmin: boolean): AffiliatePortalFallback {
  return isAdmin ? "admin-empty" : "signed-in-unlinked";
}
