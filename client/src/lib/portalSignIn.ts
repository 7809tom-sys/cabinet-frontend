export type PortalChoice = "affiliate" | "contractor" | "customer";

export const PORTAL_HOMES: Record<PortalChoice, string> = {
  affiliate: "/affiliate",
  contractor: "/contractor",
  customer: "/customer",
};

export function isPortalChoice(value: string | null | undefined): value is PortalChoice {
  return value === "affiliate" || value === "contractor" || value === "customer";
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
}): string {
  const current = new URLSearchParams(input.search.startsWith("?") ? input.search.slice(1) : input.search);
  const ref = (current.get("ref") || input.storedRef || "").trim();
  const onStoreSignIn = /^\/store\/[^/]+\/signin\/?$/.test(input.pathname);
  const path = input.portal === "contractor" && !onStoreSignIn
    ? "/contractor/login"
    : onStoreSignIn
      ? input.pathname.replace(/\/+$/, "")
      : "/signin";
  const next = new URLSearchParams();
  next.set("portal", input.portal);
  next.set("returnTo", PORTAL_HOMES[input.portal]);
  if (ref) next.set("ref", ref);
  return `${path}?${next.toString()}`;
}
