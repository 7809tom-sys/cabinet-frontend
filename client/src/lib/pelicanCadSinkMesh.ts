/**
 * Places a converted Pelican drawing into the designer room.
 *
 * The GLB keeps the CAD coordinate system. This turns it upright (the short
 * axis is the bowl depth), puts the longer plan axis across the cabinet, and
 * sits the rim on the countertop. A failed load leaves the parametric basin.
 *
 * The rim is lifted a hair above the stone, the way the built-in basin's rim
 * is, so the two surfaces never share a depth and flicker. An apron-front
 * drawing is turned and slid so its apron face lands on the same plane as the
 * built-in apron, which is the cabinet front.
 */

import * as THREE from "three";
import { designerPelicanCadModel, pelicanCadInchesPerUnit } from "./pelicanCadModels";
import type { PelicanCadAsset } from "./pelicanCadCatalog";

const INCH = 1 / 12;

/**
 * Height of the drawing's rim above the countertop, in feet. Matches the lift
 * the built-in basin gives its rim; a rim exactly flush with the stone
 * z-fights with it.
 */
export const MANUFACTURER_SINK_RIM_LIFT_FT = 0.018;

const prepared = new Map<string, THREE.Object3D>();
const pending = new Map<string, Promise<THREE.Object3D>>();

function worldPoints(root: THREE.Object3D): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const position = mesh.geometry?.getAttribute?.("position");
    if (!mesh.isMesh || !position) return;
    for (let index = 0; index < position.count; index += 1) {
      points.push(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)).applyMatrix4(mesh.matrixWorld));
    }
  });
  return points;
}

function seatOnCounter(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= bounds.max.y;
}

/**
 * A sink drawing can be stored bowl-down. The flange is the wide end and the
 * bowl floor is the narrow end, so the wide end has to be the rim on the counter.
 */
function flangeIsAtTheBottom(root: THREE.Object3D): boolean {
  const points = worldPoints(root);
  if (points.length < 12) return false;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const height = maxY - minY;
  if (height < 1e-6) return false;
  const span = (limit: (point: THREE.Vector3) => boolean) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let count = 0;
    for (const point of points) {
      if (!limit(point)) continue;
      count += 1;
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minZ = Math.min(minZ, point.z);
      maxZ = Math.max(maxZ, point.z);
    }
    if (count < 3) return 0;
    return (maxX - minX) * (maxZ - minZ);
  };
  const top = span((point) => point.y > maxY - height * 0.2);
  const bottom = span((point) => point.y < minY + height * 0.2);
  return bottom > top * 1.15;
}

export function orientManufacturerSink(root: THREE.Object3D, inchesPerUnit: number): void {
  root.scale.setScalar(inchesPerUnit * INCH);
  root.updateMatrixWorld(true);
  const sized = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const up = (["x", "y", "z"] as const).reduce((best, axis) => (sized[axis] < sized[best] ? axis : best));
  if (up === "z") root.rotateX(-Math.PI / 2);
  else if (up === "x") root.rotateZ(Math.PI / 2);
  root.updateMatrixWorld(true);
  const flat = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  if (flat.z > flat.x + 1e-6) root.rotateY(Math.PI / 2);
  seatOnCounter(root);
  if (flangeIsAtTheBottom(root)) {
    root.rotateX(Math.PI);
    seatOnCounter(root);
  }
  root.userData.manufacturerApronSign = apronSideOf(root);
}

/**
 * Which plan side of an oriented drawing carries a full-height apron: +1 for
 * +Z, -1 for -Z, 0 when neither side does (a drop-in or undermount basin).
 * The apron is the Z edge whose geometry runs most of the way down to the
 * bottom; the back edge of a fireclay apron-front sink only carries the top
 * flange. A drop-in or undermount basin hangs inside its flange, so neither
 * edge reaches down.
 */
export function apronSideOf(root: THREE.Object3D): -1 | 0 | 1 {
  const points = worldPoints(root);
  if (points.length < 12) return 0;
  const bounds = new THREE.Box3().setFromPoints(points);
  const height = bounds.max.y - bounds.min.y;
  const depth = bounds.max.z - bounds.min.z;
  if (height < 1e-6 || depth < 1e-6) return 0;
  // A manufacturer sink's top flange overhangs its body, so the extreme 1 inch
  // is only flange and every edge read there looks like it stops at the rim.
  // PL-HA117 R0 16g was read as "no apron" exactly that way, which left its
  // drawing unturned on a side wall. The band reaches past the overhang to the
  // body it is meant to measure.
  const band = Math.min(2.5 * INCH, depth * 0.2);
  let lowFront = Infinity;
  let lowBack = Infinity;
  for (const point of points) {
    if (point.z > bounds.max.z - band) lowFront = Math.min(lowFront, point.y);
    if (point.z < bounds.min.z + band) lowBack = Math.min(lowBack, point.y);
  }
  const reach = (low: number) => (Number.isFinite(low) ? (bounds.max.y - low) / height : 0);
  const front = reach(lowFront);
  const back = reach(lowBack);
  if (front > 0.75 && front - back > 0.4) return 1;
  if (back > 0.75 && back - front > 0.4) return -1;
  // A box-shaped apron sink (the stainless farmhouse drawings) is full height
  // front and back; either long face can be the apron.
  if (front > 0.75 && back > 0.75) return 1;
  return 0;
}

