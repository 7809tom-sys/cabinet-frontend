/**
 * Client-side display rules for the Designer door-style sample tiles.
 *
 * The door tile is a 15 in × 22.5 in door (2:3), the single-door face under
 * a USCD reveal. The drawer tile is a 30 in × 7.5 in drawer front (4:1).
 * Photos are fitted inside those frames. They are never stretched to fill.
 *
 * A drawer tile uses a photo only when the style has its own drawer file.
 * A missing file, the door file, or the thumbnail file is not a drawer photo.
 * An approved door render is not copied into the drawer tile either.
 * 3D face plans still use preferredDrawerReferenceUrl; this module is the preview.
 */

import {
  doorImageUrlsMatch,
  preferredDoorReferenceUrl,
} from "./approvedDoorReference";

/** Width ÷ height of the door sample tile. 15 in × 22.5 in. */
export const DOOR_SAMPLE_ASPECT = 2 / 3;
/** Width ÷ height of the drawer-front sample tile. 30 in × 7.5 in. */
export const DRAWER_SAMPLE_ASPECT = 4 / 1;

export const DOOR_SAMPLE_ASPECT_CSS = "2 / 3";
export const DRAWER_SAMPLE_ASPECT_CSS = "4 / 1";

/**
 * actual/expected must stay inside (1 − tolerance, 1 + tolerance).
 * A square or landscape brochure crop misses the door band.
 * A square, portrait, or 16:9 crop misses the drawer-front band.
 */
export const DOOR_ASPECT_TOLERANCE = 0.4;
export const DRAWER_ASPECT_TOLERANCE = 0.55;

/** Short side below this is a thumbnail, not a sample photo. */
export const SAMPLE_IMAGE_MIN_SHORT_SIDE_PX = 256;

export type SampleImageRole = "door" | "drawer";

export type SampleImageIssueCode = "low-resolution" | "stretched" | "duplicate";

export type SampleImageIssue = {
  code: SampleImageIssueCode;
  detail: string;
};

export type SampleStyleImages = {
  approvedReferenceImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  drawerSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
};

/** null until the file is measured, "pending" while it loads, "error" if it fails. */
export type SampleMeasurement = { width: number; height: number } | "pending" | "error" | null;

export type DrawerSampleDecision = {
  /** Photo to show. Null when the tile should use the drawer-front drawing. */
  photoUrl: string | null;
  useDrawing: boolean;
  pending: boolean;
  loadFailed: boolean;
  issues: SampleImageIssue[];
};

const ISSUE_LABEL: Record<SampleImageIssueCode, string> = {
  "low-resolution": "Low resolution",
  stretched: "Crop doesn't match the sample shape",
  duplicate: "Duplicate picture",
};

export function sampleAspectFor(role: SampleImageRole): number {
  return role === "door" ? DOOR_SAMPLE_ASPECT : DRAWER_SAMPLE_ASPECT;
}

export function sampleAspectCss(role: SampleImageRole): string {
  return role === "door" ? DOOR_SAMPLE_ASPECT_CSS : DRAWER_SAMPLE_ASPECT_CSS;
}

export function sampleAspectIsFarOff(role: SampleImageRole, width: number, height: number): boolean {
  if (!(width > 0) || !(height > 0)) return false;
  const ratio = (width / height) / sampleAspectFor(role);
  const tolerance = role === "door" ? DOOR_ASPECT_TOLERANCE : DRAWER_ASPECT_TOLERANCE;
  return ratio < 1 - tolerance || ratio > 1 + tolerance;
}

function expectedShapeLabel(role: SampleImageRole): string {
  return role === "door" ? "2:3 door" : "4:1 drawer front";
}

/**
 * Drawer file that is actually a drawer picture.
 * Missing, door, thumbnail, and "use the approved door render" all return null
 * so the preview can draw a drawer front instead of repeating the door.
 */
export function distinctDrawerSampleUrl(style: SampleStyleImages | null | undefined): string | null {
  if (!style) return null;
  const raw = style.drawerSampleImageUrl?.trim() ?? "";
  if (!raw) return null;
  const doorShown = preferredDoorReferenceUrl(style);
  if (
    doorImageUrlsMatch(raw, doorShown)
    || doorImageUrlsMatch(raw, style.doorSampleImageUrl)
    || doorImageUrlsMatch(raw, style.thumbnailImageUrl)
  ) {
    return null;
  }
  const approved = style.approvedReferenceImageUrl?.trim() ?? "";
  // A featured drawer that is not the approved file used to be replaced
  // with the approved door render. The preview does not reuse that door.
  if (approved && !doorImageUrlsMatch(raw, approved)) return null;
  return raw;
}

