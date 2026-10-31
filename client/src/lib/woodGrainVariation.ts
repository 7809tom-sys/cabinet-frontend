/**
 * Per-piece wood grain for doors, drawer fronts, panels, and cabinet boxes.
 *
 * Door and drawer faces share one sample image. BoxGeometry maps that image
 * across UV 0–1, and the Designer used one repeat/offset for every face, so
 * every door showed the same knot in the same place.
 *
 * Each piece keeps that shared image (no extra bitmap) and receives its own
 * UV window: a deterministic offset, a small uniform scale change, and a
 * mirror and/or 180° turn. Those flips stay on the grain axis, so vertical
 * grain stays vertical and horizontal grain stays horizontal. Rails that the
 * catalog marks as horizontal still use their existing texture rotation.
 *
 * The seed is the cabinet placement id plus the piece role and index, so a
 * reopened design matches. Door Rendering Audit passes the style id as the
 * placement id, so a style renders the same way every run and two styles do
 * not share one crop.
 */
import * as THREE from "three";

export type WoodGrainDirection = "vertical-stiles-horizontal-rails" | "vertical" | "horizontal" | "none" | null;

export type ThreeDPieceGrainTransform = {
  /** Mesh UV at the geometry's 0 corner. Greater than u1 when the piece is mirrored. */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Window origin before mirroring, in mesh UV space. */
  offsetX: number;
  offsetY: number;
  /** Uniform scale of the sampled window. Equal on both axes so knots are not stretched. */
  repeatX: number;
  repeatY: number;
  flipX: boolean;
  flipY: boolean;
  /** 0 or π. A quarter turn would lay vertical grain sideways. */
  rotation: 0 | number;
};

export type ThreeDPieceGrainSeed = {
  placementUid?: string | null;
  sampleUrl?: string | null;
  role: string;
  pieceIndex: number;
  grainDirection?: WoodGrainDirection;
  /** Full-bleed repeating board, as opposed to a center crop of a door photograph. */
  curated?: boolean;
};

const PHOTO_SPAN_MIN = 0.42;
const PHOTO_SPAN_MAX = 0.64;
const CURATED_SPAN_MIN = 0.92;
const CURATED_SPAN_MAX = 1.08;

function hashChannels(source: string, count: number): number[] {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  const channels: number[] = [];
  for (let index = 0; index < count; index += 1) {
    state = Math.imul(state ^ (0x9e3779b9 + index), 2246822519) >>> 0;
    channels.push(state / 0xffffffff);
  }
  return channels;
}

function mix(unit: number, min: number, max: number): number {
  return min + unit * (max - min);
}

/**
 * Stable crop for one door, drawer, panel, or box face.
 * The same inputs always return the same window. Neighboring piece indexes do not.
 */
export function threeDPieceGrainTransform(input: ThreeDPieceGrainSeed): ThreeDPieceGrainTransform {
  const curated = input.curated === true;
  const source = [
    input.placementUid?.trim() || "legacy-cabinet",
    input.sampleUrl?.trim() || "finish",
    input.role.trim() || "door",
    String(Math.trunc(input.pieceIndex)),
    input.grainDirection ?? "vertical",
    curated ? "curated" : "photo",
  ].join("|");
  const [spanUnit, slideX, slideY, flipXUnit, flipYUnit, turnUnit] = hashChannels(source, 6);
  const span = curated
    ? mix(spanUnit, CURATED_SPAN_MIN, CURATED_SPAN_MAX)
    : mix(spanUnit, PHOTO_SPAN_MIN, PHOTO_SPAN_MAX);
  const piece = Math.abs(Math.trunc(input.pieceIndex));
  // Step adjacent pieces across the board, then let the hash pick the exact crop.
  // A door photo stays inside the center grain. A repeating board may cross the
  // tile edge; RepeatWrapping shows the next part of the same image.
  const offsetX = curated
    ? (piece * 0.47 + slideX) % 1
    : ((piece * 0.5 + slideX * 0.5) % 1) * Math.max(0, 1 - span);
  const offsetY = curated
    ? ((piece * 0.17 + slideY * 0.36) % 1)
    : ((piece * 0.37 + slideY * 0.63) % 1) * Math.max(0, 1 - span);
  const flipX = flipXUnit >= 0.5;
  const flipY = flipYUnit >= 0.62;
  const rotation = turnUnit >= 0.84 ? Math.PI : 0;
  let u0 = offsetX;
  let v0 = offsetY;
  let u1 = offsetX + span;
  let v1 = offsetY + span;
  if (flipX) [u0, u1] = [u1, u0];
  if (flipY) [v0, v1] = [v1, v0];
  if (rotation === Math.PI) {
    [u0, u1] = [u1, u0];
    [v0, v1] = [v1, v0];
  }
  return {
    u0,
    v0,
    u1,
    v1,
    offsetX,
    offsetY,
    repeatX: span,
    repeatY: span,
    flipX,
    flipY,
    rotation,
  };
}