function finishMaterial(asset: PelicanCadAsset): THREE.MeshPhysicalMaterial {
  const granite = asset.fileType === "step";
  return new THREE.MeshPhysicalMaterial({
    color: granite ? "#d7d2cb" : "#c5ced3",
    metalness: granite ? 0.04 : 0.45,
    roughness: granite ? 0.42 : 0.32,
    clearcoat: granite ? 0.08 : 0.2,
    // The converted STEP/DWG meshes do not have reliable winding, so both
    // sides stay drawn. The offset lets the sink win any depth tie with the
    // countertop edge or the cabinet face it sits against.
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

function paint(root: THREE.Object3D, asset: PelicanCadAsset): void {
  const material = finishMaterial(asset);
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
    // The sink still shades the cabinet and floor, but it does not take shadow
    // on its own double-sided faces: that self-shadow is the shimmer on the
    // apron and rim.
    mesh.castShadow = true;
    mesh.receiveShadow = false;
  });
}

async function loadPrepared(asset: PelicanCadAsset): Promise<THREE.Object3D> {
  const url = asset.glbUrl;
  if (!url || !asset.unit) throw new Error("This drawing has no designer mesh.");
  const ready = prepared.get(url);
  if (ready) return ready;
  const inflight = pending.get(url);
  if (inflight) return inflight;
  const task = (async () => {
    const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader().loadAsync(url);
    const root = new THREE.Group();
    root.add(gltf.scene);
    paint(gltf.scene, asset);
    orientManufacturerSink(root, pelicanCadInchesPerUnit(asset.unit!));
    prepared.set(url, root);
    pending.delete(url);
    return root;
  })().catch((error) => {
    pending.delete(url);
    throw error;
  });
  pending.set(url, task);
  return task;
}

const PARAMETRIC_SINK_REPLACED_FLAGS = [
  "sinkRim",
  "sinkApronFront",
] as const;

/**
 * The drawing supplies the rim and the apron, which sit on or above the stone.
 * Its basin hangs below the countertop and inside the closed cabinet box, so
 * normal depth testing hides it: replacing the measured bowl as well leaves the
 * sink reading as an empty hole with the cabinet's wood top showing through it
 * (owner report, Nov 26 2026). The measured bowl, floor and drain stay, clipped
 * to the counter opening, so the sink keeps its interior.
 */
export function hideParametricBasin(holder: THREE.Object3D, ownedNodes: readonly THREE.Object3D[]): void {
  for (const node of ownedNodes) {
    if (node === holder) continue;
    node.traverse((child) => {
      const data = child.userData as Record<string, unknown>;
      if (PARAMETRIC_SINK_REPLACED_FLAGS.some((flag) => data[flag] === true)) child.visible = false;
    });
  }
}

/**
 * The built-in apron slab, in the holder's frame. Holder and apron share a
 * parent and the holder is never rotated, so the apron's local matrix minus
 * the holder's position is enough.
 */
function parametricApronBox(holderPosition: THREE.Vector3, ownedNodes: readonly THREE.Object3D[]): THREE.Box3 | null {
  for (const node of ownedNodes) {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || (mesh.userData as Record<string, unknown>).sinkApronFront !== true) continue;
    const geometry = mesh.geometry;
    if (!geometry) continue;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) continue;
    mesh.updateMatrix();
    return geometry.boundingBox.clone().applyMatrix4(mesh.matrix).translate(holderPosition.clone().negate());
  }
  return null;
}

type FrontDirection = { axis: "x" | "z"; sign: 1 | -1 };

/** The apron's thin axis is the one that points into the room. */
function apronFrontDirection(apron: THREE.Box3): FrontDirection {
  const size = apron.getSize(new THREE.Vector3());
  const center = apron.getCenter(new THREE.Vector3());
  const axis = size.x < size.z ? "x" : "z";
  return { axis, sign: center[axis] < -1e-6 ? -1 : 1 };
}

