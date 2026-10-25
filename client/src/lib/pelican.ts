// Shared helpers for the customer-facing Pelican "Surfaces & Fixtures" storefront.
// Keep category <-> slug mapping and presentation in one place so the landing
// page, category page, and design-tool panel stay consistent.

export type PelicanCategory =
  | "Sinks & Faucets"
  | "Flooring"
  | "Shower & Bath"
  | "Toilets & Bidets"
  | "Tile & Mosaic"
  | "Quartz Slabs (Countertops)";

// Categories we surface to shoppers, in display order. Samples and Marketing
// are intentionally excluded from the storefront.
export const PELICAN_STOREFRONT_CATEGORIES: PelicanCategory[] = [
  "Quartz Slabs (Countertops)",
  "Flooring",
  "Tile & Mosaic",
  "Sinks & Faucets",
  "Shower & Bath",
  "Toilets & Bidets",
];

const SLUGS: Record<string, string> = {
  "Sinks & Faucets": "sinks-faucets",
  Flooring: "flooring",
  "Shower & Bath": "shower-bath",
  "Toilets & Bidets": "toilets-bidets",
  "Tile & Mosaic": "tile-mosaic",
  "Quartz Slabs (Countertops)": "quartz",
};

const SLUG_TO_CATEGORY: Record<string, PelicanCategory> = Object.fromEntries(
  Object.entries(SLUGS).map(([cat, slug]) => [slug, cat as PelicanCategory])
) as Record<string, PelicanCategory>;

