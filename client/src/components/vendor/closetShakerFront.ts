import * as THREE from "three";
import { DLC_FRAME_DETAIL } from "@shared/dlcFr26Textures";
import { threeDShakerRailThickness } from "@/lib/shakerRail";

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
export const CLOSET_SLAB_BELOW_IN = 7;

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
  const width = widthIn * IN;
  const height = heightIn * IN;
  const members = closetDlShakerMembers(widthIn, heightIn);
  const railDepth = DLC_FRAME_DETAIL.railDepth;
  const railZ = (railDepth - DLC_FRAME_DETAIL.standardRailDepth) / 2;
  if (members.slab) {
    // Too small for a 2.75in frame: one plain flat slab in the same finish.
    const slabMaterial = new THREE.MeshStandardMaterial({ color: finishHex, roughness: 0.55, metalness: 0.02 });
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
  // Same finish as the rails. The center sits behind them, so it is shaded a
  // step darker. That is the recess the kitchen gets from rail depth; this
  // closet rig otherwise washes a same-color step flat. No glass, no photo.
  const panelMaterial = new THREE.MeshStandardMaterial({ color: finishHex, roughness: 0.85, metalness: 0 });
  panelMaterial.color.multiplyScalar(0.8);
  panelMaterial.toneMapped = false;
  const railMaterial = new THREE.MeshStandardMaterial({ color: finishHex, roughness: 0.55, metalness: 0.02 });
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

  // Crisp shadow line inside the opening: thin unlit strips just in front of
  // the center slab. They read as the recess the rail depth gives the kitchen.
  const openingWidth = Math.max(0.01, width - stile * 2);
  const openingHeight = Math.max(0.01, height - rail * 2);
  const stripZ = center.position.z + panelDepth / 2 + 0.0015;
  const stripDepth = 0.002;
  const maxStrip = Math.min(openingWidth, openingHeight) / 3;
  const addStrip = (
    kind: "shadow" | "highlight",
    stripWidth: number,
    stripHeight: number,
    x: number,
    y: number,
    opacity: number,
  ) => {
    const material = new THREE.MeshBasicMaterial({
      color: kind === "shadow" ? 0x000000 : 0xffffff,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const strip = new THREE.Mesh(new THREE.BoxGeometry(stripWidth, stripHeight, stripDepth), material);
    strip.position.set(x, y, stripZ);
    strip.userData = { closetShadowLine: kind };
    group.add(strip);
  };
  const topEdge = openingHeight / 2;
  const bottomEdge = -openingHeight / 2;
  const leftEdge = -openingWidth / 2;
  const rightEdge = openingWidth / 2;
  const hardThickness = Math.min(0.35 * IN, maxStrip);
  const softThickness = Math.min(0.8 * IN, maxStrip);
  const highlightThickness = Math.min(0.12 * IN, maxStrip);
  // Hard shadow: top and left.
  addStrip("shadow", openingWidth, hardThickness, 0, topEdge - hardThickness / 2, 0.45);
  addStrip("shadow", hardThickness, openingHeight, leftEdge + hardThickness / 2, 0, 0.45);
  // Softer shadow: top and left.
  addStrip("shadow", openingWidth, softThickness, 0, topEdge - softThickness / 2, 0.18);
  addStrip("shadow", softThickness, openingHeight, leftEdge + softThickness / 2, 0, 0.18);
  // Highlight: bottom and right.
  addStrip("highlight", openingWidth, highlightThickness, 0, bottomEdge + highlightThickness / 2, 0.14);
  addStrip("highlight", highlightThickness, openingHeight, rightEdge - highlightThickness / 2, 0, 0.14);

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
