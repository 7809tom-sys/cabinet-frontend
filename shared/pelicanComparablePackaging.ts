export type PelicanPackagingEvidenceType = "supplier_verified" | "comparable_estimate";

export type PelicanComparablePackagingProduct = {
  id: number;
  category: string;
  subCategory: string | null;
  name: string;
  pelicanCode: string;
};

export type PelicanComparablePackagingRule = {
  id: string;
  category: string;
  subCategory?: string;
  /** Applied only after the category/subcategory test; use for exceptions such as sink accessories. */
  namePattern?: RegExp;
  transportMode: "parcel" | "ltl";
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLbs: number;
  /** Left null when the comparable evidence does not establish an exact freight class. */
  freightClass: string | null;
  sourceUrl: string;
  sourceReference: string;
};

/**
 * First-party Pelican pickup page identifies this as the warehouse location.
 * It supports the ship-from ZIP only; it does not prove carton dimensions,
 * packaged weight, freight class, or carrier terms.
 */
export const PELICAN_COMPARISON_ORIGIN = {
  name: "Pelican Int'l Clearwater warehouse",
  zip: "33760",
  sourceUrl: "https://buildpelican.com/pages/pick-up-order-process",
  sourceReference: "Pelican official pickup page: 13238 62nd St N, Clearwater, FL 33760. Origin only; carton facts come from the cited comparable source.",
} as const;

/**
 * Conservative, category-specific comparison rules. They are explicitly not
 * Pelican carton data. Each uses a directly linked comparable package record
 * researched on 2026-10-10. A product not matched by a rule remains manual
 * quote until an operator records a supplier-verified profile.
 */