/**
 * Wraps a prepared drawing so it faces the cabinet front. An apron-front
 * drawing is turned until its apron points the way the built-in apron does,
 * then slid along that axis until the two apron faces are on one plane. The
 * lateral centering stays on the sink center. Any other drawing keeps its
 * authored orientation, except that it must still lie along the run: on a left
 * or right wall its long plan axis would otherwise point across the counter and
 * the sink would hang out of the cabinet.
 */
export function placeManufacturerSink(
  template: THREE.Object3D,
  holderPosition: THREE.Vector3,
  ownedNodes: readonly THREE.Object3D[],
  wallSide?: string | null,
): THREE.Object3D {
  const pivot = new THREE.Group();
  pivot.name = "pelican-manufacturer-cad-pivot";
  pivot.add(template.clone(true));
  const apronSign = (template.userData as Record<string, unknown>).manufacturerApronSign;
  const apron = parametricApronBox(holderPosition, ownedNodes);
  if (!apron || (apronSign !== 1 && apronSign !== -1)) {
    // Drawings are authored with their long plan axis on X, which is the run
    // direction on a top or bottom wall. On a side wall the run is Z, so a
    // drop-in or undermount drawing that never had an apron to align (and a
    // farm drawing whose apron could not be read) stayed across the counter —
    // the left-wall sink hanging out of the cabinet (owner report, Nov 28 2026).
    // Turn it so its long axis and its front follow the wall, exactly like the
    // parametric basin under it.
    if (wallSide === "left" || wallSide === "right") {
      pivot.rotation.y = Math.PI / 2;
      pivot.userData = { manufacturerPlanTurn: true, wallSide };
    }
    return pivot;
  }
  const front = apronFrontDirection(apron);
  // Turning by t about Y sends +Z to (sin t, 0, cos t).
  const facing = front.axis === "z"
    ? (front.sign === 1 ? 0 : Math.PI)
    : (front.sign === 1 ? Math.PI / 2 : -Math.PI / 2);
  pivot.rotation.y = facing + (apronSign === -1 ? Math.PI : 0);
  pivot.updateMatrixWorld(true);
  const drawn = new THREE.Box3().setFromObject(pivot);
  const drawnFace = front.sign === 1 ? drawn.max[front.axis] : drawn.min[front.axis];
  const apronFace = front.sign === 1 ? apron.max[front.axis] : apron.min[front.axis];
  const lateral = front.axis === "z" ? "x" : "z";
  pivot.position[front.axis] += apronFace - drawnFace;
  pivot.position[lateral] -= (drawn.min[lateral] + drawn.max[lateral]) / 2;
  pivot.userData = { manufacturerApronAligned: true, apronAxis: front.axis, apronSign: front.sign };
  return pivot;
}

export type ManufacturerSinkAnchor = {
  pelicanCode?: string | null;
  pelicanProfileId?: string | null;
  pelicanProductName?: string | null;
  /** The wall the sink base sits on; a side wall turns a drawing that has no apron. */
  wallSide?: string | null;
  /** World position of the basin center, in feet, with y at the countertop. */
  x: number;
  y: number;
  z: number;
};

/**
 * Adds the manufacturer mesh when one is ready. Returns false when the
 * parametric basin should remain the only geometry. Browser-only: tests and
 * the server render the measured basin.
 */
export function attachPelicanManufacturerSink(
  sink: ManufacturerSinkAnchor,
  addNode: (node: THREE.Object3D) => void,
  ownedNodes: readonly THREE.Object3D[],
): PelicanCadAsset | null {
  if (typeof window === "undefined") return null;
  const asset = designerPelicanCadModel(sink);
  if (!asset?.glbUrl) return null;
  const holder = new THREE.Group();
  holder.name = "pelican-manufacturer-cad";
  holder.position.set(sink.x, sink.y + MANUFACTURER_SINK_RIM_LIFT_FT, sink.z);
  holder.userData = {
    manufacturerCadSink: true,
    pelicanCadSku: asset.sku,
    pelicanCadSlug: asset.slug,
    pelicanCadGlb: asset.glbUrl,
    manufacturerCadLoaded: false,
  };
  addNode(holder);
  const show = (template: THREE.Object3D) => {
    if (!holder.parent) return;
    holder.add(placeManufacturerSink(template, holder.position, ownedNodes, sink.wallSide));
    holder.userData.manufacturerCadLoaded = true;
    hideParametricBasin(holder, ownedNodes);
  };
  const cached = prepared.get(asset.glbUrl);
  if (cached) show(cached);
  else {
    void loadPrepared(asset).then(show).catch(() => {
      holder.userData.manufacturerCadFailed = true;
    });
  }
  return asset;
}

