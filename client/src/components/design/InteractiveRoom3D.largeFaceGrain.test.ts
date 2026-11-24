// @vitest-environment jsdom
/**
 * Large wood faces keep the door photo's real-inch scale. Door and drawer
 * pieces stay on the clamped crop. A wood cabinet does not stack a second
 * rail or a carcass edge line on the door rail. Painted cabinets are unchanged.
 */
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addCabinet, applyLargeFaceWoodUv, hideDuplicateFaceFrameRail, recessedWoodFrontZ } from "./InteractiveRoom3D";
import { DLC_FRAME_DETAIL } from "@shared/dlcFr26Textures";

const WOOD = {
  doorStyle: "Shaker",
  doorPanelType: null,
  railWidth: 2.75,
  stileWidth: 2.75,
  panelConstruction: "flat" as const,
  paintedFinish: false,
  styleId: 330030,
  styleCode: "OT",
  distributorId: 210002,
};

const PAINT = {
  doorStyle: "Shaker",
  doorPanelType: null,
  railWidth: 2.75,
  stileWidth: 2.75,
  panelConstruction: "flat" as const,
  paintedFinish: true,
  styleId: 330002,
};

function build(profile: object, sku: Record<string, unknown>, bottom?: number) {
  const root = new THREE.Group();
  addCabinet(
    root,
    sku as never,
    "back",
    { back: 0 },
    144,
    120,
    "#a07850",
    "#eeeeee",
    profile as never,
    { x: 0, z: 0, rotation: 0, ...(bottom != null ? { bottom } : {}) },
    profile && (profile as { paintedFinish?: boolean }).paintedFinish ? null : "/manus-storage/media-library/oxford-toffee-door.jpg",
    undefined,
    { selectedToeKick: true, suppressCountertop: true },
  );
  root.updateMatrixWorld(true);
  return root;
}

const BASE = {
  placementUid: "b24",
  masterCode: "B24",
  description: "24 Base",
  placementType: "base",
  width: 24,
  depth: 24,
  height: 34.5,
  numberOfDoors: 1,
  numberOfDrawers: 1,
  category: "Base",
};

const PANTRY = {
  placementUid: "pantry",
  masterCode: "PC1884",
  description: "18 Pantry Cabinet",
  placementType: "tall",
  width: 18,
  depth: 24,
  height: 84,
  numberOfDoors: 2,
  numberOfDrawers: 0,
  doorOrientation: "stacked",
  category: "Tall",
};

function worldBox(node: THREE.Object3D) {
  const mesh = node as THREE.Mesh;
  mesh.geometry.computeBoundingBox();
  const box = new THREE.Box3();
  box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
  return box;
}

