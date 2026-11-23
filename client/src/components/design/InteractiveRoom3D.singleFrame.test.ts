// @vitest-environment jsdom
/**
 * A wood shaker front is one frame: two rails, two stiles, and one opening
 * line. A second carcass frame, a notch pair, or an outer edge line on the
 * same rail reads as extra horizontal lines.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet } from "./InteractiveRoom3D";
import { designerCatalogDoorProfile } from "@/lib/doorStyleAppearance";

const AIR_DAWN = {
  id: 390020,
  distributorId: 180001,
  ourName: "Slim White Oak",
  aliasName: "Air Dawn (Preston)",
  doorStyle: "Slim Shaker",
  finish: "Air Dawn (Preston)",
  woodSpecies: "Solid Birch",
  color: "#b9a281",
  grainDirection: null,
  doorSampleImageUrl: "/air-dawn-door.jpg",
};

const CROP = {
  slug: "versa-shaker",
  doorSize: [141, 240] as [number, number],
  drawerSize: [141, 58] as [number, number],
  drawerSolidColor: null,
  solidColor: null,
  grainUrl: null,
  faceTileIn: [6, 12] as [number, number],
  faceTileDrawerIn: [4, 8] as [number, number],
};

function build(sku: Record<string, unknown>) {
  const root = new THREE.Group();
  addCabinet(
    root,
    sku as never,
    "back",
    { back: 0 },
    144,
    120,
    "#b9a281",
    "#f7f4ef",
    designerCatalogDoorProfile(AIR_DAWN as never) as never,
    { x: 0, z: 0, rotation: 0 },
    AIR_DAWN.doorSampleImageUrl,
    undefined,
    { selectedToeKick: true, drawerSampleUrl: AIR_DAWN.doorSampleImageUrl, faceCrop: CROP },
  );
  return root;
}

function meshes(root: THREE.Object3D) {
  const found: THREE.Mesh[] = [];
  root.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) found.push(node as THREE.Mesh);
  });
  return found;
}

describe("one wood shaker frame", () => {
  it("gives a plain tall pantry one full-height frame per door and no carcass frame", () => {
    const root = build({
      placementUid: "pantry",
      masterCode: "P2484",
      description: "Tall pantry",
      placementType: "tall",
      width: 24,
      height: 84,
      depth: 24,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      category: "Tall",
    });
    const doors = meshes(root).filter((mesh) => mesh.userData.cabinetFront && !mesh.userData.cabinetDrawerFront && !mesh.userData.physicalRail);
    expect(doors).toHaveLength(2);
    expect(doors.every((door) => !door.userData.pantryDoorSet)).toBe(true);
    const height = (doors[0]!.geometry as THREE.BoxGeometry).parameters.height;
    expect(height).toBeGreaterThan(5);
    const frames = new Set<THREE.Object3D>();
    root.traverse((node) => {
      if (node.userData.physicalRails) frames.add(node);
    });
    expect(frames.size).toBe(2);
    for (const frame of frames) {
      const rails = frame.children.filter((child) => (child as THREE.Mesh).isMesh && child.userData.physicalRail);
      expect(rails).toHaveLength(4);
      expect(frame.children.some((child) => child.userData.shakerNotch)).toBe(false);
      const outline = frame.children.find((child) => child.userData.shakerFrameOutline) as THREE.LineSegments | undefined;
      expect(outline).toBeTruthy();
      expect(outline!.geometry.getAttribute("position").count).toBe(8);
    }
    expect(meshes(root).some((mesh) => mesh.userData.cabinetFaceFrame)).toBe(false);
  });

  it("keeps each drawer front inside the cabinet and on one frame", () => {
    const root = build({
      placementUid: "drawers",
      masterCode: "3DB36",
      description: "3 Drawer Base",
      placementType: "base",
      width: 36,
      height: 34.5,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 3,
      category: "Base",
    });
    const drawers = meshes(root).filter((mesh) => mesh.userData.cabinetDrawerFront);
    expect(drawers.length).toBeGreaterThanOrEqual(3);
    const half = 36 / 12 / 2;
    for (const drawer of drawers) {
      const width = (drawer.geometry as THREE.BoxGeometry).parameters.width;
      expect(Math.abs(drawer.position.x) + width / 2).toBeLessThanOrEqual(half + 0.01);
    }
    const frames = new Set<THREE.Object3D>();
    root.traverse((node) => {
      if (node.userData.physicalRails && node.userData.faceRole === "drawer") frames.add(node);
    });
    expect(frames.size).toBe(drawers.length);
    for (const frame of frames) {
      expect(frame.children.filter((child) => child.userData.physicalRail)).toHaveLength(4);
      expect(frame.children.some((child) => child.userData.shakerNotch)).toBe(false);
    }
    expect(meshes(root).some((mesh) => mesh.userData.cabinetFaceFrame)).toBe(false);
  });
});
