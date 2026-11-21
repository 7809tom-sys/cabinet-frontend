import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { elevationBox, STD, type PlacedCabinet, type RoomData } from "@/lib/design";
import { addCabinet, addThreeDStandardCountertops, existingCabinetSku, existingCabinetTransform, threeDContinuousToeKickSegments } from "./InteractiveRoom3D";

const room: RoomData = { width: 120, depth: 96, ceilingHeight: 96 };

function desk(uid: string, x: number): PlacedCabinet {
  return {
    uid, cabinetId: 1, masterCode: "DB30", description: '30" Desk Base', category: "Base", subCategory: "Desk",
    placement: "base", x, y: 0, width: 30, height: 30, depth: 24, rotation: 0, numberOfDoors: 1, numberOfDrawers: 1,
  };
}

const kneeDrawer: PlacedCabinet = {
  uid: "dkd30", cabinetId: 30, masterCode: "DKD30", description: "30 inch x 6 inch Knee Drawer Base Cabinet",
  category: "Base", subCategory: "Knee Drawer", placement: "base",
  x: 30, y: 0, width: 30, height: 6, depth: 21, rotation: 0, numberOfDoors: 0, numberOfDrawers: 1,
  mountBottom: 0, customProfile: "knee-drawer",
};

describe("DKD30 knee drawer placement", () => {
  const placed = [desk("desk-left", 0), kneeDrawer, desk("desk-right", 60)];

  it("hangs the drawer under the desk top in 3D and keeps the knee space open", () => {
    expect(elevationBox(kneeDrawer, room, placed)).toEqual({ bottom: 24, height: 6 });
    const transform = existingCabinetTransform(kneeDrawer, room, placed);
    expect(transform.bottom).toBe(24);

    const root = new THREE.Group();
    addCabinet(root, existingCabinetSku(kneeDrawer, room), null, {}, room.width, room.depth, "#cbb892", "#ece7df", undefined, transform);
    const group = root.children.find((node) => node.userData.placedUid === "dkd30" && node.userData.masterCode === "DKD30");
    expect(group).toBeTruthy();
    expect(group!.userData.floorStandingCabinet).toBeUndefined();
    expect(group!.position.y).toBeCloseTo((24 + 3) / 12);

    let toeKick = false;
    group!.traverse((node) => {
      if (node.userData.floorStandingToeKick || node.userData.toeKickHeightIn) toeKick = true;
    });
    expect(toeKick).toBe(false);

    const bounds = new THREE.Box3().setFromObject(group!);
    expect(bounds.min.y).toBeGreaterThan(18 / 12);
    expect(bounds.max.y).toBeCloseTo(30 / 12, 2);
    expect(threeDContinuousToeKickSegments(placed, room).some((segment) => segment.memberUids.includes("dkd30"))).toBe(false);
  });

  it("draws one desktop slab over a DSK knee drawer between 34½-inch microwave bases at countertop height", () => {
    const pedestal = (uid: string, x: number): PlacedCabinet => ({
      uid, cabinetId: 9360050, masterCode: "MB30",
      description: '30" W x 34-1/2" H x 24" D Microwave Base Cabinet — Open Microwave Shelf, 1 Drawer',
      category: "Base", subCategory: "Microwave Base Cabinet",
      placement: "base", x, y: 0, width: 30, height: 34.5, depth: 24, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 1,
    });
    const knee: PlacedCabinet = {
      uid: "dsk2421", cabinetId: 15810014, masterCode: "DSK2421",
      description: 'Knee Drawer - 24"W x 7.5"H x 21"D',
      category: "Base", subCategory: "Knee Drawer",
      placement: "baseTop", x: 30, y: 0, width: 24, height: 7.5, depth: 21, rotation: 0,
      numberOfDoors: 0, numberOfDrawers: 1,
    };
    const placed = [pedestal("mb-left", 0), knee, pedestal("mb-right", 54)];
    expect(elevationBox(knee, room, placed)).toEqual({ bottom: 27, height: 7.5 });

    const root = new THREE.Group();
    addThreeDStandardCountertops(root, room, placed, "#ece7df");
    const slabs: THREE.Mesh[] = [];
    root.traverse((node) => {
      if (node instanceof THREE.Mesh && node.userData.standardRunCountertop) slabs.push(node);
    });
    expect(slabs).toHaveLength(1);
    const bounds = new THREE.Box3().setFromObject(slabs[0]!);
    const inch = 1 / 12;
    expect(bounds.min.x / inch).toBeCloseTo(0, 5);
    expect(bounds.max.x / inch).toBeCloseTo(84, 5);
    expect(bounds.min.y / inch).toBeCloseTo(STD.COUNTERTOP_HEIGHT - STD.COUNTERTOP_THICKNESS, 5);
    expect(bounds.max.y / inch).toBeCloseTo(STD.COUNTERTOP_HEIGHT, 5);
  });
});
