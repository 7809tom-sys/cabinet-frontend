/**
 * One admin yes/no for the customer offerings group.
 * Missing or unknown values stay YES so a new install changes nothing.
 */

export const CUSTOMER_OFFERINGS_PAGE_KEY = "customer-offerings";
export const CUSTOMER_OFFERINGS_FIELD = "visible";

/** What the one switch shows or hides together. */
export const CUSTOMER_OFFERING_GROUP = [
  "Hardware Resources (site Hardware link and /hardware)",
  "Hardware catalog (My Catalog → Hardware Resources)",
  "Closet catalog (My Catalog → Closets)",
  "Pelican catalog entry and the Pelican products card (same catalog and Products group)",
  "Closet Studio and the Designer closet builder",
  "Kitchen packages",
  "Sampling (affiliate Order samples)",
  "Promotions (affiliate promotions and storefront promo prices)",
] as const;

export function customerOfferingsAreVisible(value: unknown): boolean {
  if (value == null || value === "") return true;
  const text = String(value).trim().toLowerCase();
  return text !== "no" && text !== "off" && text !== "false" && text !== "0";
}

const OFFERING_PATHS = ["/hardware", "/kitchens", "/bundles", "/closet"];

export function isCustomerOfferingPath(path: string): boolean {
  const bare = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (OFFERING_PATHS.includes(bare)) return true;
  return OFFERING_PATHS.some((item) => bare.endsWith(item));
}

export const CUSTOMER_OFFERING_AFFILIATE_SECTIONS = ["products", "samples", "promotions", "bundles"] as const;

export function isCustomerOfferingCatalogVendor(vendor: { key: string; kind: string }): boolean {
  return vendor.kind === "hardware" || vendor.kind === "closet" || vendor.kind === "surface" || vendor.key === "hardware" || vendor.key === "closet" || vendor.key === "pelican";
}