function duplicateIssue(
  url: string,
  role: SampleImageRole,
  doorUrl: string | null,
  doorSampleUrl: string | null | undefined,
  drawerUrl: string | null | undefined,
  thumbnailUrl: string | null | undefined,
): SampleImageIssue | null {
  if (role === "drawer") {
    const sameDoor = doorImageUrlsMatch(url, doorUrl) || doorImageUrlsMatch(url, doorSampleUrl);
    const sameThumb = doorImageUrlsMatch(url, thumbnailUrl);
    if (!sameDoor && !sameThumb) return null;
    const which = sameDoor && sameThumb
      ? "the door and the thumbnail"
      : sameDoor
        ? "the door"
        : "the thumbnail";
    return { code: "duplicate", detail: `Same file as ${which}.` };
  }
  const sameDrawer = doorImageUrlsMatch(url, drawerUrl);
  if (!sameDrawer) return null;
  const sameThumb = doorImageUrlsMatch(url, thumbnailUrl);
  return {
    code: "duplicate",
    detail: sameThumb
      ? "Same file as the drawer and the thumbnail."
      : "Same file as the drawer picture.",
  };
}

function pixelIssues(role: SampleImageRole, width: number, height: number): SampleImageIssue[] {
  const issues: SampleImageIssue[] = [];
  const shortSide = Math.min(width, height);
  if (shortSide < SAMPLE_IMAGE_MIN_SHORT_SIDE_PX) {
    issues.push({
      code: "low-resolution",
      detail: `${width}×${height} px is below ${SAMPLE_IMAGE_MIN_SHORT_SIDE_PX} px on the short side.`,
    });
  }
  if (sampleAspectIsFarOff(role, width, height)) {
    const actual = width / height;
    issues.push({
      code: "stretched",
      detail: `${actual.toFixed(2)}:1 is far from the ${expectedShapeLabel(role)} shape.`,
    });
  }
  return issues;
}

export function assessSampleImage(input: {
  role: SampleImageRole;
  url: string | null | undefined;
  doorUrl?: string | null;
  doorSampleUrl?: string | null;
  drawerUrl?: string | null;
  thumbnailUrl?: string | null;
  width?: number | null;
  height?: number | null;
}): SampleImageIssue[] {
  const url = input.url?.trim() ?? "";
  if (!url) return [];
  const issues: SampleImageIssue[] = [];
  const duplicate = duplicateIssue(
    url,
    input.role,
    input.doorUrl ?? null,
    input.doorSampleUrl,
    input.drawerUrl,
    input.thumbnailUrl,
  );
  if (duplicate) issues.push(duplicate);
  const width = input.width ?? null;
  const height = input.height ?? null;
  if (width != null && height != null && width > 0 && height > 0) {
    issues.push(...pixelIssues(input.role, width, height));
  }
  return issues;
}

export function assessDoorSample(
  style: SampleStyleImages | null | undefined,
  measurement: SampleMeasurement = null,
): SampleImageIssue[] {
  const url = preferredDoorReferenceUrl(style);
  if (!url || !style) return [];
  const pixels = measurement && measurement !== "pending" && measurement !== "error" ? measurement : null;
  return assessSampleImage({
    role: "door",
    url,
    drawerUrl: style.drawerSampleImageUrl,
    thumbnailUrl: style.thumbnailImageUrl,
    width: pixels?.width,
    height: pixels?.height,
  });
}

export function assessDrawerSample(
  style: SampleStyleImages | null | undefined,
  measurement: SampleMeasurement = null,
): DrawerSampleDecision {
  const photoUrl = distinctDrawerSampleUrl(style);
  const raw = style?.drawerSampleImageUrl?.trim() ?? "";
  const urlIssues = raw
    ? assessSampleImage({
      role: "drawer",
      url: raw,
      doorUrl: preferredDoorReferenceUrl(style),
      doorSampleUrl: style?.doorSampleImageUrl,
      thumbnailUrl: style?.thumbnailImageUrl,
    })
    : [];

  if (!photoUrl) {
    return { photoUrl: null, useDrawing: true, pending: false, loadFailed: false, issues: urlIssues };
  }
  if (measurement === "error") {
    return { photoUrl: null, useDrawing: true, pending: false, loadFailed: true, issues: urlIssues };
  }
  if (measurement == null || measurement === "pending") {
    return { photoUrl, useDrawing: false, pending: true, loadFailed: false, issues: urlIssues };
  }
  const issues = [
    ...urlIssues,
    ...pixelIssues("drawer", measurement.width, measurement.height),
  ];
  const blocked = issues.length > 0;
  return {
    photoUrl: blocked ? null : photoUrl,
    useDrawing: blocked,
    pending: false,
    loadFailed: false,
    issues,
  };
}

export function formatSampleImageFlag(issues: SampleImageIssue[], loadFailed = false): string {
  const parts = issues.map((issue) => `${ISSUE_LABEL[issue.code]}. ${issue.detail}`);
  if (loadFailed) parts.push("Picture could not be loaded.");
  return parts.join(" ");
}
