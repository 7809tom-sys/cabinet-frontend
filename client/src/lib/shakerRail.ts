const INCH = 1 / 12;

/**
 * Physical Shaker rail/stile thickness in feet. This is the Designer helper
 * DL shaker frames use: a verified width, otherwise 3 inches, reduced only
 * when the face is too small to keep an opening.
 */
export function threeDShakerRailThickness(faceWidth: number, faceHeight: number, verifiedInches?: string | number | null) {
  const requested = Number(verifiedInches);
  const thickness = Number.isFinite(requested) && requested > 0 ? requested * INCH : 3 * INCH;
  return Math.max(0, Math.min(thickness, faceWidth / 2 - 0.01, faceHeight / 2 - 0.01));
}

/** The physical Shaker frame must share the exact pose of its door face. */
export function threeDShakerFramePose(x: number, y: number, z: number, rotationY = 0) {
  return { x, y, z, rotationY };
}
