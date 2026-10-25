import { useEffect } from "react";

/**
 * White-label the browser tab for an affiliate storefront.
 *
 * The base index.html ships the platform title ("Cabinet Dealz — Professional
 * Cabinet Platform") and the platform favicon. On an affiliate storefront that
 * is a branding leak: the affiliate's customers see the platform name in the
 * tab, in bookmarks, and in shared links. This hook swaps the document title,
 * favicon, and social meta tags to the affiliate's own branding, and restores
 * the originals on unmount so navigating back to the platform is unaffected.
 */
export function useWhiteLabelHead(opts: {
  storeName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  /** Preserve route-specific metadata owned by useSeo while retaining affiliate icon branding. */
  preserveRouteMetadata?: boolean;
}) {
  const { storeName, tagline, logoUrl, preserveRouteMetadata = false } = opts;

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

    // Swap the favicon + social image to the affiliate's logo when they have one.
    if (logoUrl) {
      document
        .querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
        .forEach((link) => {
          const prevHref = link.href;
          const prevType = link.type;
          link.href = logoUrl;
          link.type = "";
          restores.push(() => {
            link.href = prevHref;
            link.type = prevType;
          });
        });
      if (!preserveRouteMetadata) {
        setMeta('meta[property="og:image"]', logoUrl);
        setMeta('meta[name="twitter:image"]', logoUrl);
      }
    }

    return () => {
      // Run in reverse so nested changes unwind cleanly.
      for (let i = restores.length - 1; i >= 0; i--) restores[i]();
    };
  }, [storeName, tagline, logoUrl, preserveRouteMetadata]);
}
