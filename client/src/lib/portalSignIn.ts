export type PortalChoice = "affiliate" | "contractor" | "customer";

export const PORTAL_HOMES: Record<PortalChoice, string> = {
  affiliate: "/affiliate",
  contractor: "/contractor",
  customer: "/customer",
};

export function isPortalChoice(value: string | null | undefined): value is PortalChoice {
  return value === "affiliate" || value === "contractor" || value === "customer";
}

export function storeSignInSlug(pathname: string): string | null {
  const match = pathname.match(/^\/store\/([^/]+)\/signin\/?$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function storePortalReturn(portal: PortalChoice, slug: string, affiliateId?: number | null): string {
  if (portal === "customer") return `/store/${encodeURIComponent(slug)}/account`;
  if (portal === "contractor") return `/contractor?store=${encodeURIComponent(slug)}`;
  if (affiliateId != null && affiliateId > 0) return `/affiliate?viewAs=${encodeURIComponent(String(affiliateId))}`;
  return PORTAL_HOMES.affiliate;
}

/**
 * Where a portal chooser sends the browser. Contractor sign-in stays on the
 * contractor login route. On an affiliate storefront, every choice stays on
 * that store's sign-in page so the referral slug already saved for the visit
 * is not dropped. `ref` is copied onto the next URL as well.
 */
export function portalSignInHref(input: {
  portal: PortalChoice;
  pathname: string;
  search: string;
  storedRef?: string | null;
  /** This store's id, so the affiliate choice opens that store's dashboard. */
  affiliateId?: number | null;
}): string {
  const current = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  const ref = (current.get("ref") || input.storedRef || "").trim();
  const storeSlug = storeSignInSlug(input.pathname);
  const path = input.portal === "contractor" && !storeSlug
    ? "/contractor/login"
    : storeSlug
      ? input.pathname.replace(/\/+$/, "")
      : "/signin";
  const next = new URLSearchParams();
  next.set("portal", input.portal);
  next.set("returnTo", storeSlug ? storePortalReturn(input.portal, storeSlug, input.affiliateId) : PORTAL_HOMES[input.portal]);
  if (ref) next.set("ref", ref);
  return `${path}?${next.toString()}`;
}

/**
 * Plain contractor sign-in link. Always opens /contractor/login.
 * A storefront slug already carried by the portal helper stays on returnTo.
 * An explicit ?store= on the current page is copied onto that return path.
 */
export function contractorSignInHref(input: {
  pathname: string;
  search: string;
  storedRef?: string | null;
}): string {
  const built = portalSignInHref({
    portal: "contractor",
    pathname: input.pathname,
    search: input.search,
    storedRef: input.storedRef,
  });
  const current = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  const store = (current.get("store") || "").trim();
  const url = new URL(built, "http://local.invalid");
  const needsLoginPath = url.pathname !== "/contractor/login";
  if (!store && !needsLoginPath) return built;
  if (needsLoginPath) url.pathname = "/contractor/login";
  if (store) {
    const returnTo = url.searchParams.get("returnTo") || "/contractor";
    const queryAt = returnTo.indexOf("?");
    const nested = new URLSearchParams(queryAt >= 0 ? returnTo.slice(queryAt + 1) : "");
    if (!nested.get("store")) {
      nested.set("store", store);
      const pathOnly = queryAt >= 0 ? returnTo.slice(0, queryAt) : returnTo;
      url.searchParams.set("returnTo", `${pathOnly}?${nested.toString()}`);
    }
  }
  const query = url.searchParams.toString();
  return query ? `${url.pathname}?${query}` : url.pathname;
}
