const PRODUCTION_ORIGIN = "https://www.cabinetdealz.com";
function affiliatePublicOrigin(origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN)).replace(/\/+$/, "");
  return base;
}

/**
 * The canonical public address for an affiliate storefront. The application
 * router renders every branded store at /store/:slug; subdomains are only an
 * optional server-side alias and must not be distributed as the primary link.
 */
export function affiliateStorefrontPath(slug: string): string {
  return `/store/${encodeURIComponent(slug.trim().toLowerCase())}`;
}

/** Customer-facing routes that must remain inside the selected affiliate scope. */
export function affiliateCatalogPath(slug: string): string {
  return `${affiliateStorefrontPath(slug)}/catalog`;
}

export function affiliateDesignerPath(slug: string): string {
  return `${affiliateStorefrontPath(slug)}/design`;
}

export function affiliateOrderPath(slug: string): string {
  return `${affiliateStorefrontPath(slug)}/order`;
}

/** The canonical administrative dashboard address for one affiliate record. */
export function affiliateDashboardPath(affiliateId: number): string {
  return `/affiliate?viewAs=${encodeURIComponent(String(affiliateId))}`;
}

/**
 * Affiliate owners use their dashboard as the permanent back door. They may
 * visit their own public storefront routes, but an unscoped platform route or
 * another affiliate's store returns them to their own dashboard.
 */
export function affiliateOwnerScopeDestination({
  pathname,
  search,
  affiliateId,
  slug,
}: {
  pathname: string;
  search: string;
  affiliateId: number;
  slug: string;
}): string | null {
  const storefrontRoot = affiliateStorefrontPath(slug);
  if (pathname === storefrontRoot || pathname.startsWith(`${storefrontRoot}/`)) return null;

  const dashboard = affiliateDashboardPath(affiliateId);
  if (pathname !== "/affiliate") return dashboard;

  const params = new URLSearchParams(search);
  if (params.get("viewAs") === String(affiliateId)) return null;
  const section = params.get("section")?.trim();
  return section ? `${dashboard}&section=${encodeURIComponent(section)}` : dashboard;
}

/** Canonical public links rendered within the selected affiliate dashboard. */
export function affiliateDashboardLinks(
  affiliate: { slug: string; referralCode: string },
  origin?: string,
): { storefrontUrl: string; referralUrl: string } {
  const base = affiliatePublicOrigin(origin);
  const storefrontPath = affiliateStorefrontPath(affiliate.slug);
  return {
    // Do not distribute an unconfigured subdomain such as
    // firstclass.cabinetdealz.com; use the canonical routed storefront.
    storefrontUrl: `${base}${storefrontPath}`,
    referralUrl: `${base}${storefrontPath}/order?ref=${encodeURIComponent(affiliate.referralCode)}`,
  };
}

export function affiliateStorefrontUrl(slug: string, origin?: string): string {
  const base = (origin || (typeof window !== "undefined" ? window.location.origin : PRODUCTION_ORIGIN)).replace(/\/+$/, "");
  return `${base}${affiliateStorefrontPath(slug)}`;
}

export function copyAffiliateStorefrontLink(
  slug: string,
  options?: { origin?: string; clipboard?: Pick<Clipboard, "writeText"> }
): Promise<void> {
  const clipboard = options?.clipboard ?? navigator.clipboard;
  return clipboard.writeText(affiliateStorefrontUrl(slug, options?.origin));
}
