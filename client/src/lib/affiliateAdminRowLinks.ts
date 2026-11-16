import { affiliateDashboardPath } from "./affiliateStorefrontUrl";

/**
 * Every admin action that opens an affiliate portal must be tied to that row's
 * affiliate ID. Keeping this mapping separate prevents a generic `/affiliate`
 * link from silently falling back to another affiliate.
 *
 * `portalUrl` is the admin (or owner) deep link to that store's dashboard.
 * `signInUrl` is the shareable affiliate sign-in / membership landing. A
 * signed-out visit to `portalUrl` is sent to `/signin` (not that landing), and
 * a signed-in non-admin ignores `viewAs` and stays on their own store, so the
 * two URLs are not interchangeable.
 */
export function affiliateAdminRowLinks(affiliateId: number) {
  const dashboardUrl = affiliateDashboardPath(affiliateId);
  return {
    portalUrl: dashboardUrl,
    fullPageUrl: dashboardUrl,
    signInUrl: "/affiliate",
  };
}

/** Absolute credential URLs for the admin details panel. */
export function affiliateAdminCredentialLinks(affiliateId: number, origin = "") {
  const links = affiliateAdminRowLinks(affiliateId);
  const base = origin.replace(/\/$/, "");
  return {
    portalUrl: `${base}${links.portalUrl}`,
    signInUrl: `${base}${links.signInUrl}`,
  };
}
