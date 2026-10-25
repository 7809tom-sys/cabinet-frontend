// Public-facing countertop material info for the /countertops gallery page.
// The `id` values MUST stay in sync with COUNTERTOP_MATERIALS in
// client/src/lib/design.ts so the swatch colors on the gallery match what the
// Design Tool renders. Pricing is intentionally NOT listed: countertops are
// fabricated/installed per project and quoted by a supplier.

export interface CountertopInfo {
  id: string;
  name: string;
  // Short marketing blurb shown under the swatch.
  blurb: string;
  // A couple of plain-language selling points.
  highlights: string[];
}

export const COUNTERTOP_INFO: CountertopInfo[] = [
  {
    id: "white-quartz",
    name: "White Quartz",
    blurb:
      "Engineered stone with a bright, uniform look. Non-porous and low-maintenance — the most popular choice for modern kitchens.",
    highlights: ["Non-porous, no sealing", "Highly scratch & stain resistant", "Consistent color and pattern"],
  },
  {
    id: "carrara-marble",
    name: "Carrara Marble",
    blurb:
      "Classic natural marble with soft gray veining. A timeless, high-end surface that develops character over time.",
    highlights: ["Natural stone, one-of-a-kind veining", "Cool surface, great for baking", "Periodic sealing recommended"],
  },
  {
    id: "black-granite",
    name: "Black Granite",
    blurb:
      "Dramatic natural granite with deep tones and subtle flecks. Extremely durable and heat resistant.",
    highlights: ["Heat & scratch resistant", "Natural stone depth", "Hides crumbs and water spots"],
  },
  {
    id: "butcher-block",
    name: "Butcher Block",
    blurb:
      "Warm solid-wood surface that adds a natural, hand-crafted feel. Ideal for islands and prep zones.",
    highlights: ["Warm, natural wood look", "Can be sanded & refinished", "Oil periodically to protect"],
  },
  {
    id: "concrete-gray",
    name: "Concrete Gray",
    blurb:
      "Industrial-modern look with a matte, stone-like finish. Customizable and seamless for contemporary spaces.",
    highlights: ["Modern matte finish", "Seamless custom pours", "Seal to resist staining"],
  },
  {
    id: "sand-quartz",
    name: "Sand Quartz",
    blurb:
      "Warm neutral engineered stone that pairs with almost any cabinet color. Durable and easy to live with.",
    highlights: ["Warm neutral tone", "Non-porous, low-maintenance", "Pairs with most door styles"],
  },
];

export function countertopInfo(id: string | null | undefined): CountertopInfo | undefined {
  return COUNTERTOP_INFO.find((m) => m.id === id);
}
