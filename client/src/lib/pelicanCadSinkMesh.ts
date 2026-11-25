/**
 * Places a converted Pelican drawing into the designer room.
 *
 * The GLB keeps the CAD coordinate system. This turns it upright (the short
 * axis is the bowl depth), puts the longer plan axis across the cabinet, and
 * sits the rim on the countertop. A failed load leaves the parametric basin.
 */

import * as THREE from "three";
import { designerPelicanCadModel, pelicanCadInchesPerUnit } from "./pelicanCadModels";
import type { PelicanCadAsset } from "./pelicanCadCatalog";

const INCH = 1 / 12;

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
}

function finishMaterial(asset: PelicanCadAsset): THREE.MeshPhysicalMaterial {
  const granite = asset.fileType === "step";
  return new THREE.MeshPhysicalMaterial({
    color: granite ? "#d7d2cb" : "#c5ced3",
    metalness: granite ? 0.04 : 0.45,
    roughness: granite ? 0.42 : 0.32,
    clearcoat: granite ? 0.08 : 0.2,
    side: THREE.DoubleSide,
  });
}

function paint(root: THREE.Object3D, asset: PelicanCadAsset): void {
  const material = finishMaterial(asset);
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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

const PARAMETRIC_SINK_FLAGS = [
  "sinkRim",
  "sinkBowl",
  "sinkBowlFloor",
  "sinkDrain",
  "sinkDrainRing",
  "sinkDrainStrainer",
  "sinkApronFront",
  "sinkBowlDivider",
] as const;

function hideParametricBasin(holder: THREE.Object3D, ownedNodes: readonly THREE.Object3D[]): void {
  for (const node of ownedNodes) {
    if (node === holder) continue;
    node.traverse((child) => {
      const data = child.userData as Record<string, unknown>;
      if (PARAMETRIC_SINK_FLAGS.some((flag) => data[flag] === true)) child.visible = false;
    });
  }
}

export type ManufacturerSinkAnchor = {
  pelicanCode?: string | null;
  pelicanProfileId?: string | null;
  pelicanProductName?: string | null;
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
  holder.position.set(sink.x, sink.y, sink.z);
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
    const clone = template.clone(true);
    holder.add(clone);
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

