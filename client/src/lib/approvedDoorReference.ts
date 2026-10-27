/**
 * Approved door-render reference.
 *
 * Once an admin approves a passing audit render, that image is the source of
 * truth for the style. Featured Styles photos stay where an admin put them.
 * They are checked against the approved image and are not copied over it.
 */

export const FEATURED_IMAGE_MISMATCH_REASON = "Featured image doesn't match approved source";
export const NO_APPROVED_SOURCE_LABEL = "No approved source";
export const APPROVED_REFERENCE_LABEL = "Approved reference";

/**
 * The production Stainless door style is not in this repo or in cabinet-backend
 * code, fixtures, or seed files. This stands in for that style: its Featured
 * Styles photos are the wrong images, and an approved render is the source of truth.
 * The production database was not queried.
 */
export const STAINLESS_DOOR_STYLE_FIXTURE = {
  styleName: "Stainless",
  doorSampleImageUrl: "/manus-storage/featured-styles/stainless-wrong-wood-door.jpg",
  drawerSampleImageUrl: "/manus-storage/featured-styles/stainless-wrong-drawer.jpg",
  approvedReferenceImageUrl: "/manus-storage/door-rendering-audit/stainless-approved-render.png",
} as const;

export type FeaturedImageSlot = "door" | "drawer";

export type FeaturedImageFailure = {
  image: FeaturedImageSlot;
  reason: typeof FEATURED_IMAGE_MISMATCH_REASON;
};

export type FeaturedImageAudit = {
  sourceStatus: "no-approved-source" | "featured-mismatch" | "approved";
  failures: FeaturedImageFailure[];
};

export type ComparisonBaseline = {
  imageUrl: string | null;
  source: "approved-reference" | "sample-photo" | "none";
};

export function normalizeDoorImageUrl(value: string | null | undefined): string {
  return (value ?? "").trim().split("?")[0].replace(/\/+$/, "");
}

export function doorImageUrlsMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeDoorImageUrl(left);
  const b = normalizeDoorImageUrl(right);
  return a.length > 0 && a === b;
}

export function comparisonBaseline(input: {
  approvedReferenceImageUrl?: string | null;
  samplePhotoUrl?: string | null;
}): ComparisonBaseline {
  const approved = input.approvedReferenceImageUrl?.trim() ?? "";
  if (approved) return { imageUrl: approved, source: "approved-reference" };
  const sample = input.samplePhotoUrl?.trim() ?? "";
  if (sample) return { imageUrl: sample, source: "sample-photo" };
  return { imageUrl: null, source: "none" };
}

/** Featured door and drawer photos are checked separately. A missing approved render does not pass. */
export function featuredImagesAudit(input: {
  approvedReferenceImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  drawerSampleImageUrl?: string | null;
}): FeaturedImageAudit {
  const approved = normalizeDoorImageUrl(input.approvedReferenceImageUrl);
  if (!approved) return { sourceStatus: "no-approved-source", failures: [] };
  const failures: FeaturedImageFailure[] = [];
  if (!doorImageUrlsMatch(input.doorSampleImageUrl, approved)) {
    failures.push({ image: "door", reason: FEATURED_IMAGE_MISMATCH_REASON });
  }
  const drawer = normalizeDoorImageUrl(input.drawerSampleImageUrl);
  if (drawer && !doorImageUrlsMatch(drawer, approved)) {
    failures.push({ image: "drawer", reason: FEATURED_IMAGE_MISMATCH_REASON });
  }
  return {
    sourceStatus: failures.length > 0 ? "featured-mismatch" : "approved",
    failures,
  };
}

export function preferredDoorReferenceUrl(style: {
  approvedReferenceImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
} | null | undefined): string | null {
  if (!style) return null;
  const approved = style.approvedReferenceImageUrl?.trim() ?? "";
  if (approved) return approved;
  const sample = style.doorSampleImageUrl?.trim() ?? "";
  if (sample) return sample;
  const thumbnail = style.thumbnailImageUrl?.trim() ?? "";
  return thumbnail || null;
}

/**
 * A drawer photo that is not the approved reference is not used.
 * With no approved reference, the featured drawer photo stays in place.
 */
export function preferredDrawerReferenceUrl(style: {
  approvedReferenceImageUrl?: string | null;
  drawerSampleImageUrl?: string | null;
} | null | undefined): string | null {
  if (!style) return null;
  const drawer = style.drawerSampleImageUrl?.trim() ?? "";
  if (!drawer) return null;
  const approved = style.approvedReferenceImageUrl?.trim() ?? "";
  if (approved && !doorImageUrlsMatch(drawer, approved)) return approved;
  return drawer;
}
