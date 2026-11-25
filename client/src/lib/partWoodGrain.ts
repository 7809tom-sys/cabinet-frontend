/**
 * Straight wood grain for each cabinet board.
 *
 * A frame-free grain photo is one vertical board of a known size (faceTileIn,
 * inches). The old path put that photo on a shared texture whose repeat was the
 * whole door, then mapped every mesh — rail, stile, side, toe kick — through
 * UV 0–1. A 2.75 in rail therefore showed the entire door's worth of grain,
 * squeezed and smeared. A second pass cropped each piece into a random window,
 * so neighboring boards also changed scale, phase, and which way the figure ran.
 *
 * This maps each face in real inches. The texture stays at repeat 1, rotation 0,
 * mirrored so a tile meets itself. Vertical grain (texture V, the lines in the
 * photo) runs up stiles, door panels, tall panels, and cabinet sides. It runs
 * along the length of rails, drawer-front rails, and the toe kick. A 12 in
 * drawer and a 36 in side use the same inches per tile.
 */
import * as THREE from "three";

export type PartGrainAxis = "vertical" | "horizontal";

export type PartGrainTile = {
  /** Inches across the grain (texture U). */
  across: number;
  /** Inches along the grain (texture V). */
  along: number;
};

/** Scene geometry is in feet. */
const INCHES_PER_SCENE_UNIT = 12;

type Vec3 = { x: number; y: number; z: number };

function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function lengthOf(v: Vec3) {
  return Math.hypot(v.x, v.y, v.z);
}

function normalise(v: Vec3): Vec3 {
  const length = lengthOf(v) || 1;
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function reject(v: Vec3, n: Vec3): Vec3 {
  const amount = dot(v, n);
  return { x: v.x - n.x * amount, y: v.y - n.y * amount, z: v.z - n.z * amount };
}

const UP: Vec3 = { x: 0, y: 1, z: 0 };
const RIGHT: Vec3 = { x: 1, y: 0, z: 0 };
const DEPTH: Vec3 = { x: 0, y: 0, z: 1 };

/**
 * Which way the grain runs on this board.
 * Rails, drawer-front rails, face-frame rails, and the toe kick are horizontal.
 * Stiles, door panels, tall panels, and cabinet sides are vertical.
 * Returns null for hardware, glass, seams, and anything that is not a wood board.
 */
export function partWoodGrainAxis(userData: Record<string, unknown> | null | undefined): PartGrainAxis | null {
  if (!userData) return null;
  if (
    userData.selectionOnly === true
    || userData.applianceSelectionHitbox === true
    || userData.cabinetHardware === true
    || userData.glassCabinetDoor === true
    || userData.glassCenter === true
    || userData.shakerOutline === true
    || userData.shakerFrameOutline === true
    || userData.shakerNotch === true
    || userData.cabinetDoorSeam === true
    || userData.carcassEdgeLines === true
  ) return null;
  if (
    userData.baseToeKick === true
    || userData.floorStandingToeKick === true
    || userData.selectedToeKickFinishSkin === true
  ) return "horizontal";
  if (userData.grainPiece === "rail" || userData.faceFrameEdge === "top" || userData.faceFrameEdge === "bottom") {
    return "horizontal";
  }
  if (
    userData.grainPiece === "stile"
    || userData.grainPiece === "panel"
    || userData.faceFrameEdge === "left"
    || userData.faceFrameEdge === "right"
    || userData.decorativeEndPanel === true
    || userData.decorativeEndToFloor === true
    || userData.cabinetSideToFloor === true
    || userData.selectedStyleSideSkin === true
    || userData.selectedFinishSideSkin === true
    || userData.carcassShell === true
    || userData.cabinetFront === true
    || userData.cabinetDrawerFront === true
    || userData.refrigeratorEndPanel === true
  ) return "vertical";
  return null;
}

/**
 * Slide along the grain only. The mirror join of the tile sits near the edges
 * of a centered board (phase about 1/2), not through the middle of the panel.
 * Scale and direction stay fixed. The hash only nudges that join a little, so
 * two stiles are not the same photograph.
 */
export function partGrainPhase(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const nudge = ((hash >>> 0) / 0xffffffff - 0.5) * 0.12;
  return 0.5 + nudge;
}

/**
 * One tile, axis-aligned. Repeat is 1 and rotation is 0; the mesh UVs carry
 * the inches and the direction. Mirrored wrapping meets the tile to itself.
 */
export function configurePartGrainTexture(map: THREE.Texture): void {
  map.wrapS = THREE.MirroredRepeatWrapping;
  map.wrapT = THREE.MirroredRepeatWrapping;
  map.repeat.set(1, 1);
  map.offset.set(0, 0);
  map.rotation = 0;
  map.center.set(0.5, 0.5);
  map.needsUpdate = true;
}

/**
 * Write per-face UVs so texture V (the grain lines) follows `axis` at `tile` inches.
 * Positions are scene feet. A second call with the same inputs writes the same UVs.
 */
export function applyPartWoodGrainUvs(
  geometry: THREE.BufferGeometry,
  axis: PartGrainAxis,
  tile: PartGrainTile,
  phase = 0,
): void {
  const position = geometry.getAttribute("position");
  const normalAttr = geometry.getAttribute("normal");
  if (!position || !normalAttr || !(tile.across > 0) || !(tile.along > 0)) return;
  let uv = geometry.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv || uv.count !== position.count || typeof uv.setXY !== "function") {
    uv = new THREE.Float32BufferAttribute(position.count * 2, 2);
    geometry.setAttribute("uv", uv);
  }
  const grainDir = axis === "horizontal" ? RIGHT : UP;
  const fallback = axis === "horizontal" ? UP : DEPTH;
  const spare = axis === "horizontal" ? DEPTH : RIGHT;
  for (let index = 0; index < position.count; index += 1) {
    const point: Vec3 = {
      x: position.getX(index) * INCHES_PER_SCENE_UNIT,
      y: position.getY(index) * INCHES_PER_SCENE_UNIT,
      z: position.getZ(index) * INCHES_PER_SCENE_UNIT,
    };
    const normal = normalise({
      x: normalAttr.getX(index),
      y: normalAttr.getY(index),
      z: normalAttr.getZ(index),
    });
    let along = reject(grainDir, normal);
    if (lengthOf(along) < 0.35) along = reject(fallback, normal);
    if (lengthOf(along) < 0.35) along = reject(spare, normal);
    along = normalise(along);
    const across = normalise(cross(normal, along));
    uv.setXY(index, dot(point, across) / tile.across, dot(point, along) / tile.along + phase);
  }
  uv.needsUpdate = true;
  geometry.userData = { ...geometry.userData, partWoodGrain: true, partWoodGrainAxis: axis };
}

