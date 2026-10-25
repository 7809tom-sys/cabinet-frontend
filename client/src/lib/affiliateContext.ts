/**
 * Storefront identity and browser-storage isolation.
 *
 * A URL-owned scope is authoritative. Browser storage must never choose branding,
 * tenant ownership, or navigation context.
 */
export const OWNER_STORE_SCOPE = "owner" as const;
export type StoreScope = typeof OWNER_STORE_SCOPE | string;

export function normalizeStoreScope(value: string | null | undefined): StoreScope {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized && normalized !== OWNER_STORE_SCOPE ? normalized : OWNER_STORE_SCOPE;
}

/**
 * Detect whether the current page is part of an affiliate's white-labeled
 * storefront experience.
 */
export function isAffiliateStorefrontPath(pathname: string): boolean {
  return pathname.startsWith("/store/") || pathname.startsWith("/store-preview/");
}

/** Management routes must remain outside the public storefront route tree. */
export function isAffiliateManagementPath(pathname: string): boolean {
  const normalized = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return normalized === "/affiliate"
    || normalized.startsWith("/affiliate/")
    || normalized === "/admin"
    || normalized.startsWith("/admin/");
}

/** Extract the affiliate slug from a storefront path, when present. */
export function affiliateSlugFromPath(pathname: string): string | null {
	const match = pathname.match(/^\/(?:store|store-preview)\/([^/]+)/);
  if (!match) return null;
  try {
    return normalizeStoreScope(decodeURIComponent(match[1])) === OWNER_STORE_SCOPE
      ? null
      : normalizeStoreScope(decodeURIComponent(match[1]));
  } catch {
    return normalizeStoreScope(match[1]) === OWNER_STORE_SCOPE ? null : normalizeStoreScope(match[1]);
  }
}

/** Resolve a single branded CabinetDealz subdomain in the browser. */
export function affiliateSlugFromHostname(hostname: string | null | undefined): string | null {
  const host = (hostname ?? "").trim().toLowerCase().replace(/:\d+$/, "");
  const suffix = ".cabinetdealz.com";
  if (!host.endsWith(suffix)) return null;
  const slug = host.slice(0, -suffix.length);
  return slug && slug !== "www" && !slug.includes(".") ? slug : null;
}

/**
 * Canonical scope precedence: /store/:slug, then ?affiliate=, then a branded
 * hostname during proxy canonicalization, otherwise the Cabinet Dealz owner.
 */
export function resolveStoreScope(input?: {
  pathname?: string | null;
  search?: string | null;
  hostname?: string | null;
}): StoreScope {
  const pathname = input?.pathname ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const search = input?.search ?? (typeof window !== "undefined" ? window.location.search : "");
  const hostname = input?.hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  const pathSlug = affiliateSlugFromPath(pathname);
  if (pathSlug) return normalizeStoreScope(pathSlug);
  const querySlug = new URLSearchParams(search).get("affiliate");
  if (querySlug?.trim()) return normalizeStoreScope(querySlug);
  const hostnameSlug = affiliateSlugFromHostname(hostname);
  return hostnameSlug ? normalizeStoreScope(hostnameSlug) : OWNER_STORE_SCOPE;
}

export function affiliateSlugForStoreScope(scope: StoreScope): string | null {
  const normalized = normalizeStoreScope(scope);
  return normalized === OWNER_STORE_SCOPE ? null : normalized;
}

/**
 * Commerce navigation must retain the same tenant as the Designer, catalog, and
 * browser storage. The platform cart stays at /cart; every affiliate cart uses
 * its routed white-label shell.
 */
export function cartPathForStoreScope(scope: StoreScope): string {
  const slug = affiliateSlugForStoreScope(scope);
  return slug ? `/store/${encodeURIComponent(slug)}/cart` : "/cart";
}

export function storefrontAccountScope(scope: StoreScope): string {
  return affiliateSlugForStoreScope(scope) ?? "main";
}

export function scopedBrowserStorageKey(baseKey: string, scope: StoreScope): string {
  return `${baseKey}:${normalizeStoreScope(scope)}`;
}

export function designerDraftIdentity(email: string | null | undefined): string {
  return (email?.trim().toLowerCase() || "guest");
}

export function designerDraftStorageKey(scope: StoreScope, email: string | null | undefined): string {
  return `cabinet-dealz:designer-draft:v2:${normalizeStoreScope(scope)}:${designerDraftIdentity(email)}`;
}

export function legacyDesignerDraftStorageKey(email: string | null | undefined): string {
  return `cabinet-dealz:designer-draft:v1:${designerDraftIdentity(email)}`;
}

export function designerDraftActiveKey(scope: StoreScope): string {
  return `cabinet-dealz:designer-draft:active:v2:${normalizeStoreScope(scope)}`;
}

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Legacy v1 drafts had no creator scope. The only truthful migration is owner.
 * This is idempotent and never overwrites an existing v2 owner draft.
 */
export function migrateLegacyDesignerDraftToOwner(
  storage: DraftStorage,
  email: string | null | undefined,
): { migrated: boolean; removedLegacy: boolean } {
  const legacyKey = legacyDesignerDraftStorageKey(email);
  const ownerKey = designerDraftStorageKey(OWNER_STORE_SCOPE, email);
  const legacyRaw = storage.getItem(legacyKey);
  if (!legacyRaw) return { migrated: false, removedLegacy: false };
  let migrated = false;
  if (!storage.getItem(ownerKey)) {
    try {
      const parsed = JSON.parse(legacyRaw) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        storage.setItem(ownerKey, JSON.stringify({ ...parsed, v: 2, originScope: OWNER_STORE_SCOPE }));
        migrated = true;
      }
    } catch {
      // A corrupt legacy payload is removed rather than copied into any scope.
    }
  }
  storage.removeItem(legacyKey);
  return { migrated, removedLegacy: true };
}

/**
 * Fallback SPA route for a transparent proxy that serves the public custom
 * host without applying the server rewrite.
 */
export function affiliateStorefrontFallbackPath(
  pathname: string,
  hostname: string | null | undefined,
  search = "",
): string | null {
	  const slug = affiliateSlugFromHostname(hostname);
	  if (!slug || isAffiliateStorefrontPath(pathname) || isAffiliateManagementPath(pathname)) return null;
  const suffix = pathname === "/" ? "" : pathname;
  return `/store/${slug}${suffix}${search}`;
}
