/**
 * The inner shaker notch: the recessed step between the rails/stiles and the
 * center panel. It is a closed ring on all four sides of the opening. Driftwood
 * shadow strips are a separate finish effect and are not part of this geometry.
 */
import * as THREE from "three";

const INCH = 1 / 12;

/**
 * Two unlit bands. The outer band is the shadow in the corner of the step; the
 * inner band is a lighter shoulder so the line is not a single hard stripe.
 * Together they are about 1/4" — the groove that reads on a Faircrest Classic Cream door.
 */
export const SHAKER_NOTCH_OUTER_IN = 0.12;
export const SHAKER_NOTCH_INNER_IN = 0.1;
/** Thickness of each band, sitting in the step in front of the center panel. */
export const SHAKER_NOTCH_THICKNESS = 0.008;

export type ShakerNotchSide = "top" | "bottom" | "left" | "right";
export type ShakerNotchBand = "outer" | "inner";

export interface ShakerNotchPiece {
  side: ShakerNotchSide;
  band: ShakerNotchBand;
  /** Center of the piece in the frame group's local XY, opening centered at the origin. */
  x: number;
  y: number;
  w: number;
  h: number;
}

function ring(openingW: number, openingH: number, lip: number, inset: number, band: ShakerNotchBand): ShakerNotchPiece[] {
  const innerW = openingW - inset * 2;
  const innerH = openingH - inset * 2;
  return [
    { band, side: "top", x: 0, y: openingH / 2 - inset - lip / 2, w: innerW, h: lip },
    { band, side: "bottom", x: 0, y: -openingH / 2 + inset + lip / 2, w: innerW, h: lip },
    { band, side: "left", x: -openingW / 2 + inset + lip / 2, y: 0, w: lip, h: innerH },
    { band, side: "right", x: openingW / 2 - inset - lip / 2, y: 0, w: lip, h: innerH },
  ];
}

/**
 * Outer and inner bands on all four sides. The outer band's outer edge is the
 * opening; top and bottom span that full width and the stiles span the full
 * height, so the corners are closed. On a narrow face both bands shrink so a
 * center panel remains. Returns nothing only when the opening cannot hold a step.
 */
export function shakerNotchPieces(openingW: number, openingH: number): ShakerNotchPiece[] {
  if (!(openingW > 0.04) || !(openingH > 0.04)) return [];
  const outer = Math.min(SHAKER_NOTCH_OUTER_IN * INCH, openingW / 8, openingH / 8);
  const inner = Math.min(SHAKER_NOTCH_INNER_IN * INCH, openingW / 8, openingH / 8);
  if (!(outer > 0.002) || !(inner > 0.002)) return [];
  if (outer + inner >= Math.min(openingW, openingH) / 2) return [];
  return [...ring(openingW, openingH, outer, 0, "outer"), ...ring(openingW, openingH, inner, outer, "inner")];
}

/** True when both bands form closed rings and the outer band meets every edge of the opening. */
export function shakerNotchRingIsComplete(openingW: number, openingH: number, pieces = shakerNotchPieces(openingW, openingH)): boolean {
  if (pieces.length !== 8) return false;
  const eps = 1e-6;
  for (const band of ["outer", "inner"] as const) {
    const group = pieces.filter((piece) => piece.band === band);
    if (new Set(group.map((piece) => piece.side)).size !== 4) return false;
    for (const piece of group) {
      if (Math.abs(piece.x) + piece.w / 2 > openingW / 2 + eps) return false;
      if (Math.abs(piece.y) + piece.h / 2 > openingH / 2 + eps) return false;
      if (!(piece.w > 0) || !(piece.h > 0)) return false;
    }
  }
  const outer = pieces.filter((piece) => piece.band === "outer");
  const top = outer.find((piece) => piece.side === "top")!;
  const bottom = outer.find((piece) => piece.side === "bottom")!;
  const left = outer.find((piece) => piece.side === "left")!;
  const right = outer.find((piece) => piece.side === "right")!;
  return Math.abs(top.w - openingW) < eps
    && Math.abs(bottom.w - openingW) < eps
    && Math.abs(left.h - openingH) < eps
    && Math.abs(right.h - openingH) < eps
    && Math.abs(top.y + top.h / 2 - openingH / 2) < eps
    && Math.abs(bottom.y - bottom.h / 2 + openingH / 2) < eps
    && Math.abs(left.x - left.w / 2 + openingW / 2) < eps
    && Math.abs(right.x + right.w / 2 - openingW / 2) < eps;
}

const notchMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

/**
 * Unlit door-colored shadow. Scene lights wash a standard material out on the
 * bottom and right edges, which is how the recess was only half visible.
 * Pale doors get a warm line; dark doors stay near-black.
 */
export function shakerNotchColor(faceColor: string, band: ShakerNotchBand = "outer"): string {
  const shade = new THREE.Color(faceColor);
  const luma = 0.2126 * shade.r + 0.7152 * shade.g + 0.0722 * shade.b;
  const pale = luma > 0.55;
  const factor = band === "outer" ? (pale ? 0.55 : 0.32) : (pale ? 0.74 : 0.5);
  shade.multiplyScalar(factor);
  return `#${shade.getHexString()}`;
}

export function shakerNotchMaterial(faceColor: string, band: ShakerNotchBand = "outer"): THREE.MeshBasicMaterial {
  const key = `${(faceColor.trim().toLowerCase() || "#ded5c1")}:${band}`;
  const cached = notchMaterialCache.get(key);
  if (cached) return cached;
  const material = new THREE.MeshBasicMaterial({
    color: shakerNotchColor(faceColor, band),
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  material.userData = { shakerNotchMaterial: true, shakerNotchBand: band, sharedShakerNotch: true };
  notchMaterialCache.set(key, material);
  return material;
}
