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

/**
 * Sign-in link for a signed-out visit to one affiliate's dashboard
 * (`/affiliate?viewAs=<id>`), or null when the URL names no affiliate.
 *
 * `viewAs` is an admin (or owner) deep link to a private dashboard, so a
 * signed-out viewer must sign in rather than see it. Sign-in is kept per tab,
 * so a brand-new tab opened from a shared link starts signed out. Sending that
 * visit to the public membership sign-up page dropped the affiliate id; this
 * keeps it on `returnTo` so the sign-in lands back on that affiliate.
 */
export function affiliateViewAsSignInHref(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const raw = (params.get("viewAs") ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const affiliateId = Number(raw);
  if (!Number.isSafeInteger(affiliateId) || affiliateId <= 0) return null;
  const back = new URLSearchParams();
  back.set("viewAs", String(affiliateId));
  const section = params.get("section");
  if (section && /^[a-z]+$/.test(section)) back.set("section", section);
  const next = new URLSearchParams();
  next.set("portal", "affiliate");
  next.set("returnTo", `/affiliate?${back.toString()}`);
  const ref = (params.get("ref") ?? "").trim();
  if (ref) next.set("ref", ref);
  return `/signin?${next.toString()}`;
}