export function categorySlug(category: string): string {
  return SLUGS[category] ?? category.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function categoryFromSlug(slug: string): PelicanCategory | null {
  return SLUG_TO_CATEGORY[slug] ?? null;
}

// Short marketing blurb per category for the landing hero + cards.
export const CATEGORY_BLURB: Record<string, string> = {
  "Quartz Slabs (Countertops)":
    "Durable, low-maintenance quartz surfaces for countertops and vanities.",
  Flooring: "Waterproof LVP, tile-look, and hardwood-alternative flooring.",
  "Tile & Mosaic": "Backsplash, floor, and accent tile in porcelain, ceramic, and mosaic.",
  "Sinks & Faucets": "Kitchen and bath sinks, faucets, and finishing hardware.",
  "Shower & Bath": "Shower systems, tubs, glass, and bath fixtures.",
  "Toilets & Bidets": "Modern toilets, smart bidets, and water-efficient fixtures.",
};

// A gradient per category used as an image fallback so the grid never shows
// broken/empty tiles when a product has no photo yet.
export const CATEGORY_GRADIENT: Record<string, string> = {
  "Quartz Slabs (Countertops)": "linear-gradient(135deg,#e7e9ee 0%,#c8cdd8 100%)",
  Flooring: "linear-gradient(135deg,#d9c3a5 0%,#b08d63 100%)",
  "Tile & Mosaic": "linear-gradient(135deg,#bcd6d6 0%,#7fa8a8 100%)",
  "Sinks & Faucets": "linear-gradient(135deg,#d5d8dc 0%,#9aa1ab 100%)",
  "Shower & Bath": "linear-gradient(135deg,#cfe0ea 0%,#8fb2c6 100%)",
  "Toilets & Bidets": "linear-gradient(135deg,#e2e6ea 0%,#aab3bd 100%)",
};

export function formatPrice(n: number | null | undefined): string {
  if (n == null) return "Call for pricing";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * The Pelican import categories remain authoritative for inventory and pricing.
 * These labels are a shopper-facing presentation layer only; they never replace
 * a source category in product data, queries, carts, quotes, or orders.
 */
export const PELICAN_CATEGORY_LABEL: Record<string, string> = {
  "Quartz Slabs (Countertops)": "Quartz Countertops",
  Flooring: "Flooring",
  "Tile & Mosaic": "Tile & Mosaic",
  "Sinks & Faucets": "Sinks & Faucets",
  "Shower & Bath": "Shower & Bath",
  "Toilets & Bidets": "Toilets & Bidets",
};

export function pelicanCategoryLabel(category: string): string {
  return PELICAN_CATEGORY_LABEL[category] ?? category;
}

export type PelicanDepartmentSlug =
  | "kitchen-surfaces"
  | "kitchen-fixtures"
  | "bathroom-fixtures"
  | "bath-surfaces-enclosures";

export type PelicanProductFamily = {
  title: string;
  description: string;
  category: PelicanCategory;
  subCategory?: string;
};

export type PelicanDepartment = {
  slug: PelicanDepartmentSlug;
  title: string;
  description: string;
  families: PelicanProductFamily[];
};

/**
 * Original CabinetDealz browse structure informed by Pelican's public site.
 * Product families link to the existing raw-category API plus an optional raw
 * subcategory filter, keeping imported category values fully intact.
 */
export const PELICAN_DEPARTMENTS: PelicanDepartment[] = [
  {
    slug: "kitchen-surfaces",
    title: "Kitchen Surfaces",
    description: "Countertops, backsplash tile, flooring, and finishing pieces for a kitchen project.",
    families: [
      {
        title: "Quartz Countertops",
        description: "Browse quartz countertop slabs by finish, size, and thickness.",
        category: "Quartz Slabs (Countertops)",
      },
      {
        title: "Backsplash & Wall Tile",
        description: "Explore mosaic and tile options for kitchen walls and accents.",
        category: "Tile & Mosaic",
      },
      {
        title: "Flooring",
        description: "Shop flooring products for the room under your kitchen project.",
        category: "Flooring",
        subCategory: "Planks & Flooring",
      },
      {
        title: "Flooring Trim & Transitions",
        description: "Find matching trim pieces and transitions for a finished floor edge.",
        category: "Flooring",
        subCategory: "Moldings & Trim",
      },
    ],
  },
  {
    slug: "kitchen-fixtures",
    title: "Kitchen Fixtures",
    description: "Shop sinks, faucets, disposals, and cooking surfaces for the kitchen.",
    families: [
      {
        title: "Sinks",
        description: "Browse the available sink collection by type, size, and installation details.",
        category: "Sinks & Faucets",
        subCategory: "Sinks",
      },
      {
        title: "Faucets",
        description: "Browse faucets and compare finish, fit, and configuration details.",
        category: "Sinks & Faucets",
        subCategory: "Faucets",
      },
      {
        title: "Disposals & Sink Accessories",
        description: "Find disposals and practical accessories for a complete sink setup.",
        category: "Sinks & Faucets",
        subCategory: "Disposals & Accessories",
      },
    ],
  },
  {
    slug: "bathroom-fixtures",
    title: "Bathroom Fixtures",
    description: "Find sinks, faucets, toilets, bidets, and bathing fixtures for a bathroom project.",
    families: [
      {
        title: "Sinks",
        description: "Browse the sink collection by type, dimensions, and installation details.",
        category: "Sinks & Faucets",
        subCategory: "Sinks",
      },
      {
        title: "Faucets",
        description: "Browse faucet options and compare configurations and finishes.",
        category: "Sinks & Faucets",
        subCategory: "Faucets",
      },
      {
        title: "Toilets & Bidets",
        description: "Explore toilet and bidet fixture options for a bathroom build.",
        category: "Toilets & Bidets",
      },
    ],
  },
  {
    slug: "bath-surfaces-enclosures",
    title: "Bath Surfaces & Enclosures",
    description: "Build a coordinated shower and bath with tile, surrounds, doors, systems, and accessories.",
    families: [
      {
        title: "Mosaic & Tile",
        description: "Browse tile and mosaics for bath walls, floors, and accents.",
        category: "Tile & Mosaic",
      },
      {
        title: "Shower & Tub Doors",
        description: "Explore glass-door and enclosure options for a shower or tub.",
        category: "Shower & Bath",
        subCategory: "Shower & Tub Doors",
      },
      {
        title: "Shower Surrounds",
        description: "Shop surround options for the shower enclosure.",
        category: "Shower & Bath",
        subCategory: "Shower Surrounds",
      },
      {
        title: "Shower Systems & Accessories",
        description: "Find shower systems, valves, and finishing accessories.",
        category: "Shower & Bath",
        subCategory: "Shower Valves & Systems",
      },
    ],
  },
];

export function pelicanDepartmentFromSlug(slug: string): PelicanDepartment | null {
  return PELICAN_DEPARTMENTS.find((department) => department.slug === slug) ?? null;
}

export function pelicanFamilyHref(family: Pick<PelicanProductFamily, "category" | "subCategory">): string {
  const base = `/surfaces/${categorySlug(family.category)}`;
  return family.subCategory ? `${base}?family=${encodeURIComponent(family.subCategory)}` : base;
}

export type PelicanProductPresentationInput = {
  name?: string | null;
  category?: string | null;
  subCategory?: string | null;
};

/**
 * Returns a concise shopper-facing product type from the authoritative imported
 * category fields. It deliberately does not modify the original source name or
 * Pelican item code used for ordering.
 */
export function pelicanProductType(input: PelicanProductPresentationInput): string {
  const category = input.category?.trim() ?? "";
  const subCategory = input.subCategory?.trim() ?? "";

  switch (category) {
    case "Quartz Slabs (Countertops)":
      return "Quartz Countertop Slab";
    case "Flooring":
      if (subCategory === "Moldings & Trim") return "Flooring Trim";
      if (subCategory === "Underlayment") return "Flooring Underlayment";
      return "Flooring";
    case "Tile & Mosaic":
      return subCategory === "Mosaic" ? "Mosaic Tile" : "Wall & Floor Tile";
    case "Sinks & Faucets":
      if (subCategory === "Sinks") return "Sink";
      if (subCategory === "Faucets") return "Faucet";
      if (subCategory === "Disposals & Accessories") return "Disposal & Sink Accessory";
      if (subCategory === "Sink & Faucet Accessories") return "Sink & Faucet Accessory";
      return "Kitchen & Bath Fixture";
    case "Shower & Bath":
      if (subCategory === "Shower & Tub Doors") return "Shower or Tub Door";
      if (subCategory === "Shower Surrounds") return "Shower Surround";
      if (subCategory === "Shower Valves & Systems") return "Shower Valve & System";
      if (subCategory === "Shower Accessories") return "Shower Accessory";
      return "Shower & Bath Fixture";
    case "Toilets & Bidets":
      return "Toilet & Bidet Fixture";
    default:
      return subCategory || category || "Pelican Product";
  }
}

function sourceNameAlreadyStatesType(sourceName: string, productType: string): boolean {
  const source = sourceName.toLowerCase();
  const cues = productType.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  return cues.some((cue) => source.includes(cue));
}

function sourceNameLooksLikeCode(sourceName: string): boolean {
  // Product names such as “Calacatta Oro” should stay concise. This deliberately
  // accepts compact, all-capital catalog identifiers such as “PR42” or “PL-3082”.
  return /^[A-Z]{1,5}(?:[- ]?[A-Z0-9]{1,8}){1,3}$/.test(sourceName.trim());
}

/**
 * Adds a plain-language product type only to ambiguous imported source names
 * such as short codes. Descriptive source names stay concise, while callers
 * still show the product type and authoritative source name/code separately.
 */
export function pelicanDisplayName(input: PelicanProductPresentationInput): string {
  const sourceName = input.name?.trim() ?? "";
  const productType = pelicanProductType(input);
  if (!sourceName) return productType;
  if (sourceNameAlreadyStatesType(sourceName, productType)) return sourceName;
  return sourceNameLooksLikeCode(sourceName) ? `${sourceName} — ${productType}` : sourceName;
}

export type PelicanDesignerPaletteInput = {
  pelicanCode?: string | null;
  category?: string | null;
  showInDesigner?: boolean | null;
  sellPrice?: number | null;
};

/**
 * This is deliberately a palette-availability check, not an “exact 3D model”
 * claim. When it returns true, the product meets the same category, visibility,
 * and pricing prerequisites used by the current Designer surfaces picker.
 */
export function isPelicanDesignerPaletteAvailable(input: PelicanDesignerPaletteInput): boolean {
  const category = input.category ?? "";
  // Pelican's PL-3099 is a bathroom vanity sink despite one legacy imported
  // display name describing it as a farmhouse model. It remains orderable in the
  // public catalog but cannot appear as a kitchen Designer option.
  if (/^PL-3099(?:\s|$)/i.test(input.pelicanCode?.trim() ?? "")) return false;
  return Boolean(input.showInDesigner)
    && PELICAN_STOREFRONT_CATEGORIES.includes(category as PelicanCategory)
    && typeof input.sellPrice === "number"
    && Number.isFinite(input.sellPrice)
    && input.sellPrice > 0;
}

export type PelicanPricePresentationInput = {
  sellPrice?: number | null;
  msrp?: number | string | null;
  isAdmin: boolean;
};

/**
 * Public product pages must present the configured sell price only. Source cost
 * and comparison data are internal information; an administrator can still see
 * a clearly labeled source reference without exposing it to shoppers.
 */
export function pelicanPricePresentation(input: PelicanPricePresentationInput): {
  referencePrice: number | null;
  savingsPercent: number | null;
} {
  if (!input.isAdmin || input.sellPrice == null || input.sellPrice <= 0) {
    return { referencePrice: null, savingsPercent: null };
  }
  const candidate = input.msrp == null ? null : Number(input.msrp);
  if (candidate == null || !Number.isFinite(candidate) || candidate <= input.sellPrice) {
    return { referencePrice: null, savingsPercent: null };
  }
  return {
    referencePrice: candidate,
    savingsPercent: Math.round(((candidate - input.sellPrice) / candidate) * 100),
  };
}

// ─── Surface roles ────────────────────────────────────────────────────────────
// Maps a chosen Surfaces & Fixtures product to the functional role it plays in a
// kitchen design. This is the SINGLE source of truth for "what does this product
// count as" — used by the 3D View readiness gate and the shopping-list role
// assignment. It keys off the real Pelican storefront category (and subCategory
// for the combined "Sinks & Faucets" line) instead of fragile text heuristics.
export type SurfaceRole = "flooring" | "countertop" | "backsplash" | "sink" | "faucet" | "other";

export function surfaceRole(input: {
  category?: string | null;
  subCategory?: string | null;
  name?: string | null;
}): SurfaceRole {
  const cat = (input.category || "").trim();
  const sub = (input.subCategory || "").trim().toLowerCase();
  const name = (input.name || "").toLowerCase();

  switch (cat) {
    case "Flooring":
      // The Flooring catalog also carries end caps, stair noses, reducers,
      // baseboard, and other trims. Only the source's actual plank/flooring
      // line can be an installed room floor. Keep an absent legacy
      // sub-category compatible with older saved picks; new source rows with
      // an explicit non-floor sub-category are never promoted to a floor.
      return !sub || sub === "planks & flooring" ? "flooring" : "other";
    case "Quartz Slabs (Countertops)":
      return "countertop";
    case "Tile & Mosaic":
      return "backsplash";
    case "Sinks & Faucets": {
      // Split the combined line into sink vs faucet. Accessories and disposals
      // are neither — check those FIRST because their subCategory label
      // ("Sink & Faucet Accessories") contains both words. Then prefer the
      // subCategory, falling back to the product name.
      if (sub.includes("accessor") || sub.includes("disposal")) return "other";
      if (sub.includes("faucet")) return "faucet";
      if (sub.includes("sink")) return "sink";
      if (/faucet|tap|filler/.test(name)) return "faucet";
      if (/\bsink\b/.test(name)) return "sink";
      return "other";
    }
    default:
      return "other";
  }
}