export type PartWoodGrainOptions = {
  door: PartGrainTile;
  /** Drawer-front slab tile. Rails on a drawer still use the door tile. */
  drawer?: PartGrainTile | null;
  placementUid?: string | null;
};

/** Stamp every wood board under `root`. Returns how many meshes changed. */
export function applyPartWoodGrain(root: THREE.Object3D, options: PartWoodGrainOptions): number {
  if (!(options.door.across > 0) || !(options.door.along > 0)) return 0;
  const counters = new Map<string, number>();
  let count = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const axis = partWoodGrainAxis(mesh.userData as Record<string, unknown>);
    if (!axis) return;
    const material = mesh.material as THREE.MeshStandardMaterial;
    if (!material?.map || typeof material.map.repeat?.set !== "function") return;
    const drawerSlab = mesh.userData?.cabinetDrawerFront === true && mesh.userData?.grainPiece !== "rail" && mesh.userData?.grainPiece !== "stile";
    const tile = drawerSlab && options.drawer && options.drawer.across > 0 && options.drawer.along > 0
      ? options.drawer
      : options.door;
    const role = String(mesh.userData?.grainPiece ?? mesh.userData?.faceFrameEdge ?? (drawerSlab ? "drawer" : axis));
    const pieceIndex = counters.get(`${role}:${axis}`) ?? 0;
    counters.set(`${role}:${axis}`, pieceIndex + 1);
    const phase = partGrainPhase(`${options.placementUid ?? "cabinet"}|${role}|${pieceIndex}|${axis}`);
    applyPartWoodGrainUvs(mesh.geometry, axis, tile, phase);
    configurePartGrainTexture(material.map);
    if (material.normalMap) {
      material.normalMap.repeat.set(1, 1);
      material.normalMap.offset.set(0, 0);
      material.normalMap.rotation = 0;
      material.normalMap.center.set(0.5, 0.5);
      material.normalMap.needsUpdate = true;
    }
    mesh.userData = { ...mesh.userData, partWoodGrain: true, partWoodGrainAxis: axis };
    count += 1;
  });
  return count;
}
