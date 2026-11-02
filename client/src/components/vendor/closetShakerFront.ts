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

export type ClosetShakerRole = "door" | "drawer";

export function closetDlShakerMembers(widthIn: number, heightIn: number) {
  const width = widthIn * IN;
  const height = heightIn * IN;
  // One thickness for rails and stiles, from the kitchen DL helper.
  let frameIn = threeDShakerRailThickness(width, height, CLOSET_DL_SHAKER_FRAME_IN) / IN;
  // A 5 inch small drawer cannot hold two 2.75 inch rails and a center slab.
  // The helper already shrinks a too-small face; keep a flat center if it would vanish.
  const minCenter = 1.5;
  if (heightIn - frameIn * 2 < minCenter) frameIn = Math.max(0.4, (heightIn - minCenter) / 2);
  if (widthIn - frameIn * 2 < minCenter) frameIn = Math.max(0.4, (widthIn - minCenter) / 2);
  return {
    railIn: frameIn,
    stileIn: frameIn,
    centerWidthIn: Math.max(0, widthIn - frameIn * 2),
    centerHeightIn: Math.max(0, heightIn - frameIn * 2),
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
  const rail = members.railIn * IN;
  const stile = members.stileIn * IN;
  const railDepth = DLC_FRAME_DETAIL.railDepth;
  const panelDepth = 0.012;
  // Same finish as the rails. The center sits behind them, so it is shaded a
  // step darker. That is the recess the kitchen gets from rail depth; this
  // closet rig otherwise washes a same-color step flat. No glass, no photo.
  const panelMaterial = new THREE.MeshStandardMaterial({ color: finishHex, roughness: 0.9, metalness: 0 });
  panelMaterial.color.multiplyScalar(0.42);
  panelMaterial.toneMapped = false;
  const railMaterial = new THREE.MeshStandardMaterial({ color: finishHex, roughness: 0.5, metalness: 0.02 });
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
  };

  const center = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.01, width - stile * 2), Math.max(0.01, height - rail * 2), panelDepth),
    panelMaterial,
  );
  center.position.z = -0.028;
  center.userData = { dlShakerCenterSlab: true, flatRecessedPanel: true, squareCorner: true };
  group.add(center);

  const pieces = [
    [width, rail, 0, height / 2 - rail / 2],
    [width, rail, 0, -height / 2 + rail / 2],
    [stile, Math.max(0.02, height - rail * 2), -width / 2 + stile / 2, 0],
    [stile, Math.max(0.02, height - rail * 2), width / 2 - stile / 2, 0],
  ] as const;
  for (const [pieceWidth, pieceHeight, x, y] of pieces) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(pieceWidth, pieceHeight, railDepth), railMaterial);
    mesh.position.set(x, y, (railDepth - DLC_FRAME_DETAIL.standardRailDepth) / 2);
    mesh.userData = { physicalRail: true, selectedStyleFace: "shaker", squareCorner: true };
    group.add(mesh);
  }
  return group;
}
