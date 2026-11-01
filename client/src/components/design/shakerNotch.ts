/**
 * The inner shaker notch: the recessed step between the rails/stiles and the
 * center panel. It is a closed ring on all four sides of the opening. Driftwood
 * shadow strips are a separate finish effect and are not part of this geometry.
 */
import * as THREE from "three";

const INCH = 1 / 12;

/** Visible width of the recessed shoulder. About 3/16", the line that reads on a Faircrest Classic Cream door. */
export const SHAKER_NOTCH_WIDTH_IN = 0.1875;
/** Thickness of the shoulder, sitting just proud of the center panel. */
export const SHAKER_NOTCH_THICKNESS = 0.008;

export type ShakerNotchSide = "top" | "bottom" | "left" | "right";

export interface ShakerNotchPiece {
  side: ShakerNotchSide;
  /** Center of the piece in the frame group's local XY, opening centered at the origin. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Four pieces that together cover every edge of the opening, including the
 * corners. Top and bottom span the full opening width; left and right span the
 * full opening height. On a narrow face the lip shrinks so a center panel remains.
 * Returns nothing only when the opening itself is too small to hold a step.
 */
export function shakerNotchPieces(
  openingW: number,
  openingH: number,
  notchWidth = SHAKER_NOTCH_WIDTH_IN * INCH,
): ShakerNotchPiece[] {
  if (!(openingW > 0.04) || !(openingH > 0.04)) return [];
  const lip = Math.min(notchWidth, openingW / 6, openingH / 6);
  if (!(lip > 0.002)) return [];
  return [
    { side: "top", x: 0, y: openingH / 2 - lip / 2, w: openingW, h: lip },
    { side: "bottom", x: 0, y: -openingH / 2 + lip / 2, w: openingW, h: lip },
    { side: "left", x: -openingW / 2 + lip / 2, y: 0, w: lip, h: openingH },
    { side: "right", x: openingW / 2 - lip / 2, y: 0, w: lip, h: openingH },
  ];
}

/** True when the four pieces form one closed ring inside the opening. */
export function shakerNotchRingIsComplete(openingW: number, openingH: number, pieces = shakerNotchPieces(openingW, openingH)): boolean {
  if (pieces.length !== 4) return false;
  const sides = new Set(pieces.map((piece) => piece.side));
  if (sides.size !== 4) return false;
  const eps = 1e-6;
  for (const piece of pieces) {
    if (Math.abs(piece.x) + piece.w / 2 > openingW / 2 + eps) return false;
    if (Math.abs(piece.y) + piece.h / 2 > openingH / 2 + eps) return false;
    if (!(piece.w > 0) || !(piece.h > 0)) return false;
  }
  const top = pieces.find((piece) => piece.side === "top")!;
  const bottom = pieces.find((piece) => piece.side === "bottom")!;
  const left = pieces.find((piece) => piece.side === "left")!;
  const right = pieces.find((piece) => piece.side === "right")!;
  const fullWidth = Math.abs(top.w - openingW) < eps && Math.abs(bottom.w - openingW) < eps;
  const fullHeight = Math.abs(left.h - openingH) < eps && Math.abs(right.h - openingH) < eps;
  const touchesOuter = Math.abs(top.y + top.h / 2 - openingH / 2) < eps
    && Math.abs(bottom.y - bottom.h / 2 + openingH / 2) < eps
    && Math.abs(left.x - left.w / 2 + openingW / 2) < eps
    && Math.abs(right.x + right.w / 2 - openingW / 2) < eps;
  return fullWidth && fullHeight && touchesOuter;
}

const notchMaterialCache = new Map<string, THREE.MeshStandardMaterial>();

/** Door-colored shadow for the step. Pale doors stay a warm gray line; dark doors stay near-black. */
export function shakerNotchColor(faceColor: string): string {
  const shade = new THREE.Color(faceColor);
  const luma = 0.2126 * shade.r + 0.7152 * shade.g + 0.0722 * shade.b;
  shade.multiplyScalar(luma > 0.55 ? 0.62 : 0.38);
  return `#${shade.getHexString()}`;
}

export function shakerNotchMaterial(faceColor: string): THREE.MeshStandardMaterial {
  const key = faceColor.trim().toLowerCase() || "#ded5c1";
  const cached = notchMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color: shakerNotchColor(key),
    roughness: 0.92,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.userData = { shakerNotchMaterial: true, sharedShakerNotch: true };
  notchMaterialCache.set(key, material);
  return material;
}
