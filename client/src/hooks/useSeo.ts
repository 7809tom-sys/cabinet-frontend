import { useEffect } from "react";

/**
 * Dependency-free SEO helper. While a component is mounted it sets:
 *   - document.title
 *   - <meta name="description">
 *   - Open Graph tags (og:title / og:description / og:type / og:url / og:image / og:site_name / og:locale)
 *   - Twitter Card tags (twitter:card / twitter:title / twitter:description / twitter:image)
 *   - <link rel="canonical">
 *   - <html lang>
 *   - <script type="application/ld+json"> structured data (rich snippets)
 * and restores the previous values on unmount. Keeps us SEO-friendly without
 * pulling in react-helmet.
 */

const SITE_NAME = "Cabinet Dealz";
const DEFAULT_IMAGE =
  "https://www.cabinetdealz.com/og-image.jpg";

export function formatSeoTitle(
  title: string,
  siteName = SITE_NAME,
  appendSiteName = true,
) {
  if (!title) return "";
  return !appendSiteName || title.includes(siteName)
    ? title
    : `${title} | ${siteName}`;
}

export interface SeoOptions {
  title: string;
  description?: string;
  /** Brand used for title and social metadata; defaults to the platform name. */
  siteName?: string;
  /** Set false for white-label pages whose title must not include a platform suffix. */
  appendSiteName?: boolean;
  /** Open Graph type, e.g. "website" (default) or "product". */
  type?: string;
  /** Absolute or path-relative image used for social previews. */
  image?: string;
  /** Current language for the <html lang> attribute. */
  lang?: "en" | "es" | "zh";
  /** Override canonical URL; defaults to the current location (no query/hash). */
  canonical?: string;
  /**
   * Structured data (schema.org) injected as a JSON-LD <script>. Pass a single
   * object or an array of objects; each is rendered as its own tag and removed
   * on unmount. Stringify-stable inputs only (memoize before passing).
   */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/** Find or create a <meta> by attribute (name or property) and set its content. */
function setMeta(
  attr: "name" | "property",
  key: string,
  content: string,
  created: HTMLElement[],
  prev: Map<string, string | null>,
) {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attr}="${key}"]`,
  );
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
    created.push(el);
  } else if (!prev.has(`${attr}:${key}`)) {
    prev.set(`${attr}:${key}`, el.getAttribute("content"));
  }
  el.setAttribute("content", content);
}

export function useSeo(
  titleOrOptions: string | SeoOptions,
  description?: string,
) {
  const opts: SeoOptions =
    typeof titleOrOptions === "string"
      ? { title: titleOrOptions, description }
      : titleOrOptions;

  const {
    title,
    description: desc,
    siteName = SITE_NAME,
    appendSiteName = true,
    type = "website",
    image = DEFAULT_IMAGE,
    lang,
    canonical,
    jsonLd,
  } = opts;

  // Serialize once so the effect dependency is a stable primitive string
  // (avoids re-running on every render when callers pass inline objects).
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const created: HTMLElement[] = [];
    const prev = new Map<string, string | null>();

    // Title
    const prevTitle = document.title;
    if (title) {
      document.title = formatSeoTitle(title, siteName, appendSiteName);
    }
    const finalTitle = document.title;

    // <html lang>
    const prevLang = document.documentElement.getAttribute("lang");
    if (lang) document.documentElement.setAttribute("lang", lang);

    // Description
    if (desc) {
      setMeta("name", "description", desc, created, prev);
    }

    // Open Graph
    setMeta("property", "og:title", finalTitle, created, prev);
    if (desc) setMeta("property", "og:description", desc, created, prev);
    setMeta("property", "og:type", type, created, prev);
    setMeta("property", "og:site_name", siteName, created, prev);
    setMeta("property", "og:image", image, created, prev);
    if (lang) {
      setMeta(
        "property",
        "og:locale",
        lang === "es" ? "es_ES" : lang === "zh" ? "zh_CN" : "en_US",
        created,
        prev,
      );
    }

    // Twitter
    setMeta("name", "twitter:card", "summary_large_image", created, prev);
    setMeta("name", "twitter:title", finalTitle, created, prev);
    if (desc) setMeta("name", "twitter:description", desc, created, prev);
    setMeta("name", "twitter:image", image, created, prev);

    // Canonical URL + og:url
    const url =
      canonical ||
      (typeof window !== "undefined"
        ? window.location.origin + window.location.pathname
        : "");
    let canonEl: HTMLLinkElement | null = null;
    let prevCanon: string | null = null;
    let createdCanon = false;
    if (url) {
      canonEl = document.head.querySelector('link[rel="canonical"]');
      if (!canonEl) {
        canonEl = document.createElement("link");
        canonEl.setAttribute("rel", "canonical");
        document.head.appendChild(canonEl);
        createdCanon = true;
      } else {
        prevCanon = canonEl.getAttribute("href");
      }
      canonEl.setAttribute("href", url);
      setMeta("property", "og:url", url, created, prev);
    }

    // JSON-LD structured data
    const ldScripts: HTMLScriptElement[] = [];
    if (jsonLdKey) {
      const parsed = JSON.parse(jsonLdKey) as
        | Record<string, unknown>
        | Record<string, unknown>[];
      const blocks = Array.isArray(parsed) ? parsed : [parsed];
      for (const block of blocks) {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-jsonld", "true");
        script.textContent = JSON.stringify(block);
        document.head.appendChild(script);
        ldScripts.push(script);
      }
    }

    return () => {
      document.title = prevTitle;
      if (prevLang !== null) {
        document.documentElement.setAttribute("lang", prevLang);
      }
      // Restore or remove meta tags we touched
      for (const el of created) el.remove();
      for (const [composite, value] of Array.from(prev.entries())) {
        const [attr, key] = composite.split(":") as [
          "name" | "property",
          string,
        ];
        const el = document.head.querySelector<HTMLMetaElement>(
          `meta[${attr}="${key}"]`,
        );
        if (el && value !== null) el.setAttribute("content", value);
      }
      if (canonEl) {
        if (createdCanon) canonEl.remove();
        else if (prevCanon !== null) canonEl.setAttribute("href", prevCanon);
      }
      for (const s of ldScripts) s.remove();
    };
  }, [title, desc, type, image, lang, canonical, jsonLdKey]);
}