export const PELICAN_COMPARABLE_PACKAGING_RULES: readonly PelicanComparablePackagingRule[] = [
  {
    id: "bathroom-undermount-sink-v1",
    category: "Sinks & Faucets",
    subCategory: "Sinks",
    transportMode: "parcel",
    lengthIn: 22,
    widthIn: 15,
    heightIn: 9,
    weightLbs: 25,
    freightClass: null,
    sourceUrl: "https://www.kraususa.com/kraus-kcu-272-oval-undermount-19-ceramic-bathroom-sink-in-white.html",
    sourceReference: "Comparable ceramic undermount sink package: 9 × 22 × 15 in, 25 lb (retailer Q&A). Comparison estimate only; not Pelican carton data.",
  },
  {
    id: "faucet-or-shower-valve-v1",
    category: "Sinks & Faucets",
    subCategory: "Faucets",
    transportMode: "parcel",
    lengthIn: 24,
    widthIn: 13,
    heightIn: 4,
    weightLbs: 6,
    freightClass: null,
    sourceUrl: "https://images.thdstatic.com/catalog/pdfImages/b7/b7a40107f93340de82e679a72dd80f60.pdf",
    sourceReference: "Comparable faucet package: 24 × 10 × 2.8 in, 4.2 lb. Conservative 24 × 13 × 4 in / 6 lb comparison estimate; not Pelican carton data.",
  },
  {
    id: "shower-valve-or-accessory-v1",
    category: "Shower & Bath",
    subCategory: "Shower Valves & Systems",
    transportMode: "parcel",
    lengthIn: 24,
    widthIn: 13,
    heightIn: 4,
    weightLbs: 6,
    freightClass: null,
    sourceUrl: "https://images.thdstatic.com/catalog/pdfImages/b7/b7a40107f93340de82e679a72dd80f60.pdf",
    sourceReference: "Comparable faucet/valve package: 24 × 10 × 2.8 in, 4.2 lb. Conservative comparison estimate; not Pelican carton data.",
  },
  {
    id: "sink-accessory-v1",
    category: "Sinks & Faucets",
    subCategory: "Sink & Faucet Accessories",
    transportMode: "parcel",
    lengthIn: 24,
    widthIn: 13,
    heightIn: 4,
    weightLbs: 10,
    freightClass: null,
    sourceUrl: "https://www.kraususa.com/kraus-kbf-1411mb-single-handle-basin-faucet-with-pop-up.html",
    sourceReference: "Comparable boxed faucet/accessory package. Conservative 24 × 13 × 4 in / 10 lb comparison estimate; not Pelican carton data.",
  },
  {
    id: "sink-disposal-accessory-v1",
    category: "Sinks & Faucets",
    subCategory: "Disposals & Accessories",
    transportMode: "parcel",
    lengthIn: 18,
    widthIn: 12,
    heightIn: 12,
    weightLbs: 20,
    freightClass: null,
    sourceUrl: "https://www.insinkerator.emerson.com/en-us/shop/insinkerator/insinkerator-badger-5",
    sourceReference: "Comparable disposer carton. Conservative 18 × 12 × 12 in / 20 lb comparison estimate; not Pelican carton data.",
  },
  {
    id: "shower-accessory-v1",
    category: "Shower & Bath",
    subCategory: "Shower Accessories",
    transportMode: "parcel",
    lengthIn: 24,
    widthIn: 13,
    heightIn: 4,
    weightLbs: 6,
    freightClass: null,
    sourceUrl: "https://images.thdstatic.com/catalog/pdfImages/b7/b7a40107f93340de82e679a72dd80f60.pdf",
    sourceReference: "Comparable faucet/accessory package: 24 × 10 × 2.8 in, 4.2 lb. Conservative comparison estimate; not Pelican carton data.",
  },
  {
    id: "shower-door-v1",
    category: "Shower & Bath",
    subCategory: "Shower & Tub Doors",
    transportMode: "ltl",
    lengthIn: 74,
    widthIn: 36,
    heightIn: 4,
    weightLbs: 150,
    freightClass: null,
    sourceUrl: "https://www.homedepot.com/p/questions/WELLFOR-60-in-W-x-76-in-H-Soft-Closing-Sliding-Frameless-Shower-Door-with-5-16-in-Clear-Tempered-Glass-in-Brushed-Gold-DK-7M-6076MB/322413752/1",
    sourceReference: "Comparable shower-door package: 36 × 4 × 82 in, 149 lb. Conservative LTL comparison estimate: 74 × 36 × 4 in / 150 lb; not Pelican carton data.",
  },
  {
    id: "flooring-plank-v1",
    category: "Flooring",
    subCategory: "Planks & Flooring",
    transportMode: "parcel",
    lengthIn: 76,
    widthIn: 8,
    heightIn: 5,
    weightLbs: 55,
    freightClass: null,
    sourceUrl: "https://andersonfloors.ca/Engineered-Hardwood/grandeur-flooring/grandeur-prestige-rosedale",
    sourceReference: "Comparable engineered-flooring carton: 76 × 8 × 4.5 in, 55 lb. Comparison estimate only; multi-carton/pallet orders require carrier screening.",
  },
  {
    id: "shower-surround-v1",
    category: "Shower & Bath",
    subCategory: "Shower Surrounds",
    transportMode: "ltl",
    lengthIn: 72,
    widthIn: 42,
    heightIn: 8,
    weightLbs: 120,
    freightClass: null,
    sourceUrl: "https://www.homedepot.com/p/Aquatic-Everyday-60-in-x-32-in-x-60-in-3-Piece-Direct-to-Stud-Shower-Wall-Surround-in-White-2603BW/203378860",
    sourceReference: "Comparable three-piece shower-wall kit. Conservative LTL comparison estimate; not Pelican package data.",
  },
  {
    id: "sample-chip-v1",
    category: "Samples",
    subCategory: "Sample Chips",
    transportMode: "parcel",
    lengthIn: 22,
    widthIn: 15,
    heightIn: 11,
    weightLbs: 15,
    freightClass: null,
    sourceUrl: "https://www.bhphotovideo.com/c/product/1648319-REG/porta_brace_pb_c70dk_hard_case_with_padded.html",
    sourceReference: "Comparable protected sample/case package: 21.8 × 14.5 × 10.3 in, 14.075 lb. Conservative comparison estimate; not Pelican carton data.",
  },
  {
    id: "flooring-trim-v1",
    category: "Flooring",
    subCategory: "Moldings & Trim",
    transportMode: "parcel",
    lengthIn: 96,
    widthIn: 4,
    heightIn: 4,
    weightLbs: 30,
    freightClass: null,
    sourceUrl: "https://www.homedepot.com/p/Alexandria-Moulding-1-2-in-x-3-4-in-x-96-in-Primed-Pine-Finger-Joint-Base-Cap-Moulding-0W576-20096C/206130119",
    sourceReference: "Comparable protected 96 in molding shipment. Conservative trim-package estimate; not Pelican carton data.",
  },
  {
    id: "flooring-underlayment-v1",
    category: "Flooring",
    subCategory: "Underlayment",
    transportMode: "parcel",
    lengthIn: 48,
    widthIn: 24,
    heightIn: 6,
    weightLbs: 30,
    freightClass: null,
    sourceUrl: "https://www.flooranddecor.com/underlayment-installation-materials/floor-muffler-ultraseal-underlayment-100188896.html",
    sourceReference: "Comparable flooring-underlayment roll/carton. Conservative 48 × 24 × 6 in / 30 lb comparison estimate; not Pelican carton data.",
  },
  {
    id: "marketing-display-v1",
    category: "Marketing & Merchandise",
    subCategory: "Merchandise",
    transportMode: "parcel",
    lengthIn: 36,
    widthIn: 14,
    heightIn: 11,
    weightLbs: 21,
    freightClass: null,
    sourceUrl: "https://www.orbusdisplays.com/products/thunder-outdoor-retractable-banner-stand",
    sourceReference: "Comparable display shipping carton: 36 × 14 × 11 in, 21 lb. Comparison estimate only; multi-unit kits need carrier screening.",
  },
  {
    id: "mosaic-tile-v1",
    category: "Tile & Mosaic",
    subCategory: "Mosaic",
    transportMode: "parcel",
    lengthIn: 14,
    widthIn: 10,
    heightIn: 3,
    weightLbs: 6,
    freightClass: null,
    sourceUrl: "https://anchor-stone.eurosourcellc.com/product/anchor-architectural-blocks/mosaic-stone-floor-tile-box/",
    sourceReference: "Comparable mosaic box: 14 × 9.7 × 2.3 in, 5.75 lb. Comparison estimate only; mixed or multi-carton orders need carrier screening.",
  },
  {
    id: "tile-carton-v1",
    category: "Tile & Mosaic",
    subCategory: "Tile",
    transportMode: "parcel",
    lengthIn: 20,
    widthIn: 20,
    heightIn: 6,
    weightLbs: 55,
    freightClass: null,
    sourceUrl: "https://www.richmondflooring.ca/en/product/greystone-4",
    sourceReference: "Comparable tile carton: 20.08 × 20.08 × 5.31 in, 55 lb. Comparison estimate only; dense/multi-carton orders need carrier screening.",
  },
  {
    id: "quartz-slab-v1",
    category: "Quartz Slabs (Countertops)",
    subCategory: "Quartz Slab",
    transportMode: "ltl",
    lengthIn: 126,
    widthIn: 63,
    heightIn: 32,
    weightLbs: 600,
    freightClass: null,
    sourceUrl: "https://hefenggroup.en.made-in-china.com/product/javRsboGXgrL/China-Big-Slab-Quartz-Stone-Countertop-in-1600mmx3200mm-Size-Options.html",
    sourceReference: "Comparable quartz shipment: 110.24 × 62.99 × 31.5 in, 551.16 lb. Conservative LTL comparison estimate; not Pelican crate/bundle data.",
  },
  {
    id: "ceramic-toilet-v1",
    category: "Toilets & Bidets",
    subCategory: "Toilets & Bidets",
    transportMode: "ltl",
    lengthIn: 37,
    widthIn: 20,
    heightIn: 19,
    weightLbs: 90,
    freightClass: null,
    sourceUrl: "https://www.cmiproduct.com/wp-content/uploads/literature/2017_Canton_Bathware_Catalog.pdf",
    sourceReference: "Comparable ceramic toilet carton: 34.625 × 19.875 × 15.9375 in, 78 lb. Conservative LTL comparison estimate; not Pelican carton data.",
  },
  {
    id: "range-top-30-36-v1",
    category: "Range Tops",
    transportMode: "parcel",
    lengthIn: 41,
    widthIn: 11,
    heightIn: 27,
    weightLbs: 80,
    freightClass: null,
    sourceUrl: "https://us.mieleusa.com/MieleMedia/docs/products/specs/pdf/cooktops/KM6375.pdf",
    sourceReference: "Comparable 30–36 in cooktop package: 40.31 × 7.28 × 26.66 in, 65.35 lb. Conservative comparison estimate; not Pelican carton data.",
  },
  {
    id: "commercial-flush-valve-v1",
    category: "Toilets & Bidets",
    subCategory: "Commercial Flush Valves",
    transportMode: "parcel",
    lengthIn: 22,
    widthIn: 13,
    heightIn: 6,
    weightLbs: 12,
    freightClass: null,
    sourceUrl: "https://www.sloan.com/commercial-bathroom-products/flushometers/royal/111-1-28-3910168",
    sourceReference: "Comparable commercial flush-valve carton. Conservative 22 × 13 × 6 in / 12 lb comparison estimate; not Pelican carton data.",
  },
  {
    id: "toilet-bidet-v1",
    category: "Toilets & Bidets",
    transportMode: "ltl",
    lengthIn: 37,
    widthIn: 20,
    heightIn: 19,
    weightLbs: 90,
    freightClass: null,
    sourceUrl: "https://www.cmiproduct.com/wp-content/uploads/literature/2017_Canton_Bathware_Catalog.pdf",
    sourceReference: "Comparable ceramic toilet carton: 34.625 × 19.875 × 15.9375 in, 78 lb. Conservative LTL comparison estimate; not Pelican carton data.",
  },
] as const;

