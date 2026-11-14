import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { addCabinet, existingCabinetSku, existingCabinetTransform, threeDBlindCornerFrontLayout } from "./InteractiveRoom3D";
import type { PlacedCabinet, RoomData } from "@/lib/design";

const ROOM: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

function bbc(swing: "left" | "right"): PlacedCabinet {
  const base = {
    uid: `bbc-${swing}`,
    cabinetId: 9390015,
    masterCode: "BBC-36",
    description: '36" Blind Corner Base Cabinet',
    category: "Base",
    subCategory: "Blind Corner Base",
    placement: "base" as const,
    x: 108,
    y: 0,
    width: 36,
    depth: 24,
    height: 34.5,
    rotation: 0,
    cornerType: "blind-corner" as const,
    swing,
    numberOfDoors: 1,
    numberOfDrawers: 1,
    openingWidth: 11,
  };
  return base as PlacedCabinet;
}

function nodesFor(swing: "left" | "right") {
  const cabinet = bbc(swing);
  const root = new THREE.Group();
  addCabinet(root, existingCabinetSku(cabinet), null, {}, ROOM.width, ROOM.depth, "#7e8d72", "#f8f8f6", undefined, existingCabinetTransform(cabinet, ROOM));
  const nodes: THREE.Object3D[] = [];
  root.traverse((node) => nodes.push(node));
  return nodes;
}

describe("3D blind corner face: door and drawer only on the open half", () => {
  it.each(["left", "right"] as const)("%s-hand: exposed door + drawer on the open half, blank panel on the buried half", (swing) => {
    const layout = threeDBlindCornerFrontLayout(36 / 12, swing, 11);
    expect(layout.doorSide).toBe(swing);
    expect(layout.blindSide).toBe(swing === "left" ? "right" : "left");
    const nodes = nodesFor(swing);
    const doors = nodes.filter((node) => node.userData.blindCornerExposedDoor);
    const drawers = nodes.filter((node) => node.userData.blindCornerExposedDrawer);
    const blanks = nodes.filter((node) => node.userData.blindCornerFixedPanel);
    expect(doors).toHaveLength(1);
    expect(drawers).toHaveLength(1);
    expect(blanks).toHaveLength(1);
    expect(doors[0]!.userData.blindCornerDoorSide).toBe(swing);
    expect(drawers[0]!.userData.blindCornerDoorSide).toBe(swing);
    expect(blanks[0]!.userData.blindCornerBlindSide).toBe(layout.blindSide);
    // Nothing on the buried half is tagged as a door or drawer.
    expect(doors.some((node) => node.userData.blindCornerDoorSide === layout.blindSide)).toBe(false);
    expect(drawers.some((node) => node.userData.blindCornerDoorSide === layout.blindSide)).toBe(false);
  });
});
