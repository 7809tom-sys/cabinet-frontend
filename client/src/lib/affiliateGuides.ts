/**
 * Affiliate sales-playbook guides.
 *
 * These four guides shipped with the original Marketing Hub as
 * `/affiliate/guide/<file>` pages. The route was dropped during the
 * admin-managed resources rebuild, which left older bookmarks and printed
 * links pointing at the platform 404. The markdown sources live in
 * `client/src/content/guides` so the public route can render them without a
 * backend call, and are loaded on demand to keep them out of the app entry
 * chunk.
 */

export const AFFILIATE_GUIDE_ROOT = "/affiliate/guide";

export type AffiliateGuide = {
  /** Stable file name; this is the URL segment older links already use. */
  slug: string;
  title: string;
  description: string;
};

export const AFFILIATE_GUIDES: readonly AffiliateGuide[] = [
  {
    slug: "10-steps-to-a-sale",
    title: "10 Steps to a Sale",
    description: "Your complete sales playbook from prospect to referral. Follow this system and increase sales by 35%.",
  },
  {
    slug: "kitchen-design-fundamentals",
    title: "Kitchen Design Fundamentals",
    description: "How to measure, standard sizes, work triangle, layouts, and the 10×10 reference kitchen.",
  },
  {
    slug: "how-to-use-your-crm",
    title: "How to Use Your CRM Effectively",
    description: "Turn your pipeline into predictable sales. The 5 stages, follow-up cadence, and weekly review.",
  },
  {
    slug: "marketing-scripts-and-templates",
    title: "Marketing Scripts & Templates",
    description: "Ready-to-use text, email, and social media templates. Copy, customize, and send.",
  },
];

const GUIDE_BODIES: Record<string, () => Promise<{ default: string }>> = {
  "10-steps-to-a-sale": () => import("@/content/guides/10-steps-to-a-sale.md?raw"),
  "kitchen-design-fundamentals": () => import("@/content/guides/kitchen-design-fundamentals.md?raw"),
  "how-to-use-your-crm": () => import("@/content/guides/how-to-use-your-crm.md?raw"),
  "marketing-scripts-and-templates": () => import("@/content/guides/marketing-scripts-and-templates.md?raw"),
};

/** Public address of one guide; safe to render in links and printed material. */
export function affiliateGuidePath(slug: string): string {
  return `${AFFILIATE_GUIDE_ROOT}/${encodeURIComponent(slug.trim().toLowerCase())}`;
}

export function affiliateGuideBySlug(slug: string | null | undefined): AffiliateGuide | null {
  const needle = (slug ?? "").trim().toLowerCase();
  if (!needle) return null;
  return AFFILIATE_GUIDES.find((guide) => guide.slug === needle) ?? null;
}

/** The playbook guides that match the Marketing Hub's resource search box. */
export function affiliateGuidesMatchingQuery(query: string): AffiliateGuide[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...AFFILIATE_GUIDES];
  return AFFILIATE_GUIDES.filter((guide) =>
    [guide.title, guide.description].some((value) => value.toLowerCase().includes(needle)),
  );
}

/** Resolves the markdown source for one guide, or null when the slug is unknown. */
export async function loadAffiliateGuideBody(slug: string | null | undefined): Promise<string | null> {
  const guide = affiliateGuideBySlug(slug);
  if (!guide) return null;
  const loader = GUIDE_BODIES[guide.slug];
  if (!loader) return null;
  const module = await loader();
  return module.default;
}