export function comparablePackagingRuleForPelicanProduct(
  product: Pick<PelicanComparablePackagingProduct, "category" | "subCategory" | "name">,
): PelicanComparablePackagingRule | null {
  const matched = PELICAN_COMPARABLE_PACKAGING_RULES.find((rule) => (
    rule.category === product.category
    && (rule.subCategory == null || rule.subCategory === product.subCategory)
    && (rule.namePattern == null || rule.namePattern.test(product.name))
  ));
  return matched ?? null;
}

export function comparisonProfileForPelicanProduct(product: PelicanComparablePackagingProduct) {
  const rule = comparablePackagingRuleForPelicanProduct(product);
  if (!rule) return null;
  return {
    pelicanProductId: product.id,
    originName: PELICAN_COMPARISON_ORIGIN.name,
    originZip: PELICAN_COMPARISON_ORIGIN.zip,
    transportMode: rule.transportMode,
    packageLengthIn: String(rule.lengthIn),
    packageWidthIn: String(rule.widthIn),
    packageHeightIn: String(rule.heightIn),
    packageWeightLbs: String(rule.weightLbs),
    freightClass: rule.freightClass,
    evidenceType: "comparable_estimate" as const,
    comparisonRuleId: rule.id,
    sourceUrl: rule.sourceUrl,
    sourceReference: `${rule.sourceReference} Pelican origin: ${PELICAN_COMPARISON_ORIGIN.sourceUrl}`,
    verifiedAt: new Date(),
    isEnabled: true,
  };
}