describe("large wood faces and single rail edges", () => {
  it("seats a wood front on the back of its rail", () => {
    const z = recessedWoodFrontZ(0.066, 0.052);
    const railBack = 0.066 - DLC_FRAME_DETAIL.standardRailDepth / 2;
    expect(z + 0.052 / 2).toBeCloseTo(railBack, 6);
    expect(z).toBeLessThan(0.035);
  });

  it("hides only the duplicate face-frame rails on a wood cabinet", () => {
    expect(hideDuplicateFaceFrameRail("top", "base", true)).toBe(true);
    expect(hideDuplicateFaceFrameRail("top", "tall", true)).toBe(true);
    expect(hideDuplicateFaceFrameRail("top", "wall", true)).toBe(false);
    expect(hideDuplicateFaceFrameRail("bottom", "base", true)).toBe(false);
    expect(hideDuplicateFaceFrameRail("bottom", "wall", true)).toBe(false);
    expect(hideDuplicateFaceFrameRail("left", "wall", true)).toBe(false);
    expect(hideDuplicateFaceFrameRail("top", "base", false)).toBe(false);
  });

  it("drops the carcass edge line and the face-frame rail that stacks on the door", () => {
    const wood = build(WOOD, BASE);
    const paint = build(PAINT, BASE);
    const topRails = (root: THREE.Object3D) => {
      const found: THREE.Object3D[] = [];
      root.traverse((node) => {
        if (node.userData?.faceFrameEdge === "top") found.push(node);
      });
      return found;
    };
    expect(topRails(wood).length).toBeGreaterThan(0);
    expect(topRails(wood).every((rail) => rail.visible === false && rail.userData.duplicateFrontRailHidden === true)).toBe(true);
    expect(topRails(paint).every((rail) => rail.visible === true && rail.userData.duplicateFrontRailHidden !== true)).toBe(true);
    const tallEdge = (root: THREE.Object3D) => {
      let count = 0;
      root.traverse((node) => {
        if (!node.userData?.carcassEdgeLines) return;
        const box = worldBox(node);
        if ((box.max.y - box.min.y) * 12 > 15) count += 1;
      });
      return count;
    };
    expect(tallEdge(wood)).toBe(0);
    expect(tallEdge(paint)).toBeGreaterThan(0);
    let omitted = 0;
    wood.traverse((node) => { if (node.userData?.carcassFrontEdgeOmitted) omitted += 1; });
    expect(omitted).toBeGreaterThan(0);
  });

  it("keeps each pantry rail in front of its door slab and hides the extra top rail", () => {
    const root = build(WOOD, PANTRY);
    const doors: THREE.Mesh[] = [];
    const rails: THREE.Mesh[] = [];
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.userData?.pantryDoorSet) doors.push(mesh);
      if (mesh.userData?.grainPiece === "rail") rails.push(mesh);
    });
    expect(doors).toHaveLength(2);
    expect(rails.length).toBeGreaterThanOrEqual(4);
    for (const door of doors) {
      const doorBox = worldBox(door);
      const overlapping = rails.filter((rail) => {
        const railBox = worldBox(rail);
        return railBox.max.y > doorBox.min.y + 0.01 && railBox.min.y < doorBox.max.y - 0.01;
      });
      expect(overlapping.length).toBeGreaterThan(0);
      for (const rail of overlapping) {
        const railBox = worldBox(rail);
        expect(doorBox.max.z).toBeLessThanOrEqual(railBox.min.z + 0.002);
      }
    }
    const upper = doors.find((door) => door.userData.pantryDoorSet === "upper")!;
    const lower = doors.find((door) => door.userData.pantryDoorSet === "lower")!;
    expect(upper.position.y).toBeGreaterThan(lower.position.y);
    let hiddenTop = 0;
    root.traverse((node) => {
      if (node.userData?.faceFrameEdge === "top") {
        expect(node.visible).toBe(false);
        hiddenTop += 1;
      }
    });
    expect(hiddenTop).toBeGreaterThan(0);
  });

  it("maps a tall side at the same inches per tile as a door-height side", () => {
    const sample = { width: 6, height: 20 };
    const measure = (heightFt: number, depthFt: number) => {
      const geometry = new THREE.BoxGeometry(0.05, heightFt, depthFt);
      const mapped = applyLargeFaceWoodUv(geometry, "vertical", sample, 0.1);
      const position = mapped.getAttribute("position");
      const normal = mapped.getAttribute("normal");
      const uv = mapped.getAttribute("uv");
      let minY = Infinity;
      let maxY = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;
      let minU = Infinity;
      let maxU = -Infinity;
      for (let index = 0; index < position.count; index += 1) {
        if (normal.getX(index) < 0.9) continue;
        minY = Math.min(minY, position.getY(index));
        maxY = Math.max(maxY, position.getY(index));
        minV = Math.min(minV, uv.getY(index));
        maxV = Math.max(maxV, uv.getY(index));
        minU = Math.min(minU, uv.getX(index));
        maxU = Math.max(maxU, uv.getX(index));
      }
      return { inches: (maxY - minY) * 12, v: maxV - minV, u: maxU - minU };
    };
    const door = measure(30 / 12, 12 / 12);
    const tall = measure(96 / 12, 24 / 12);
    expect(door.inches / (door.v * 2)).toBeCloseTo(sample.height, 1);
    expect(tall.inches / (tall.v * 2)).toBeCloseTo(sample.height, 1);
    expect(tall.u).toBeCloseTo(1, 2);
    expect(tall.u).toBeLessThanOrEqual(1);
  });

  it("keeps the wall face-frame rails that close a stacker joint", () => {
    const lower = build(WOOD, {
      placementUid: "w3030",
      masterCode: "W3030",
      description: "30x30 Wall",
      placementType: "wall",
      width: 30,
      depth: 12,
      height: 30,
      numberOfDoors: 2,
      numberOfDrawers: 0,
      category: "Wall",
    }, 54);
    let visibleRails = 0;
    lower.traverse((node) => {
      if (node.userData?.cabinetFaceFrame && node.userData?.faceFrameEdge) {
        expect(node.visible).toBe(true);
        expect(node.userData.duplicateFrontRailHidden).toBeUndefined();
        visibleRails += 1;
      }
    });
    expect(visibleRails).toBe(4);
  });
});
