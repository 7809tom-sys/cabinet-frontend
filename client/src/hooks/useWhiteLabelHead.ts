import { useEffect } from "react";

/** Same paths the backend serves in server/lib/affiliateHomeScreen.ts. */
export function affiliateManifestHref(slug: string): string {
  return `/store/${encodeURIComponent(slug)}/manifest.webmanifest`;
}

export function affiliateTouchIconHref(slug: string): string {
  return `/store/${encodeURIComponent(slug)}/app-icon-180.png`;
}

/** Real storefront routes only; /store-preview templates have no store to install. */
export function storefrontSlugFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/store\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]) || null;
  } catch {
    return match[1] || null;
  }
}

function isSvgIcon(url: string): boolean {
  return /^data:image\/svg/i.test(url) || /\.svg(?:[?#]|$)/i.test(url);
}

/**
 * White-label the browser tab for an affiliate storefront.
 *
 * The base index.html ships the platform title ("CabinetDealz — Professional
 * Cabinet Platform") and the platform favicon. On an affiliate storefront that
 * is a branding leak: the affiliate's customers see the platform name in the
 * tab, in bookmarks, and in shared links. This hook swaps the document title,
 * favicon, and social meta tags to the affiliate's own branding, and restores
 * the originals on unmount so navigating back to the platform is unaffected.
 *
 * On a /store/:slug route it also points "Add to Home Screen" at that store:
 * the store's own web manifest, a PNG touch icon (iOS ignores SVG), and the
 * iOS home-screen title. The platform's static /manifest.json is restored on
 * unmount, so the main CabinetDealz site keeps installing as CabinetDealz.
 */
export function useWhiteLabelHead(opts: {
  storeName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  /** Storefront slug; defaults to the /store/:slug segment of the current URL. */
  slug?: string | null;
  /** Preserve route-specific metadata owned by useSeo while retaining affiliate icon branding. */
  preserveRouteMetadata?: boolean;
}) {
  const { storeName, tagline, logoUrl, faviconUrl, preserveRouteMetadata = false } = opts;
  const slug = opts.slug
    ?? (typeof window !== "undefined" ? storefrontSlugFromPathname(window.location.pathname) : null);

  useEffect(() => {
    if (!storeName) return;

    const title = tagline ? `${storeName} — ${tagline}` : storeName;
    const prevTitle = document.title;
    if (!preserveRouteMetadata) document.title = title;

    // Track what we changed so we can restore it precisely.
    const restores: Array<() => void> = [
      () => {
        document.title = prevTitle;
      },
    ];

    const setMeta = (selector: string, value: string) => {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) return;
      const prev = el.content;
      el.content = value;
      restores.push(() => {
        el.content = prev;
      });
    };

    if (!preserveRouteMetadata) {
      setMeta('meta[property="og:title"]', title);
      setMeta('meta[name="twitter:title"]', title);
    }
    setMeta('meta[property="og:site_name"]', storeName);
    if (tagline && !preserveRouteMetadata) {
      setMeta('meta[name="description"]', tagline);
      setMeta('meta[property="og:description"]', tagline);
      setMeta('meta[name="twitter:description"]', tagline);
    }

    const setLink = (relation: string, href: string, sizes?: string) => {
      const existing = document.querySelector<HTMLLinkElement>(`link[rel="${relation}"]`);
      if (!existing) {
        const link = document.createElement("link");
        link.rel = relation;
        link.href = href;
        if (sizes) link.setAttribute("sizes", sizes);
        document.head.appendChild(link);
        restores.push(() => link.remove());
        return;
      }
      const prevHref = existing.getAttribute("href");
      const prevType = existing.getAttribute("type");
      const prevSizes = existing.getAttribute("sizes");
      existing.href = href;
      existing.removeAttribute("type");
      if (sizes) existing.setAttribute("sizes", sizes);
      restores.push(() => {
        if (prevHref == null) existing.removeAttribute("href");
        else existing.setAttribute("href", prevHref);
        if (prevType == null) existing.removeAttribute("type");
        else existing.setAttribute("type", prevType);
        if (prevSizes == null) existing.removeAttribute("sizes");
        else existing.setAttribute("sizes", prevSizes);
      });
    };

    const setNamedMeta = (name: string, value: string) => {
      const existing = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
      if (existing) {
        setMeta(`meta[name="${name}"]`, value);
        return;
      }
      const meta = document.createElement("meta");
      meta.name = name;
      meta.content = value;
      document.head.appendChild(meta);
      restores.push(() => meta.remove());
    };

    // Home-screen install names and icons the store, never the platform.
    setNamedMeta("apple-mobile-web-app-title", storeName.trim().replace(/[.]+$/, "") || storeName);
    if (slug) {
      setLink("manifest", affiliateManifestHref(slug));
      setLink("apple-touch-icon", affiliateTouchIconHref(slug), "180x180");
    }

    // Swap the favicon + social image to the affiliate's logo when they have one.
    const iconUrl = faviconUrl || logoUrl;
    if (iconUrl) {
      setLink("icon", iconUrl);
      if (!slug && !isSvgIcon(iconUrl)) setLink("apple-touch-icon", iconUrl);
      if (logoUrl && !preserveRouteMetadata) {
        setMeta('meta[property="og:image"]', logoUrl);
        setMeta('meta[name="twitter:image"]', logoUrl);
      }
    }

    return () => {
      // Run in reverse so nested changes unwind cleanly.
      for (let i = restores.length - 1; i >= 0; i--) restores[i]();
    };
  }, [storeName, tagline, logoUrl, faviconUrl, preserveRouteMetadata, slug]);
}
