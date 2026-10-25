import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addWallOpening } from "@/components/design/InteractiveRoom3D";
import { REACH_IN_CLOSET_PRESETS, WALK_IN_CLOSET_PRESETS, roomFromReachInPreset, roomFromWalkInPreset } from "./closetRoomPresets";

describe("editable reach-in bedroom closet room presets", () => {
  it("offers classic, six-and-a-half-foot, and seven-foot planning rooms", () => {
    expect(REACH_IN_CLOSET_PRESETS.map(({ widthIn, depthIn, nominalBifoldOpeningIn }) =>
      [widthIn, depthIn, nominalBifoldOpeningIn])).toEqual([
      [72, 24, 60],
      [78, 30, 60],
      [84, 30, 72],
    ]);
  });

  it.each(REACH_IN_CLOSET_PRESETS)("centers a non-product bi-fold opening in $label", (preset) => {
    const { room, openings } = roomFromReachInPreset(preset, "closet-test-door");
    expect(room).toEqual({ width: preset.widthIn, depth: preset.depthIn, ceilingHeight: 96 });
    expect(openings).toHaveLength(1);
    expect(openings[0]).toMatchObject({
      uid: "closet-test-door", side: "bottom", kind: "door", doorStyle: "bifold", sill: 0,
      width: preset.nominalBifoldOpeningIn, height: 80,
      offset: (preset.widthIn - preset.nominalBifoldOpeningIn) / 2,
    });
    expect(openings[0]?.label).toContain("planning size");
    expect((openings[0]?.offset ?? 0) + (openings[0]?.width ?? 0)).toBeLessThan(room.width);
    expect(room.vertices).toBeUndefined();
  });

  it("rejects invalid openings instead of clamping a door across an entire wall", () => {
    expect(() => roomFromReachInPreset({
      id: "bad", label: "Invalid", description: "Invalid", widthIn: 72,
      depthIn: 30, nominalBifoldOpeningIn: 72,
    }, "bad-door")).toThrow(/valid width/);
  });

  it("uses four bi-fold leaves only for the architectural room door, leaving a kitchen hinged door unchanged", () => {
    const { room, openings } = roomFromReachInPreset(REACH_IN_CLOSET_PRESETS[2]!, "closet-test-door");
    const root = new THREE.Group();
    addWallOpening(root, openings[0]!, room);
    const leaves: THREE.Object3D[] = [];
    root.traverse((node) => { if (node.userData.architecturalBifoldLeaf) leaves.push(node); });
    expect(leaves.map((leaf) => leaf.userData.architecturalBifoldLeaf)).toEqual([1, 2, 3, 4]);
    expect(root.children[0]?.userData).toMatchObject({ kind: "door", openingUid: "closet-test-door" });
    expect(root.children[0]?.children.some((node) => node.userData.architecturalOpeningBacking)).toBe(false);
    expect((leaves[0] as THREE.Mesh).material).toMatchObject({ transparent: true, opacity: 0.38 });

    const normal = new THREE.Group();
    addWallOpening(normal, { ...openings[0]!, doorStyle: undefined, label: "Interior Door" }, room);
    const normalLeaves: THREE.Object3D[] = [];
    normal.traverse((node) => { if (node.userData.architecturalBifoldLeaf) normalLeaves.push(node); });
    expect(normalLeaves).toHaveLength(0);
    expect(normal.children[0]?.children.some((node) => node.userData.architecturalOpeningBacking)).toBe(true);
  });
});

describe("walk-in closet room presets", () => {
  it("offers exactly 5x5 ft and 7x9 ft rooms", () => {
    expect(WALK_IN_CLOSET_PRESETS.map(({ widthIn, depthIn }) => [widthIn, depthIn])).toEqual([[60, 60], [84, 108]]);
  });
  it.each(WALK_IN_CLOSET_PRESETS)("centers a plain hinged door in $label", (preset) => {
    const { room, openings } = roomFromWalkInPreset(preset, "walk-door");
    expect(room).toEqual({ width: preset.widthIn, depth: preset.depthIn, ceilingHeight: 96 });
    expect(openings[0]).toMatchObject({ kind: "door", side: "bottom", width: 30, offset: (preset.widthIn - 30) / 2 });
    expect(openings[0]?.doorStyle).toBeUndefined();
  });
  it("rejects a door as wide as the wall", () => {
    expect(() => roomFromWalkInPreset({ id: "x", label: "x", description: "x", widthIn: 60, depthIn: 60, doorWidthIn: 60 }, "d")).toThrow(/valid width/);
  });
});
