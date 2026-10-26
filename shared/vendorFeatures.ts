/**
 * One map from vendor type to supplier-portal features.
 *
 * Cabinet vendors and non-cabinet vendors (Pelican is the current example) do
 * not infer their tools from a missing distributor line or a display name.
 * `isCabinetVendor` on the approved vendor record is the choice:
 *   true  → cabinet
 *   false → non-cabinet
 *   null  → an administrator has not chosen yet (profile only)
 *
 * Some keys describe work that other pull requests are still building
 * (sales forecast, inventory, pricing pages, samples, sample kits, room-scene
 * gallery additions, cabinet conflict review, cabinet config). Those keys are
 * part of the map now. Callers should gate only the screens and endpoints
 * that already exist.
 *
 * Sample and sample-kit *ordering* is not a vendor feature and is not a
 * public-storefront action. Affiliates and administrators order samples from
 * the back office. Cabinet vendors manage door-sample availability and kits.
 * Administrators can always manage sample kits, including for a vendor that
 * is not a cabinet vendor.
 */

export const VENDOR_FEATURE_KEYS = [
  "cabinet_catalog",
  "cabinet_config",
  "door_styles",
  "featured_styles",
  "room_scenes",
  "designer_eligibility",
  "cabinet_conflict_review",
  "design_tools",
  "sales_forecast",
  "inventory",
  "pricing",
  "shipping_fulfillment",
  "promotions",
  "storefront",
  "category_catalog",
  "product_designer_visibility",
  "samples",
  "sample_kits",
] as const;

export type VendorFeature = (typeof VENDOR_FEATURE_KEYS)[number];

export type VendorKind = "cabinet" | "non_cabinet";

export type VendorFeatureSource = {
  isCabinetVendor?: boolean | null;
};

/** Back-office sample ordering. Never grant this on the public storefront. */
export const ORDER_SAMPLES_CAPABILITY = "order_samples" as const;

export type BackOfficeCapability = typeof ORDER_SAMPLES_CAPABILITY;

const CABINET_FEATURES: readonly VendorFeature[] = [
  "cabinet_catalog",
  "cabinet_config",
  "door_styles",
  "featured_styles",
  "room_scenes",
  "designer_eligibility",
  "cabinet_conflict_review",
  "design_tools",
  "sales_forecast",
  "inventory",
  "pricing",
  "shipping_fulfillment",
  "promotions",
  "storefront",
  "samples",
  "sample_kits",
];

const NON_CABINET_FEATURES: readonly VendorFeature[] = [
  "category_catalog",
  "product_designer_visibility",
  "sales_forecast",
  "inventory",
  "pricing",
  "shipping_fulfillment",
  "promotions",
  "storefront",
];

/** Until an administrator chooses, the supplier can maintain a profile and nothing else. */
const UNSET_FEATURES: readonly VendorFeature[] = ["storefront"];

export function vendorKind(vendor: VendorFeatureSource | null | undefined): VendorKind | null {
  if (!vendor) return null;
  if (vendor.isCabinetVendor === true) return "cabinet";
  if (vendor.isCabinetVendor === false) return "non_cabinet";
  return null;
}

export function vendorKindLabel(vendor: VendorFeatureSource | null | undefined): string {
  const kind = vendorKind(vendor);
  if (kind === "cabinet") return "Cabinet vendor";
  if (kind === "non_cabinet") return "Non-cabinet";
  return "Needs cabinet choice";
}

export function featuresForVendor(vendor: VendorFeatureSource | null | undefined): readonly VendorFeature[] {
  const kind = vendorKind(vendor);
  if (kind === "cabinet") return CABINET_FEATURES;
  if (kind === "non_cabinet") return NON_CABINET_FEATURES;
  return UNSET_FEATURES;
}

export function hasVendorFeature(
  vendor: VendorFeatureSource | null | undefined,
  feature: VendorFeature,
): boolean {
  return featuresForVendor(vendor).includes(feature);
}

/**
 * Portal pages that exist in this repo, and the feature that reveals each one.
 * A list means any one of those features is enough. Pages with no entry are
 * not gated here because they are not built yet.
 */
export const VENDOR_PORTAL_PAGE_FEATURES = {
  overview: "always",
  "supplier-profile": "storefront",
  catalog: ["cabinet_catalog", "category_catalog"],
  "other-products": "cabinet_catalog",
  styles: "door_styles",
  "featured-styles": "featured_styles",
  shipping: "shipping_fulfillment",
  picks: "designer_eligibility",
  promotions: "promotions",
  gallery: "room_scenes",
  analytics: "design_tools",
  orders: "cabinet_catalog",
  fulfillment: "shipping_fulfillment",
  "ai-services": "design_tools",
  integrations: "cabinet_catalog",
  payments: "cabinet_catalog",
} as const satisfies Record<string, VendorFeature | VendorFeature[] | "always">;

export type VendorPortalPageId = keyof typeof VENDOR_PORTAL_PAGE_FEATURES;

export function vendorCanOpenPortalPage(
  vendor: VendorFeatureSource | null | undefined,
  page: string,
): boolean {
  const rule = VENDOR_PORTAL_PAGE_FEATURES[page as VendorPortalPageId];
  if (!rule) return false;
  // Overview is the home page once a type is chosen. An unset flag stays on
  // the supplier profile until an administrator picks cabinet or non-cabinet.
  if (rule === "always") return vendorKind(vendor) != null;
  const required = Array.isArray(rule) ? rule : [rule];
  return required.some((feature) => hasVendorFeature(vendor, feature));
}

export function vendorPortalPages(vendor: VendorFeatureSource | null | undefined): VendorPortalPageId[] {
  return (Object.keys(VENDOR_PORTAL_PAGE_FEATURES) as VendorPortalPageId[]).filter((page) =>
    vendorCanOpenPortalPage(vendor, page),
  );
}

/**
 * Where the migration should leave `isCabinetVendor` when it is still unset.
 * Pelican's source key is always non-cabinet. Any other linked distributor
 * row (a cabinet supplier line) is cabinet. A Pelican-only distributor match
 * is non-cabinet. No link at all stays unset so an administrator chooses.
 */
export function cabinetFlagFromLineLinks(input: {
  sourceKey?: string | null;
  matchesCabinetDistributor: boolean;
  matchesPelicanDistributor: boolean;
}): boolean | null {
  if ((input.sourceKey ?? "").trim().toLowerCase() === "pelican") return false;
  if (input.matchesCabinetDistributor) return true;
  if (input.matchesPelicanDistributor) return false;
  return null;
}

export function vendorApprovalChoiceError(input: {
  isApproved?: boolean;
  isCabinetVendor?: boolean | null;
}): string | null {
  if (input.isApproved === true && (input.isCabinetVendor === null || input.isCabinetVendor === undefined)) {
    return "Choose whether this is a cabinet vendor before approving it.";
  }
  return null;
}

export function canOrderSamples(actor: { role?: string | null } | null | undefined): boolean {
  const role = actor?.role;
  return role === "admin" || role === "affiliate";
}

/** Administrators manage sample kits from the back office for every vendor. */
export function canManageSampleKits(actor: { role?: string | null } | null | undefined): boolean {
  return actor?.role === "admin";
}

export const CABINET_VENDOR_FEATURES = CABINET_FEATURES;
export const NON_CABINET_VENDOR_FEATURES = NON_CABINET_FEATURES;
