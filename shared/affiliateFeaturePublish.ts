/**
 * Features the product already gates for affiliates, and the rule for whether
 * a distributor or vendor has published one of them.
 *
 * A missing row is not published. Two extra rows in the same table can override
 * that, with no schema change and no deleted rows:
 *
 *   subjectKind "global", subjectId 0, featureKey = the feature, published 0
 *     turns that feature off for every distributor and vendor.
 *   featureKey "all" on a distributor or vendor, published 0
 *     turns every feature off for that one subject.
 *
 * published 1 on either row turns that override back off. The other rows stay
 * as they were. No row at all means today's per-subject switches.
 *
 * Check order: an admin is always allowed; otherwise off when the global
 * feature row is off; otherwise off when that subject's "all" row is off;
 * otherwise that subject's own feature row decides.
 *
 * Quote requests stay in the list so the Publish tab can record the switch.
 * The shopping cart and quote request pages are not closed by that switch.
 * Call affiliateFeatureAlwaysOpen before treating a missing or off row as closed.
 *
 * Affiliate Literature is not in this list: library documents stay on
 * Settings → Affiliate Literature.
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
  { key: "quote", label: "Quote requests", gatedIn: "Recorded on the Publish tab. The shopping cart and quote request pages stay open for affiliates." },
];

/** Publish rows do not close these. The cart and a quote request stay available. */
export const AFFILIATE_FEATURES_ALWAYS_OPEN = ["quote"] as const;

export function affiliateFeatureAlwaysOpen(featureKey: string): boolean {
  return (AFFILIATE_FEATURES_ALWAYS_OPEN as readonly string[]).includes(featureKey);
}

export const DESIGNER_ROOM_FEATURE = {
  kitchen: "kitchen_designer",
  bathroom: "bathroom_builder",
  laundry: "laundry_builder",
  closet: "closet_builder",
  other: "other_room_designer",
} as const;

/** One row that turns a feature off for every distributor and vendor. */
export const GLOBAL_SUBJECT_KIND = "global" as const;
export const GLOBAL_SUBJECT_ID = 0;

/** One row that turns every feature off for a single distributor or vendor. */
export const SUBJECT_KILL_FEATURE_KEY = "all";

export type PublishSubjectKind = "distributor" | "vendor" | "global";

export type TerritorySubjectKind = "distributor" | "vendor";

export type AffiliateFeaturePublishRow = {
  subjectKind: PublishSubjectKind;
  subjectId: number;
  featureKey: string;
  published: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
};

/** Who is asking. Only platform admins skip the publish rows. */
export type PublishViewer = {
  role?: string | null;
};

export function isAffiliateFeatureKey(value: string): value is AffiliateFeatureKey {
  return (AFFILIATE_FEATURE_PUBLISH_KEYS as readonly string[]).includes(value);
}

/** The table stores 0/1. The admin screen stores false/true. Both mean the same thing. */
export function publishFlagOn(value: unknown): boolean {
  return value === true || value === 1;
}

/** Explicitly off. A missing row is not off. */
export function publishFlagOff(value: unknown): boolean {
  return value === false || value === 0;
}

export function publishViewerIsAdmin(viewer?: PublishViewer | null): boolean {
  return viewer?.role === "admin";
}

/** True when the global row for this feature is stored as published 0. */
export function isOffEverywhere(
  rows: readonly AffiliateFeaturePublishRow[],
  featureKey: string,
): boolean {
  const row = rows.find((item) =>
    item.subjectKind === GLOBAL_SUBJECT_KIND
    && item.subjectId === GLOBAL_SUBJECT_ID
    && item.featureKey === featureKey,
  );
  return row != null && publishFlagOff(row.published);
}

/** True when this subject's featureKey "all" row is stored as published 0. */
export function isSubjectShutOff(
  rows: readonly AffiliateFeaturePublishRow[],
  subject: { kind: string; id: number },
): boolean {
  const row = rows.find((item) =>
    item.subjectKind === subject.kind
    && item.subjectId === subject.id
    && item.featureKey === SUBJECT_KILL_FEATURE_KEY,
  );
  return row != null && publishFlagOff(row.published);
}

/**
 * True only when this subject may offer the feature.
 * Admin always. Then Off everywhere. Then the subject's kill switch.
 * Then the subject's own feature row, which stays unpublished until it is on.
 */
export function isPublishedForAffiliate(
  rows: readonly AffiliateFeaturePublishRow[],
  subject: { kind: TerritorySubjectKind; id: number },
  featureKey: string,
  viewer?: PublishViewer | null,
): boolean {
  if (publishViewerIsAdmin(viewer)) return true;
  if (isOffEverywhere(rows, featureKey)) return false;
  if (isSubjectShutOff(rows, subject)) return false;
  return rows.some((row) =>
    publishFlagOn(row.published)
    && row.featureKey === featureKey
    && row.subjectKind === subject.kind
    && row.subjectId === subject.id,
  );
}

/**
 * True when some distributor or vendor that is not shut off has this feature on.
 * A global "published 1" row is the Off everywhere switch turned back off.
 * It does not itself publish the feature.
 */
export function anyAffiliateFeaturePublished(
  rows: readonly AffiliateFeaturePublishRow[],
  featureKey: string,
  viewer?: PublishViewer | null,
): boolean {
  if (publishViewerIsAdmin(viewer)) return true;
  if (isOffEverywhere(rows, featureKey)) return false;
  return rows.some((row) =>
    publishFlagOn(row.published)
    && row.featureKey === featureKey
    && (row.subjectKind === "distributor" || row.subjectKind === "vendor")
    && !isSubjectShutOff(rows, { kind: row.subjectKind, id: row.subjectId }),
  );
}

/**
 * Room tabs in the Designer.
 * Admins always see the room. Until the publish list has loaded, nothing changes.
 * Off everywhere hides the room on the public designer and on affiliate stores.
 * An affiliate store also follows the per-subject rows. The public designer does
 * not, so a missing global row leaves it as it is today.
 */
export function designerRoomOffered(input: {
  role: string | null | undefined;
  affiliateStore: boolean;
  publishReady: boolean;
  rows: readonly AffiliateFeaturePublishRow[];
  featureKey: string;
}): boolean {
  if (input.role === "admin") return true;
  if (!input.publishReady) return true;
  if (isOffEverywhere(input.rows, input.featureKey)) return false;
  if (!input.affiliateStore) return true;
  return anyAffiliateFeaturePublished(input.rows, input.featureKey);
}

export function publishRowFor(
  rows: readonly AffiliateFeaturePublishRow[],
  subject: { kind: PublishSubjectKind | TerritorySubjectKind; id: number },
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
  viewer?: PublishViewer | null,
): boolean {
  if (vendor.kind === "hardware" || vendor.key === "hardware") return anyAffiliateFeaturePublished(rows, "hardware_catalog", viewer);
  if (vendor.kind === "surface" || vendor.key === "pelican") return anyAffiliateFeaturePublished(rows, "pelican_catalog", viewer);
  if (vendor.kind === "closet" || vendor.key === "closet") return anyAffiliateFeaturePublished(rows, "closet_catalog", viewer);
  const match = /^distributor:(\d+)$/.exec(vendor.key);
  if (!match) return false;
  return isPublishedForAffiliate(rows, { kind: "distributor", id: Number(match[1]) }, "cabinet_catalog", viewer);
}
