// ─────────────────────────────────────────────────────────────────────────────
// useStorefrontBranding — read-side application of an affiliate's white-label
// branding on the public /store/:slug catalog.
//
// Fetches the affiliate's brand-name overrides + markup config ONCE for a slug
// (storefront.brandingForSlug) and returns two pure display helpers:
//   • brandName(styleId, fallback) → the affiliate's white-label door-style name
//     (falls back to the central catalog name when none is set).
//   • applyMarkup(dollars, { styleId, category }) → the customer-facing price
//     after the affiliate's markup (style > category > global precedence).
//
// The platform homeowner price is the baseline; the affiliate's markup is their
// own margin layered on top. When the slug has no branding (or none configured),
// both helpers are identity functions so the catalog renders unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  resolveBrandName,
  resolveMarkupBps,
  type AffiliateMarkup,
} from "@shared/affiliateBranding";

/** Normalize a catalog category into the key used for per-category markup. */
function categoryKey(category: string | null | undefined): string | null {
  const c = (category ?? "").trim().toLowerCase();
  return c.length > 0 ? c : null;
}

export interface StorefrontBranding {
  /** True once the branding query has resolved (success or null). */
  ready: boolean;
  /** Resolve the affiliate's white-label name for a door style. */
  brandName: (styleId: number | null | undefined, fallback: string) => string;
  /**
   * Apply the affiliate's markup to a platform price (in dollars) and return the
   * customer-facing dollar amount. Non-finite / non-positive inputs pass through.
   */
  applyMarkup: (
    dollars: unknown,
    opts?: { styleId?: number | null; category?: string | null },
  ) => number;
}

export function useStorefrontBranding(slug: string | null | undefined): StorefrontBranding {
  const { data } = trpc.storefront.brandingForSlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug },
  );

  return useMemo(() => {
    const styleNames = data?.styleNames ?? {};
    const markup: AffiliateMarkup = {
      globalMarkupBps: data?.globalMarkupBps ?? 0,
      categoryMarkupBps: data?.categoryMarkupBps ?? {},
      styleMarkupBps: data?.styleMarkupBps ?? {},
    };

    return {
      ready: data !== undefined,
      brandName: (styleId, fallback) => {
        const override = styleId != null ? styleNames[styleId] : undefined;
        return resolveBrandName(fallback, override);
      },
      applyMarkup: (dollars, opts = {}) => {
        const n = Number(dollars);
        if (!Number.isFinite(n) || n <= 0) return n;
        const bps = resolveMarkupBps(markup, {
          categoryKey: categoryKey(opts.category),
          styleId: opts.styleId ?? null,
        });
        if (!bps) return n;
        // Dollars → cents → marked-up → dollars, rounding to whole cents.
        const cents = Math.round(n * 100);
        const marked = cents + Math.round((cents * bps) / 10000);
        return marked / 100;
      },
    };
  }, [data]);
}
