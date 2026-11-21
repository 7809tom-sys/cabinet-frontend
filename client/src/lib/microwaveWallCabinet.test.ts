import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { isRangeOrOven } from "@/lib/design";
import { addCabinet, existingCabinetSku } from "@/components/design/InteractiveRoom3D";

describe("microwave wall cabinets are not range/oven appliances", () => {
  it("does not treat MO3042's Microwave Oven Cabinet description as a freestanding oven", () => {
    expect(isRangeOrOven("MO3042", '30" x 42" Microwave Oven Cabinet')).toBe(false);
    expect(isRangeOrOven("MO3030", '30" x 30" Microwave Wall Cabinet')).toBe(false);
    expect(isRangeOrOven("MO3036", '30" x 36" Microwave Wall Cabinet')).toBe(false);
    expect(isRangeOrOven("MW3036", '30" Microwave Wall Cabinet')).toBe(false);
    // Real appliances still match.
    expect(isRangeOrOven("RANGE-30", "30 inch Range")).toBe(true);
    expect(isRangeOrOven("OVEN-27", "27 inch Wall Oven")).toBe(true);
  });

  it("maps a placed MO3042 to a wall cabinet, not an appliance chassis on the floor", () => {
    const sku = existingCabinetSku({
      uid: "mo3042",
      cabinetId: 9360161,
      masterCode: "MO3042",
      description: '30" x 42" Microwave Oven Cabinet',
      category: "Wall",
      subCategory: "Microwave Wall",
      placement: "wall",
      x: 0,
      y: 0,
      width: 30,
      height: 42,
      depth: 12,
      rotation: 0,
      customProfile: "tall_2door",
      numberOfDoors: 2,
      numberOfDrawers: 0,
      openingType: "bottom",
      wallId: "back",
      wallOffset: 0,
    } as never);
    expect(sku.placementType).toBe("wall");

    const root = new THREE.Group();
    addCabinet(root, sku, "back", {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 15, z: 6, rotation: 0, bottom: 54 });
    const doors: THREE.Object3D[] = [];
    const drawers: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (node.userData.cabinetDrawerFront) drawers.push(node);
      if (node.userData.cabinetFront && !node.userData.cabinetDrawerFront && !node.userData.cabinetHardware && !node.userData.configuredOpening && !node.userData.selectionOnly) doors.push(node);
    });
    expect(drawers).toHaveLength(0);
    expect(doors).toHaveLength(2);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root.children[0]!);
    expect(bounds.min.y * 12).toBeCloseTo(54, 5);
    expect(bounds.max.y * 12).toBeCloseTo(96, 5);
  });
});
