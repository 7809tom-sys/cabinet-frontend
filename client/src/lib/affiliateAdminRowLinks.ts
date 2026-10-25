import { affiliateDashboardPath } from "./affiliateStorefrontUrl";

/**
 * Every admin action that opens an affiliate portal must be tied to that row's
 * affiliate ID. Keeping this mapping separate prevents a generic `/affiliate`
 * link from silently falling back to another affiliate.
 */
export function affiliateAdminRowLinks(affiliateId: number) {
  const dashboardUrl = affiliateDashboardPath(affiliateId);
  return {
    portalUrl: dashboardUrl,
    fullPageUrl: dashboardUrl,
  };
}
