export const ELEVATION_PIXELS_PER_INCH = 4;
export const SHAKER_FACE_FRAME_INCHES = 3;
export const SHAKER_FACE_FRAME_PX = SHAKER_FACE_FRAME_INCHES * ELEVATION_PIXELS_PER_INCH;
export const SLIM_SHAKER_FACE_FRAME_INCHES = 1;
export const SLIM_SHAKER_FACE_FRAME_PX = SLIM_SHAKER_FACE_FRAME_INCHES * ELEVATION_PIXELS_PER_INCH;

export interface ShakerFacePanelGeometry {
  stileInches: number;
  railInches: number;
  centerPanelWidthInches: number;
  centerPanelHeightInches: number;
  horizontalInsetPercent: number;
  verticalInsetPercent: number;
}

/**
 * Physical Shaker face geometry. Verified stile and rail values may be supplied
 * by the authorized Door Style record; absent ordinary Shaker values retain the
 * neutral 3-inch profile while Slim Shaker retains its 1-inch family rule. The
 * center panel remains independent of screen zoom.
 */
export function shakerFacePanelGeometry(
  faceWidthInches: number,
  faceHeightInches: number,
  verified?: { stileInches?: number | null; railInches?: number | null },
  kind?: string,
): ShakerFacePanelGeometry {
  const width = Math.max(0.1, faceWidthInches);
  const height = Math.max(0.1, faceHeightInches);
  const requestedStile = Number(verified?.stileInches);
  const requestedRail = Number(verified?.railInches);
  const fallback = kind === "slim-shaker" ? SLIM_SHAKER_FACE_FRAME_INCHES : SHAKER_FACE_FRAME_INCHES;
  const stile = Math.min(Number.isFinite(requestedStile) && requestedStile > 0 ? requestedStile : fallback, width / 2);
  const rail = Math.min(Number.isFinite(requestedRail) && requestedRail > 0 ? requestedRail : fallback, height / 2);
  return {
    stileInches: stile,
    railInches: rail,
    centerPanelWidthInches: Math.max(0, width - stile * 2),
    centerPanelHeightInches: Math.max(0, height - rail * 2),
    horizontalInsetPercent: (stile / width) * 100,
    verticalInsetPercent: (rail / height) * 100,
  };
}

export function isShakerElevationStyle(kind: string): boolean {
  return kind === "shaker" || kind === "slim-shaker" || kind === "double-shaker";
}

export function isFlatPanelElevationStyle(kind: string): boolean {
  return kind === "slab";
}

/** Converts an authored face-frame width in inches into the elevation pixel inset. */
export function frameInsetPxFromInches(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const inches = Number.parseFloat(String(value));
  if (!Number.isFinite(inches) || inches <= 0) return null;
  return Math.min(16, Math.max(2, Math.round(inches * ELEVATION_PIXELS_PER_INCH)));
}

/**
 * Every framed face uses an authored stile inset when present. Slim Shaker has
 * a one-inch family fallback; ordinary Shaker remains three inches.
 */
export function elevationFrameInsetPx(kind: string, authoredInset?: number | null): number | null {
  if (isFlatPanelElevationStyle(kind)) return null;
  if (authoredInset != null) return authoredInset;
  if (kind === "slim-shaker") return SLIM_SHAKER_FACE_FRAME_PX;
  return isShakerElevationStyle(kind) ? SHAKER_FACE_FRAME_PX : null;
}

/**
 * Drawer fronts are shorter than doors, so preserve the authored frame width
 * while keeping enough visible recessed-panel area for the elevation drawing.
 */
export function drawerPanelInsetPx(frameInsetPx: number | null | undefined, isShaker = false, kind?: string): number {
  if (isShaker) return frameInsetPx ?? (kind === "slim-shaker" ? SLIM_SHAKER_FACE_FRAME_PX : SHAKER_FACE_FRAME_PX);
  return Math.min(10, Math.max(3, Math.round(frameInsetPx ?? 3)));
}