/** Remap a mesh's existing UVs into the piece window. A second call is a no-op. */
export function applyThreeDPieceGrainUv(geometry: THREE.BufferGeometry, transform: ThreeDPieceGrainTransform): void {
  if (geometry.userData?.woodGrainStamped === true) return;
  const uv = geometry.getAttribute("uv");
  if (!uv || typeof uv.getX !== "function" || typeof uv.setXY !== "function") return;
  const du = transform.u1 - transform.u0;
  const dv = transform.v1 - transform.v0;
  for (let index = 0; index < uv.count; index += 1) {
    uv.setXY(index, transform.u0 + uv.getX(index) * du, transform.v0 + uv.getY(index) * dv);
  }
  uv.needsUpdate = true;
  geometry.userData = {
    ...geometry.userData,
    woodGrainStamped: true,
    woodGrainTransform: transform,
  };
}

export type CabinetPieceGrainOptions = {
  placementUid?: string | null;
  sampleUrl?: string | null;
  grainDirection?: WoodGrainDirection;
  curated?: boolean;
  sourceTexture: THREE.Texture | null;
};

function materialOf(mesh: THREE.Mesh): THREE.MeshStandardMaterial | null {
  const material = mesh.material;
  if (!material || Array.isArray(material)) return null;
  if (!(material instanceof THREE.Material)) return null;
  return material as THREE.MeshStandardMaterial;
}

function grainRole(mesh: THREE.Mesh, material: THREE.MeshStandardMaterial): string {
  const piece = mesh.userData?.grainPiece ?? material.userData?.grainPiece;
  if (piece === "rail" || piece === "stile" || piece === "panel") return piece;
  if (piece === "slab") return "door";
  if (material.userData?.selectedFinishStructuralSurface === true) return "box";
  if (
    mesh.userData?.cabinetDrawerFront === true
    || mesh.userData?.vanityDrawerFront === true
    || mesh.userData?.falseDrawerFront === true
    || mesh.userData?.ovenCabinetDrawer === true
  ) return "drawer";
  if (mesh.userData?.decorativeEndPanel === true) return "end-panel";
  if (mesh.userData?.raisedCenterPanel === true || mesh.userData?.raisedPanelBevel === true) return "panel";
  return "door";
}

function usesSharedDoorGrain(mesh: THREE.Mesh, source: THREE.Texture): boolean {
  if (mesh.userData?.selectionOnly === true || mesh.userData?.applianceSelectionHitbox === true) return false;
  if (mesh.userData?.glassCabinetDoor === true || mesh.userData?.glassCenter === true || mesh.userData?.originalProductVisual === true) return false;
  if (mesh.userData?.woodGrainStamped === true) return false;
  const material = materialOf(mesh);
  if (!material?.map) return false;
  if (mesh.geometry?.userData?.woodGrainStamped === true) return false;
  // Carcass, toe kick, crown, and end skins stay a solid finish. A per-cabinet
  // UV window would slide a door photograph onto the box, including the back.
  if (material.userData?.selectedFinishStructuralSurface === true) return false;
  if (mesh.userData?.decorativeEndPanel === true && mesh.userData?.decorativeEndIsDoor !== true) return false;
  if (typeof material.userData?.grainPiece === "string" || typeof mesh.userData?.grainPiece === "string") return true;
  return material.map === source;
}

/**
 * Assign a unique, repeatable grain window to every wood face under `root`.
 * Materials and the source image stay shared. Only the piece geometry's UVs change.
 */
export function applyThreeDCabinetPieceGrain(root: THREE.Object3D, options: CabinetPieceGrainOptions): void {
  const source = options.sourceTexture;
  if (!source) return;
  // A combined swatch is already cropped to one face. A second UV window would
  // zoom into a knot and can pull the drawer/door seam back into view.
  if (source.userData?.combinedFaceWindow) return;
  const curated = options.curated === true
    || source.userData?.curatedCabinetFinish === true
    || /rustic_hickory_vertical_grain/i.test(options.sampleUrl ?? "");
  const counters = new Map<string, number>();
  const meshes: THREE.Mesh[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !usesSharedDoorGrain(mesh, source)) return;
    meshes.push(mesh);
  });
  for (const mesh of meshes) {
    const material = materialOf(mesh);
    if (!material) continue;
    const role = grainRole(mesh, material);
    const pieceIndex = counters.get(role) ?? 0;
    counters.set(role, pieceIndex + 1);
    const transform = threeDPieceGrainTransform({
      placementUid: options.placementUid,
      sampleUrl: options.sampleUrl,
      role,
      pieceIndex,
      grainDirection: options.grainDirection ?? null,
      curated,
    });
    applyThreeDPieceGrainUv(mesh.geometry, transform);
    mesh.userData = {
      ...mesh.userData,
      woodGrainStamped: true,
      woodGrainRole: role,
      woodGrainPieceIndex: pieceIndex,
      woodGrainTransform: transform,
    };
  }
}
