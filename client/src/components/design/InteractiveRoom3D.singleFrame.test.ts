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

function framePieces(frame: THREE.Object3D) {
  return frame.children.filter((child) => (child as THREE.Mesh).isMesh && child.userData.physicalRail) as THREE.Mesh[];
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
    const topRails: number[] = [];
    for (const frame of frames) {
      const pieces = framePieces(frame);
      expect(pieces).toHaveLength(4);
      expect(frame.children.some((child) => child.userData.shakerNotch || child.userData.shakerFrameOutline)).toBe(false);
      const rails = pieces.filter((piece) => piece.userData.grainPiece === "rail");
      expect(rails).toHaveLength(2);
      topRails.push(Math.max(...rails.map((rail) => rail.position.y)));
    }
    expect(topRails[0]).toBeCloseTo(topRails[1]!, 5);
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
    const side = meshes(root).find((mesh) => mesh.userData.selectedStyleSideSkin);
    const sideFront = new THREE.Box3().setFromObject(side!).max.z;
    for (const frame of frames) {
      const pieces = framePieces(frame);
      expect(pieces).toHaveLength(4);
      expect(frame.children.some((child) => child.userData.shakerNotch || child.userData.shakerFrameOutline)).toBe(false);
      const stiles = pieces.filter((piece) => piece.userData.grainPiece === "stile");
      const rails = pieces.filter((piece) => piece.userData.grainPiece === "rail");
      expect(stiles).toHaveLength(2);
      expect(rails).toHaveLength(2);
      const half = (drawers[0]!.geometry as THREE.BoxGeometry).parameters.width / 2;
      for (const stile of stiles) {
        // The stile is the end of this drawer, not a second stile inset across the face.
        expect(half - Math.abs(stile.position.x)).toBeLessThan(1.5 / 12);
      }
      for (const rail of rails) {
        const railHalf = (rail.geometry as THREE.BoxGeometry).parameters.width / 2;
        for (const stile of stiles) {
          const stileHalf = (stile.geometry as THREE.BoxGeometry).parameters.width / 2;
          expect(Math.abs(stile.position.x) + stileHalf).toBeGreaterThan(Math.abs(rail.position.x) + railHalf - 0.02);
        }
      }
    }
    root.updateMatrixWorld(true);
    for (const drawer of drawers) {
      expect(new THREE.Box3().setFromObject(drawer).max.z).toBeLessThanOrEqual(sideFront + 0.02);
    }
    expect(meshes(root).some((mesh) => mesh.userData.cabinetFaceFrame)).toBe(false);
  });

  it("keeps a two-cabinet island seam between drawers, not across them", () => {
    const root = new THREE.Group();
    for (const x of [9, 27]) {
      addCabinet(
        root,
        {
          placementUid: `island-${x}`,
          masterCode: "3DB18",
          description: "Island drawer base",
          placementType: "base",
          width: 18,
          height: 34.5,
          depth: 24,
          numberOfDoors: 0,
          numberOfDrawers: 3,
          category: "Base",
        } as never,
        "back",
        { back: 0 },
        144,
        120,
        "#b9a281",
        "#f7f4ef",
        designerCatalogDoorProfile(AIR_DAWN as never) as never,
        { x, z: 0, rotation: 0 },
        AIR_DAWN.doorSampleImageUrl,
        undefined,
        { selectedToeKick: true, drawerSampleUrl: AIR_DAWN.doorSampleImageUrl, faceCrop: CROP },
      );
    }
    const drawers = meshes(root).filter((mesh) => mesh.userData.cabinetDrawerFront);
    expect(drawers).toHaveLength(6);
    const frames: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.physicalRails && node.userData.faceRole === "drawer") frames.push(node);
    });
    expect(frames).toHaveLength(6);
    expect(meshes(root).some((mesh) => mesh.userData.cabinetFaceFrame)).toBe(false);
    for (const frame of frames) {
      expect(framePieces(frame)).toHaveLength(4);
    }
  });
});
