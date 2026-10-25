export const AFFILIATE_STOREFRONT_TEMPLATE_IDS = [
  "classic",
  "showcase",
  "minimal",
  "craftsman",
  "coastal",
  "gallery",
  "studio",
  "heritage",
] as const;

export type AffiliateStorefrontTemplate = (typeof AFFILIATE_STOREFRONT_TEMPLATE_IDS)[number];

export type AffiliateStorefrontTemplateDefinition = {
  id: AffiliateStorefrontTemplate;
  name: string;
  desc: string;
  badge: string;
};

/**
 * The approved storefront layouts available to every affiliate. Each layout
 * shares the same catalog, pricing, cart, CRM, referral, and white-label data;
 * only its presentation changes.
 */
export const AFFILIATE_STOREFRONT_TEMPLATES: readonly AffiliateStorefrontTemplateDefinition[] = [
  {
    id: "classic",
    name: "Classic",
    desc: "Navy split hero with a lifestyle photo and serif headline.",
    badge: "Timeless",
  },
  {
    id: "showcase",
    name: "Showcase",
    desc: "Full-bleed kitchen photo with overlaid headline and calls to action.",
    badge: "Bold",
  },
  {
    id: "minimal",
    name: "Minimal",
    desc: "Light, airy layout with thin rules and generous whitespace.",
    badge: "Clean",
  },
  {
    id: "craftsman",
    name: "Craftsman",
    desc: "Warm, bold type on an accent block — no photo required.",
    badge: "Warm",
  },
  {
    id: "coastal",
    name: "Coastal",
    desc: "Sunlit split layout with a calm, welcoming editorial feel.",
    badge: "Bright",
  },
  {
    id: "gallery",
    name: "Gallery",
    desc: "Dark, architectural feature wall made for premium project imagery.",
    badge: "Premium",
  },
  {
    id: "studio",
    name: "Studio",
    desc: "Contemporary color-blocked layout for design-forward showrooms.",
    badge: "Modern",
  },
  {
    id: "heritage",
    name: "Heritage",
    desc: "Traditional framed layout with refined details and a grounded tone.",
    badge: "Refined",
  },
] as const;

export function isAffiliateStorefrontTemplate(value: string | null | undefined): value is AffiliateStorefrontTemplate {
  return AFFILIATE_STOREFRONT_TEMPLATE_IDS.includes(value as AffiliateStorefrontTemplate);
}
