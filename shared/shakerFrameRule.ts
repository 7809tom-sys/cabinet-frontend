/**
 * Regular shaker vs skinny shaker frame width (Tom, voice, Nov 21 2026, 3:45 PM CT).
 *
 * - Regular shaker door: a FIXED 2-3/4 inch rail and stile frame. A standard shaker
 *   request (no stored width, or a stored 2.75 or 3 inch width) always means 2.75.
 * - Skinny shaker door: a door face under 12 inches wide (confirm with Tom). Its frame
 *   is min(2.75, 25% of the face width) so the recessed center stays at least half the
 *   door wide. Rails equal stiles.
 *
 * A verified non-standard width (Slim Shaker's 1 inch, for example) is kept as is and
 * gets the same skinny cap. The last clamp (half the face less 0.01 ft) only stops a
 * frame from closing the opening on a tiny front.
 *
 * Pure inches, no imports, so the 3D Designer (client/src/lib/shakerRail.ts) and the
 * admin Door Box Blueprint (shared/doorBoxBlueprint.ts) share exactly one rule.
 */
export const REGULAR_SHAKER_FRAME_IN = 2.75;
/** Door faces narrower than this are skinny shaker doors. Confirm with Tom. */
export const SKINNY_SHAKER_FACE_BELOW_IN = 12;
/** A skinny door's frame is never wider than this share of its face width. */
export const SKINNY_SHAKER_FRAME_MAX_FACE_SHARE = 0.25;

const FACE_MARGIN_IN = 0.12; // 0.01 ft

/** True for a stored width that is the standard shaker rail (2.75 or 3 in). */
function isStandardShakerWidth(inches: number): boolean {
  return Math.abs(inches - 2.75) < 0.02 || Math.abs(inches - 3) < 0.02;
}

export function isSkinnyShakerFace(faceWidthIn: number): boolean {
  return faceWidthIn < SKINNY_SHAKER_FACE_BELOW_IN;
}

/** Rail and stile width, in inches, for a shaker face of this size. */
export function shakerFrameWidthIn(faceWidthIn: number, faceHeightIn: number, requestedIn?: string | number | null): number {
  const requested = Number(requestedIn);
  const hasOwn = requestedIn != null && requestedIn !== "" && Number.isFinite(requested) && requested > 0;
  let frame = !hasOwn || isStandardShakerWidth(requested) ? REGULAR_SHAKER_FRAME_IN : requested;
  if (isSkinnyShakerFace(faceWidthIn)) frame = Math.min(frame, faceWidthIn * SKINNY_SHAKER_FRAME_MAX_FACE_SHARE);
  return Math.max(0, Math.min(frame, faceWidthIn / 2 - FACE_MARGIN_IN, faceHeightIn / 2 - FACE_MARGIN_IN));
}
