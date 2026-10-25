import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  addThreeDGlassStackerRearSupports,
  crownMiterEndpointTrims,
  existingCabinetTransform,
  threeDGlassStackerRearSupportSpecs,
  type ThreeDCrownPerimeterSegment,
} from "./InteractiveRoom3D";
import type { PlacedCabinet } from "@/lib/design";

function segment(
  ownerUid: string,
  start: { x: number; z: number },
  end: { x: number; z: number },
): ThreeDCrownPerimeterSegment {
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  return {
    ownerUid,
    kind: "front",
    start,
    end,
    top: 96,
    length,
    center: { x: (start.x + end.x) / 2, z: (start.z + end.z) / 2 },
    rotation: -Math.atan2(end.z - start.z, end.x - start.x),
    diagonalCorner: false,
  };
}

function cabinet(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "cabinet",
    cabinetId: 1,
    masterCode: "W3612",
    description: "36 inch Wall Cabinet",
    placement: "wall",
    x: 0,
    y: 0,
    width: 36,
    depth: 12,
    height: 12,
    rotation: 0,
    mountBottom: 84,
    ...overrides,
  };
}

describe("3D crown physical limits", () => {
  it("never extends a miter farther than the physical crown profile rise", () => {
    const radians = 3 * Math.PI / 180;
    const segments = [
      segment("first", { x: 0, z: 0 }, { x: 10, z: 0 }),
      segment("second", { x: 10, z: 0 }, { x: 10 - Math.cos(radians) * 10, z: Math.sin(radians) * 10 }),
    ];

    const trims = crownMiterEndpointTrims(segments, 3);
    for (const trim of trims) {
      expect(Math.abs(trim.startTopShift)).toBeLessThanOrEqual(3);
      expect(Math.abs(trim.endTopShift)).toBeLessThanOrEqual(3);
    }
  });
});

describe("front-flush glass stacker rear support", () => {
  it("adds a 12-inch concealed filler/support chase behind a 12-inch stacker on a 24-inch parent", () => {
    const parent = cabinet({ uid: "parent", masterCode: "WR3612", depth: 24, height: 12, mountBottom: 72 });
    const stacker = cabinet({
      uid: "stacker",
      masterCode: "W3612GD",
      description: "36 inch Glass Door Stacker",
      depth: 12,
      stackedOnCabinetUid: parent.uid,
      glassDoor: true,
    });

	    expect(threeDGlassStackerRearSupportSpecs([parent, stacker])).toEqual([{
      stackerUid: "stacker",
      parentUid: "parent",
      width: 36,
      height: 12,
      stackerDepth: 12,
	      gapDepth: 12,
	    }]);
	    expect(existingCabinetTransform({ ...stacker, y: 12, depthPositionAdjusted: true }, { width: 144, depth: 120, ceilingHeight: 108 })).toMatchObject({
	      x: 18,
	      z: 18,
	      bottom: 84,
	    });
	  });

  it("does not invent a rear support when parent and stacker depths already match", () => {
    const parent = cabinet({ uid: "parent", depth: 24 });
    const stacker = cabinet({ uid: "stacker", masterCode: "DCW2412GD", description: "Glass Door Stacker", depth: 24, stackedOnCabinetUid: parent.uid, glassDoor: true });
    expect(threeDGlassStackerRearSupportSpecs([parent, stacker])).toEqual([]);
  });

  it("closes both exposed chase ends with the glass cabinet's finish material", () => {
    const parent = cabinet({ uid: "parent", masterCode: "WR3612", depth: 24, height: 12, mountBottom: 72 });
    const stacker = cabinet({
      uid: "stacker",
      masterCode: "W3612GD",
      description: "36 inch Glass Door Stacker",
      depth: 12,
      y: 12,
      stackedOnCabinetUid: parent.uid,
      depthPositionAdjusted: true,
      glassDoor: true,
    });
    const root = new THREE.Group();
    const cabinetGroup = new THREE.Group();
    cabinetGroup.userData.placedUid = stacker.uid;
    const finish = new THREE.MeshStandardMaterial({ color: "#f4f1e8" });
    finish.userData.selectedFinishSideSkin = true;
    cabinetGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), finish));
    root.add(cabinetGroup);

    addThreeDGlassStackerRearSupports(root, [parent, stacker], { width: 144, depth: 120, ceilingHeight: 108 }, undefined, "#c8b89c");

    const support = root.children.find((node) => node.userData.glassStackerRearSupport === true) as THREE.Group | undefined;
    expect(support).toBeDefined();
    expect(support?.userData.sharesOwnerCabinetFinishMaterial).toBe(true);
    const closures = support?.children.filter((node) => node.userData.glassStackerRearFillerSide) as THREE.Mesh[];
    expect(closures).toHaveLength(2);
    expect(closures.map((mesh) => mesh.userData.glassStackerRearFillerSide)).toEqual(["left", "right"]);
    expect(closures.every((mesh) => mesh.material === finish)).toBe(true);
  });
});
