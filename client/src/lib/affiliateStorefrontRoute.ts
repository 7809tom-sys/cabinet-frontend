function currentAffiliateSlug(): string | null {
  if (typeof window === "undefined") return null;
  return window.location.pathname.match(/^\/store\/([^/]+)/)?.[1] ?? null;
}

export function affiliateCatalogRootHref(): string {
  const slug = currentAffiliateSlug();
  return slug ? `/store/${slug}` : "/catalog";
}

export function affiliateCabinetHref(masterCode: string, styleId?: number | null): string {
  const slug = currentAffiliateSlug();
  const base = slug ? `/store/${slug}/catalog/${encodeURIComponent(masterCode)}` : `/catalog/${encodeURIComponent(masterCode)}`;
  return styleId != null ? `${base}?style=${styleId}` : base;
}

export function affiliateDesignerHref(styleId?: number | null): string {
  const slug = currentAffiliateSlug();
  const params = new URLSearchParams();
  if (slug) params.set("affiliate", slug);
  if (styleId != null) params.set("style", String(styleId));
  const query = params.toString();
  return query ? `/design?${query}` : "/design";
}
