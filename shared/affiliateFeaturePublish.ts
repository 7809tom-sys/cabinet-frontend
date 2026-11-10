/**
 * Features the product already gates for affiliates, and the rule for whether
 * a distributor or vendor has published one of them.
 *
 * A missing row is not published. Affiliate Literature is not in this list:
 * library documents stay on Settings → Affiliate Literature.
 */

export const AFFILIATE_FEATURE_PUBLISH_KEYS = [
  "kitchen_designer",
  "bathroom_builder",
  "laundry_builder",
  "closet_builder",
  "closet_studio",
  "other_room_designer",
  "cabinet_catalog",
  "pelican_catalog",
  "hardware_catalog",
  "closet_catalog",
  "kitchen_packages",
  "samples",
  "promotions",
  "image_cabinet",
  "installation_estimates",
  "quote",
] as const;

export type AffiliateFeatureKey = (typeof AFFILIATE_FEATURE_PUBLISH_KEYS)[number];

export type AffiliateFeatureDefinition = {
  key: AffiliateFeatureKey;
  label: string;
  /** Where the app already decides whether an affiliate can open this. */
  gatedIn: string;
};

export const AFFILIATE_FEATURES: readonly AffiliateFeatureDefinition[] = [
  { key: "kitchen_designer", label: "Kitchen designer", gatedIn: "Designer room type kitchen, and the affiliate Design Workspace" },
  { key: "bathroom_builder", label: "Bathroom builder", gatedIn: "Designer room type bathroom" },
  { key: "laundry_builder", label: "Laundry builder", gatedIn: "Designer room type laundry" },
  { key: "closet_builder", label: "Closet builder", gatedIn: "Designer room type closet. Affiliate stores stay in this builder." },
  { key: "closet_studio", label: "Closet Studio", gatedIn: "Affiliate route /store/:slug/closet and the Products card" },
  { key: "other_room_designer", label: "Other room designer", gatedIn: "Designer room type other" },
  { key: "cabinet_catalog", label: "Cabinet catalog", gatedIn: "Affiliate My Catalog lines from distributor selections" },
  { key: "pelican_catalog", label: "Pelican catalog", gatedIn: "Platform catalog Pelican and /store/:slug/surfaces" },
  { key: "hardware_catalog", label: "Hardware catalog", gatedIn: "Platform catalog Hardware Resources and /store/:slug/hardware" },
  { key: "closet_catalog", label: "Closet catalog", gatedIn: "Platform catalog Closets (Closet Studio) in My Catalog" },
  { key: "kitchen_packages", label: "Kitchen packages", gatedIn: "Affiliate Kitchen Packages, gated by designer access" },
  { key: "samples", label: "Sample ordering", gatedIn: "Affiliate Samples desk. Affiliates are allowed to order samples." },
  { key: "promotions", label: "Promotions", gatedIn: "Affiliate Promotions & Banners" },
  { key: "image_cabinet", label: "Image Cabinet", gatedIn: "Affiliate Image Cabinet" },
  { key: "installation_estimates", label: "Installation estimates", gatedIn: "Affiliate Installation Estimates" },
  { key: "quote", label: "Quote requests", gatedIn: "Affiliate customer link Preview Quote Page" },
];

export const DESIGNER_ROOM_FEATURE = {
  kitchen: "kitchen_designer",
  bathroom: "bathroom_builder",
  laundry: "laundry_builder",
  closet: "closet_builder",
  other: "other_room_designer",
} as const;

export type PublishSubjectKind = "distributor" | "vendor";

export type AffiliateFeaturePublishRow = {
  subjectKind: PublishSubjectKind;
  subjectId: number;
  featureKey: string;
  published: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
};

export function isAffiliateFeatureKey(value: string): value is AffiliateFeatureKey {
  return (AFFILIATE_FEATURE_PUBLISH_KEYS as readonly string[]).includes(value);
}

/** True only when a stored row for this subject and feature is explicitly on. */
export function isPublishedForAffiliate(
  rows: readonly AffiliateFeaturePublishRow[],
  subject: { kind: PublishSubjectKind; id: number },
  featureKey: string,
): boolean {
  return rows.some((row) =>
    row.published === true
    && row.featureKey === featureKey
    && row.subjectKind === subject.kind
    && row.subjectId === subject.id,
  );
}

/** True when any distributor or vendor has explicitly published this feature. */
export function anyAffiliateFeaturePublished(
  rows: readonly AffiliateFeaturePublishRow[],
  featureKey: string,
): boolean {
  return rows.some((row) => row.published === true && row.featureKey === featureKey);
}

export function publishRowFor(
  rows: readonly AffiliateFeaturePublishRow[],
  subject: { kind: PublishSubjectKind; id: number },
  featureKey: string,
): AffiliateFeaturePublishRow | null {
  return rows.find((row) =>
    row.featureKey === featureKey
    && row.subjectKind === subject.kind
    && row.subjectId === subject.id,
  ) ?? null;
}

export type CatalogVendorPublishInput = {
  key: string;
  kind: "cabinet" | "hardware" | "surface" | "closet";
};

/**
 * Whether this My Catalog entry may be offered.
 * Platform catalogs (hardware, Pelican, closet) need any subject to have published that feature.
 * A cabinet line needs that distributor's cabinet catalog switch.
 * Callers must skip this check until the publish list has loaded from the server.
 */
export function catalogVendorPublished(
  rows: readonly AffiliateFeaturePublishRow[],
  vendor: CatalogVendorPublishInput,
): boolean {
  if (vendor.kind === "hardware" || vendor.key === "hardware") return anyAffiliateFeaturePublished(rows, "hardware_catalog");
  if (vendor.kind === "surface" || vendor.key === "pelican") return anyAffiliateFeaturePublished(rows, "pelican_catalog");
  if (vendor.kind === "closet" || vendor.key === "closet") return anyAffiliateFeaturePublished(rows, "closet_catalog");
  const match = /^distributor:(\d+)$/.exec(vendor.key);
  if (!match) return false;
  return isPublishedForAffiliate(rows, { kind: "distributor", id: Number(match[1]) }, "cabinet_catalog");
}
