/**
 * Paths and query helpers shared by the main catalog and affiliate storefront.
 * Affiliate pages must stay under /store/:slug so branding, markup, and links
 * do not fall through to the platform catalog.
 */

export function affiliateStylesPath(slug?: string | null): string {
  return slug ? `/store/${slug}/styles` : "/styles";
}

export function affiliateFamilyPath(slug: string | null | undefined, styleCode: string): string {
  const code = encodeURIComponent(styleCode);
  return slug ? `/store/${slug}/family/${code}` : `/family/${code}`;
}

export function affiliateCatalogIndexPath(slug?: string | null): string {
  return slug ? `/store/${slug}/catalog` : "/catalog";
}

export function affiliateDesignPath(slug: string | null | undefined, styleId?: number | null): string {
  if (!slug) return styleId ? `/design?style=${styleId}` : "/design";
  const params = new URLSearchParams();
  if (styleId) params.set("style", String(styleId));
  const qs = params.toString();
  return `/store/${slug}/design${qs ? `?${qs}` : ""}`;
}

export function affiliateQuotePath(slug: string | null | undefined, styleId?: number | null): string {
  if (!slug) return styleId ? `/order/new?style=${styleId}` : "/order/new";
  const params = new URLSearchParams();
  if (styleId) params.set("style", String(styleId));
  const qs = params.toString();
  return `/store/${slug}/order${qs ? `?${qs}` : ""}`;
}

function searchParams(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

/** The door-style id pinned in the catalog query, or null when the shopper is browsing all lines. */
export function styleIdFromSearch(search: string): number | null {
  const raw = searchParams(search).get("style");
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Rewrite the catalog query so the selected line is the URL, not a one-time
 * piece of component state. Passing null removes the pin.
 */
export function catalogSearchWithStyle(search: string, styleId: number | null): string {
  const params = searchParams(search);
  if (styleId && Number.isInteger(styleId) && styleId > 0) params.set("style", String(styleId));
  else params.delete("style");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function catalogSearchWithoutBrowse(search: string): string {
  const params = searchParams(search);
  params.delete("style");
  params.delete("category");
  params.delete("q");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export type AffiliateFamilyOverlay = {
  styleId: number;
  name: string;
  styleCode?: string | null;
  roomSceneImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
};

export function overlayAffiliateStyle<T extends {
  id: number;
  aliasName?: string | null;
  ourName?: string | null;
  featuredLabel?: string | null;
  roomSceneImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
}>(style: T, family: AffiliateFamilyOverlay | undefined): T {
  if (!family) return style;
  // The public name and room scene come from the affiliate family record.
  // Cast back to T so callers whose style rows omit optional photo fields
  // still type-check; the extra fields are ignored by those callers.
  return {
    ...style,
    aliasName: family.name || style.aliasName,
    ourName: family.name || style.ourName,
    featuredLabel: family.name || style.featuredLabel,
    roomSceneImageUrl: family.roomSceneImageUrl || style.roomSceneImageUrl || null,
    doorSampleImageUrl: family.doorSampleImageUrl || style.doorSampleImageUrl,
  } as T;
}
