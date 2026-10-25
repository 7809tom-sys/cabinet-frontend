/**
 * Pure builders for schema.org structured data (JSON-LD).
 *
 * These produce plain objects that `useSeo({ jsonLd })` injects as
 * <script type="application/ld+json"> tags so Cabinet pages are
 * eligible for Google rich results (Product snippets).
 *
 * Design notes:
 * - Builders are framework-free and deterministic so they can be unit-tested.
 * - Undefined/empty fields are omitted entirely (Google prefers absent over
 *   empty/null values).
 * - Cabinet pricing is tier-gated and partly member-only, so the cabinet
 *   Product schema intentionally OMITS an Offer (we never expose trade prices
 *   in markup).
 */

const SITE_NAME = "Cabinet Dealz";
const BRAND = { "@type": "Brand", name: SITE_NAME } as const;

/** Drop keys whose value is undefined, null, or an empty string. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out as T;
}

export interface ProductJsonLdInput {
  name: string;
  description?: string;
  /** Stock keeping unit / master code, e.g. "B12". */
  sku?: string;
  /** Absolute image URL for the product. */
  image?: string;
  /** Canonical product URL. */
  url?: string;
  /** Top-level product category, e.g. "Base Cabinets". */
  category?: string;
}

/**
 * Product schema WITHOUT an offer — used for cabinets, whose price is
 * tier/member-gated and must not be published in markup.
 */
export function buildProductJsonLd(
  input: ProductJsonLdInput,
): Record<string, unknown> {
  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: input.description,
    sku: input.sku,
    mpn: input.sku,
    image: input.image,
    url: input.url,
    category: input.category,
    brand: BRAND,
  });
}

/** Public main-site organization and website schemas; never include gated pricing. */
export function buildMainSiteJsonLd(origin: string): Record<string, unknown>[] {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SITE_NAME,
      url: origin,
      logo: `${origin}/favicon.svg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: origin,
    },
  ];
}

/** White-label public storefront schema. It deliberately contains no platform brand. */
export function buildAffiliateStorefrontJsonLd(input: {
  storeName: string;
  url: string;
  tagline?: string | null;
  logoUrl?: string | null;
}): Record<string, unknown>[] {
  return [
    compact({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: input.storeName,
      url: input.url,
      description: input.tagline,
      logo: input.logoUrl,
    }),
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: input.storeName,
      url: input.url,
    },
  ];
}

/** Public whole-kitchen discovery schema. It contains no pricing or availability claims. */
export function buildKitchenDiscoveryJsonLd(input: {
  origin: string;
  path?: string;
  journeyBasePath?: string;
  name: string;
  description: string;
  faqs?: Array<{ question: string; answer: string }>;
}): Record<string, unknown> {
  const path = input.path || "/kitchens";
  const url = `${input.origin.replace(/\/$/, "")}${path}`;
  const journeyBasePath = input.journeyBasePath || "";
  const entries = [
    { name: "Explore complete kitchen styles", path: journeyBasePath ? `${path}#choose-a-direction` : "/styles" },
    { name: "Browse kitchen packages", path: journeyBasePath ? `${journeyBasePath}/bundles` : "/bundles" },
    { name: "Design a kitchen", path: journeyBasePath ? `${journeyBasePath}/design` : "/design" },
    { name: "Request a kitchen quote", path: journeyBasePath ? `${journeyBasePath}/order` : "/order/new" },
  ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: input.name,
        description: input.description,
        mainEntity: { "@id": `${url}#journey` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#journey`,
        name: "Complete kitchen planning journey",
        itemListElement: entries.map((entry, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: entry.name,
          url: `${input.origin.replace(/\/$/, "")}${entry.path}`,
        })),
      },
      ...(input.faqs?.length
        ? [{
            "@type": "FAQPage",
            "@id": `${url}#faq`,
            mainEntity: input.faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          }]
        : []),
    ],
  };
}

/** Public kitchen-package collection schema. Package cards are linked in-place and never publish cabinet pricing. */
export function buildKitchenPackageCollectionJsonLd(input: {
  origin: string;
  path: string;
  name: string;
  description: string;
  packages: Array<{
    name: string;
    description?: string | null;
    image?: string | null;
    path: string;
  }>;
}): Record<string, unknown> {
  const origin = input.origin.replace(/\/$/, "");
  const url = `${origin}${input.path}`;
  const schemaSafeDescription = (description: string | null | undefined): string | undefined => {
    if (!description || /(?:\$|\bprice\b|\bcost\b)/i.test(description)) return undefined;
    return description;
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: input.name,
        description: input.description,
        mainEntity: { "@id": `${url}#packages` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#packages`,
        name: "Complete kitchen packages",
        itemListElement: input.packages.map((pkg, index) => compact({
          "@type": "ListItem",
          position: index + 1,
          name: pkg.name,
          description: schemaSafeDescription(pkg.description),
          image: pkg.image,
          url: `${origin}${pkg.path}`,
        })),
      },
    ],
  };
}
