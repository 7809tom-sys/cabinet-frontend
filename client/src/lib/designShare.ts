/**
 * Sharing a saved design must hand the recipient a link that opens on a public
 * page, not on whatever host the sender happened to be using. Affiliate
 * subdomains rewrite every non-store path into `/store/:slug/...`, which has no
 * shared-view route, and preview/deployment hosts are not customer addresses.
 * Both would leave the recipient on a dead page even though the share itself is
 * valid.
 */
export const PUBLIC_SHARE_ORIGIN = "https://www.cabinetdealz.com";

const PUBLIC_HOSTS = new Set(["cabinetdealz.com", "www.cabinetdealz.com"]);

function isCabinetDealzHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  return PUBLIC_HOSTS.has(host) || /^[a-z0-9-]+\.cabinetdealz\.com$/.test(host);
}

function isLocalOrPreviewHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/:\d+$/, "");
  return host === "localhost"
    || host === "127.0.0.1"
    || host === "[::1]"
    || host.endsWith(".local");
}

/**
 * The origin a shared design link should point at. Public CabinetDealz hosts —
 * including affiliate subdomains — resolve to the main site, because the
 * read-only shared view only exists there. Local and preview hosts keep their
 * own origin so the link is testable before deploy.
 */
export function shareOriginFor(origin: string): string {
  const trimmed = origin.trim().replace(/\/+$/, "");
  let hostname = "";
  try {
    hostname = new URL(trimmed).hostname;
  } catch {
    return trimmed;
  }
  if (isLocalOrPreviewHost(hostname)) return trimmed;
  if (isCabinetDealzHost(hostname)) return PUBLIC_SHARE_ORIGIN;
  return trimmed;
}

export function buildDesignShareUrl({
  origin,
  designId,
  affiliateSlug,
}: {
  origin: string;
  designId: number;
  affiliateSlug?: string | null;
}) {
  const url = new URL("/design", origin);
  url.searchParams.set("load", String(designId));
  if (affiliateSlug) url.searchParams.set("affiliate", affiliateSlug);
  return url.toString();
}

export function buildRemoteDesignSessionUrl({
  origin,
  token,
}: {
  origin: string;
  token: string;
}) {
  // Same rule as the 3D share: the recipient opens this on the public site,
  // where the `/design/session/:token` route lives.
  const url = new URL(`/design/session/${encodeURIComponent(token)}`, shareOriginFor(origin));
  return url.toString();
}

/**
 * The public, read-only 3D view of a shared configuration. It is served by the
 * app router at `/3d/:token` and needs no account, so it is safe to give a
 * recipient who is not the sender.
 */
export function buildPublicDesignViewUrl({
  origin,
  token,
  view,
}: {
  origin: string;
  token: string;
  view?: string | null;
}) {
  const url = new URL(`/3d/${encodeURIComponent(token)}`, shareOriginFor(origin));
  if (view) url.searchParams.set("view", view);
  return url.toString();
}
