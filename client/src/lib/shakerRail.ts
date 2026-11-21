import { shakerFrameWidthIn, type FramedDoorKind } from "@shared/shakerFrameRule";

const INCH = 1 / 12;

/**
 * Physical Shaker rail/stile thickness in feet, from the one shared rule in
 * shared/shakerFrameRule.ts (Tom, Nov 21 2026, 3:45 PM CT):
 * - regular shaker door: fixed 2.75 inch frame (a stored 2.75 or 3 means 2.75);
 * - skinny shaker door (face under 12 in wide, confirm with Tom): min(2.75, 25% of
 *   the face width), so the recessed center stays at least half the door wide.
 * Rails equal stiles. A verified non-standard width (Slim Shaker 1 in) is kept.
 * `kind` "raised": raised panel doors use 2.5 in, with the same skinny cap (3:51 PM CT).
 */
export function threeDShakerRailThickness(
  faceWidth: number,
  faceHeight: number,
  verifiedInches?: string | number | null,
  kind: FramedDoorKind = "shaker",
) {
  return shakerFrameWidthIn(faceWidth / INCH, faceHeight / INCH, verifiedInches, kind) * INCH;
}

/** The physical Shaker frame must share the exact pose of its door face. */
export function threeDShakerFramePose(x: number, y: number, z: number, rotationY = 0) {
  return { x, y, z, rotationY };
}
