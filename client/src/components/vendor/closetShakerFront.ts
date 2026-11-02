import * as THREE from "three";
import { DLC_FRAME_DETAIL } from "@shared/dlcFr26Textures";
import { SHAKER_PLAIN_SLAB_BELOW_IN } from "@shared/shakerDoorBlueprint";
import { threeDShakerRailThickness } from "@/lib/shakerRail";
import { SHAKER_NOTCH_THICKNESS, shakerNotchMaterial, shakerNotchPieces } from "@/components/design/shakerNotch";

const IN = 1 / 12;

/**
 * Verified frame width for closet fronts. The Designer reads this from the
 * door-style record and otherwise uses 3 inches. Tom's closet fronts use 2.75
 * inches, passed through the same DL thickness helper.
 */
export const CLOSET_DL_SHAKER_FRAME_IN = 2.75;

/**
 * Two 2.75in rails plus a 1.5in center need 7in (Tom, Nov 1 2026). A front
 * shorter or narrower than this renders as a plain flat slab instead.
 */
export const CLOSET_SLAB_BELOW_IN = SHAKER_PLAIN_SLAB_BELOW_IN;

/**
 * Reveal taken off each side of a slab front so stacked slabs (e.g. drawer
 * fronts exactly 5in apart) do not merge into one surface. Centered, so the
 * slab shrinks by 1/8in in width and height.
 */
export const CLOSET_SLAB_REVEAL_IN = 0.125;

export type ClosetShakerRole = "door" | "drawer";

export function closetFrontIsSlab(widthIn: number, heightIn: number) {
  return heightIn < CLOSET_SLAB_BELOW_IN || widthIn < CLOSET_SLAB_BELOW_IN;
}

export function closetDlShakerMembers(widthIn: number, heightIn: number) {
  if (closetFrontIsSlab(widthIn, heightIn)) {
    return {
      railIn: 0,
      stileIn: 0,
      centerWidthIn: widthIn,
      centerHeightIn: heightIn,
      slab: true,
    };
  }
  const width = widthIn * IN;
  const height = heightIn * IN;
  // One thickness for rails and stiles, from the kitchen DL helper.
  const frameIn = threeDShakerRailThickness(width, height, CLOSET_DL_SHAKER_FRAME_IN) / IN;
  return {
    railIn: frameIn,
    stileIn: frameIn,
    centerWidthIn: Math.max(0, widthIn - frameIn * 2),
    centerHeightIn: Math.max(0, heightIn - frameIn * 2),
    slab: false,
  };
}

/**
 * Five-piece DL shaker front: four square box rails/stiles and one flat
 * recessed center. No glass, no bevel, no rounded corners, no photo stretch.
 * Piece layout matches addShakerFrame in the kitchen Designer (full-width
 * rails, stiles between them, DL rail depth standing proud of the panel).
 */
export function createClosetDlShakerFront(widthIn: number, heightIn: number, finishHex: string, role: ClosetShakerRole) {
  // Paint the finish that was asked for. The brand-swatch snap turned Slate
  // Rift (#555553) and other grays into brand green #244338.
  const surfaceHex = finishHex;
  const width = widthIn * IN;
  const height = heightIn * IN;
  const members = closetDlShakerMembers(widthIn, heightIn);
  const railDepth = DLC_FRAME_DETAIL.railDepth;
  const railZ = (railDepth - DLC_FRAME_DETAIL.standardRailDepth) / 2;
  if (members.slab) {
    // Too small for a 2.75in frame: one plain flat slab in the same finish.
    const slabMaterial = new THREE.MeshStandardMaterial({ color: surfaceHex, roughness: 0.55, metalness: 0.02 });
    slabMaterial.toneMapped = false;
    const group = new THREE.Group();
    group.name = "dl-slab-front";
    group.userData = {
      dlShakerBlueprint: true,
      selectedStyleFace: "slab",
      physicalRails: false,
      faceRole: role,
      glassDoor: false,
      panelConstruction: "slab",
      insideEdgeProfile: "square",
      frameInches: CLOSET_DL_SHAKER_FRAME_IN,
      railIn: 0,
      stileIn: 0,
      dlShakerPieces: 1,
      slabFront: true,
      slabRevealIn: CLOSET_SLAB_REVEAL_IN,
    };
    const slabWidth = width - CLOSET_SLAB_REVEAL_IN * IN;
    const slabHeight = height - CLOSET_SLAB_REVEAL_IN * IN;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(slabWidth, slabHeight, railDepth), slabMaterial);
    slab.position.z = railZ;
    slab.userData = { slabFront: true, squareCorner: true };
    group.add(slab);
    return group;
  }
  const rail = members.railIn * IN;
  const stile = members.stileIn * IN;
  const panelDepth = 0.012;
  // Same door color as the rails. The shared shaker notch, not a darker panel,
  // is what makes the recess read. No glass, no photo.
  const panelMaterial = new THREE.MeshStandardMaterial({ color: surfaceHex, roughness: 0.55, metalness: 0.02 });
  panelMaterial.toneMapped = false;
  const railMaterial = new THREE.MeshStandardMaterial({ color: surfaceHex, roughness: 0.55, metalness: 0.02 });
  railMaterial.toneMapped = false;
  const group = new THREE.Group();
  group.name = "dl-shaker-front";
  group.userData = {
    dlShakerBlueprint: true,
    selectedStyleFace: "shaker",
    physicalRails: true,
    faceRole: role,
    glassDoor: false,
    panelConstruction: "flat",
    insideEdgeProfile: "square",
    frameInches: CLOSET_DL_SHAKER_FRAME_IN,
    railIn: members.railIn,
    stileIn: members.stileIn,
    dlShakerPieces: 5,
  };

  const center = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.01, width - stile * 2), Math.max(0.01, height - rail * 2), panelDepth),
    panelMaterial,
  );
  center.position.z = -0.028;
  center.userData = { dlShakerCenterSlab: true, flatRecessedPanel: true, squareCorner: true };
  group.add(center);

  // Same four-sided notch the kitchen Designer uses for the DL shaker blueprint.
  const openingWidth = Math.max(0.01, width - stile * 2);
  const openingHeight = Math.max(0.01, height - rail * 2);
  const notchZ = center.position.z + panelDepth / 2 + SHAKER_NOTCH_THICKNESS / 2;
  for (const piece of shakerNotchPieces(openingWidth, openingHeight)) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(piece.w, piece.h, SHAKER_NOTCH_THICKNESS),
      shakerNotchMaterial(surfaceHex, piece.band),
    );
    mesh.position.set(piece.x, piece.y, notchZ);
    mesh.userData = { shakerNotch: true, shakerNotchSide: piece.side, shakerNotchBand: piece.band };
    group.add(mesh);
  }

  const pieces = [
    [width, rail, 0, height / 2 - rail / 2],
    [width, rail, 0, -height / 2 + rail / 2],
    [stile, Math.max(0.02, height - rail * 2), -width / 2 + stile / 2, 0],
    [stile, Math.max(0.02, height - rail * 2), width / 2 - stile / 2, 0],
  ] as const;
  for (const [pieceWidth, pieceHeight, x, y] of pieces) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(pieceWidth, pieceHeight, railDepth), railMaterial);
    mesh.position.set(x, y, railZ);
    mesh.userData = { physicalRail: true, selectedStyleFace: "shaker", squareCorner: true };
    group.add(mesh);
  }
  return group;
}
