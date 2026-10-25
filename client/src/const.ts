export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Titan-hosted webmail for the cabinetdealz.com mailboxes (sales@, etc.).
// The admin panel links to this so staff can open the real inbox in a new tab
// instead of the app trying to embed a full email client.
export const WEBMAIL_URL = "https://app.titan.email";

export function isSafeSiteReturnPath(value: string | null | undefined): value is string {
  return Boolean(
    value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/signin") &&
    !value.startsWith("/api/oauth/")
  );
}

export function getSiteSignInUrl(returnTo?: string): string {
  const currentPath = returnTo ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const url = new URL("/signin", window.location.origin);
  if (isSafeSiteReturnPath(currentPath)) url.searchParams.set("returnTo", currentPath);
  return `${url.pathname}${url.search}`;
}

// All sign-in (email, Google) happens on the CabinetDealz /signin page via
// Supabase Auth; `returnTo` carries the page that initiated it.
export const getLoginUrl = () => getSiteSignInUrl();
