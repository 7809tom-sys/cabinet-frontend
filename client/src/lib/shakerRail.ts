const INCH = 1 / 12;

/**
 * Skinny-door rule (Tom, Nov 21 2026, 3:35 PM CT: "not follow the dl framework").
 * A DL Shaker frame member is never wider than this share of the face WIDTH, so the
 * recessed center stays at least half the door wide. Before this, a 9 inch door
 * (8.875 in face) kept two full 3 inch stiles around a 2.875 inch sliver and read as
 * two flat planks with a stripe instead of rails, stiles and a recessed center.
 * Faces 12 inches and wider are unchanged (3 in is already under 25%). The share is a
 * Designer proportion, not a published DL number (DL publishes no rail widths).
 */
export const SHAKER_FRAME_MAX_FACE_WIDTH_SHARE = 0.25;

/**
 * Physical Shaker rail/stile thickness in feet. This is the Designer helper
 * DL shaker frames use: a verified width, otherwise 3 inches, reduced when the
 * face is narrow (rails and stiles shrink together so the frame stays even) or
 * too small to keep an opening.
 */
export function threeDShakerRailThickness(faceWidth: number, faceHeight: number, verifiedInches?: string | number | null) {
  const requested = Number(verifiedInches);
  const thickness = Number.isFinite(requested) && requested > 0 ? requested * INCH : 3 * INCH;
  return Math.max(0, Math.min(
    thickness,
    faceWidth * SHAKER_FRAME_MAX_FACE_WIDTH_SHARE,
    faceWidth / 2 - 0.01,
    faceHeight / 2 - 0.01,
  ));
}

/** The physical Shaker frame must share the exact pose of its door face. */
export function threeDShakerFramePose(x: number, y: number, z: number, rotationY = 0) {
  return { x, y, z, rotationY };
}
