import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { isRangeOrOven } from "@/lib/design";
import {
  addCabinet,
  existingCabinetSku,
  isEnclosedWallMicrowaveCabinet,
} from "./InteractiveRoom3D";

const INCH = 1 / 12;

function addWall(sku: Parameters<typeof addCabinet>[1], bottom = 54) {
  const root = new THREE.Group();
  addCabinet(root, sku, "back", {}, 144, 120, "#8a9ba8", "#f8f8f6", undefined, { x: 15, z: 6, rotation: 0, bottom });
  return root;
}

function faces(root: THREE.Object3D) {
  const doors: THREE.Object3D[] = [];
  const drawers: THREE.Object3D[] = [];
  const openings: THREE.Object3D[] = [];
  const ovenDoors: THREE.Object3D[] = [];
  const microwaveFaces: THREE.Object3D[] = [];
  root.traverse((node) => {
    if (node.userData.cabinetDrawerFront) drawers.push(node);
    if (node.userData.ovenCabinetDoor) ovenDoors.push(node);
    if (node.userData.wallMicrowaveFront || (node.userData.configuredOpening && node.userData.openingType === "bottom")) {
      if (node.userData.wallMicrowaveFront) microwaveFaces.push(node);
    }
    if (node.userData.configuredOpening) openings.push(node);
    if (
      node.userData.cabinetFront
      && !node.userData.cabinetDrawerFront
      && !node.userData.cabinetHardware
      && !node.userData.configuredOpening
      && !node.userData.selectionOnly
      && !node.userData.ovenCabinetDoor
    ) doors.push(node);
  });
  const cabinet = root.children[0] as THREE.Object3D | undefined;
  const bounds = new THREE.Box3();
  if (cabinet) {
    root.updateMatrixWorld(true);
    bounds.setFromObject(cabinet);
  }
  return {
    doors,
    drawers,
    openings,
    ovenDoors,
    microwaveFaces,
    minYIn: cabinet ? bounds.min.y / INCH : null,
    maxYIn: cabinet ? bounds.max.y / INCH : null,
  };
}

describe("enclosed wall microwave 3D classification", () => {
  it("recognizes MO#### and microwave oven cabinet as enclosed wall microwaves, not MW-30", () => {
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "MO3042",
      placementType: "wall",
      description: '30" x 42" Microwave Oven Cabinet',
      numberOfDoors: 2,
      openingType: "bottom",
    })).toBe(true);
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "MO3030",
      placementType: "wall",
      description: '30" x 30" Microwave Wall Cabinet',
      numberOfDoors: 2,
      openingType: "bottom",
    })).toBe(true);
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "MW3036",
      placementType: "wall",
      description: '30" Microwave Wall Cabinet',
      numberOfDoors: 2,
      openingType: "bottom",
    })).toBe(true);
    expect(isEnclosedWallMicrowaveCabinet({
      masterCode: "MW-30",
      placementType: "appliance",
      description: '30" Over-Range Microwave',
      numberOfDoors: 0,
      openingType: null,
    })).toBe(false);
  });

  it("renders MW3030, MW3036, and MW3042 as wall cabinets with two doors and a bottom opening, hanging from 54 inches", () => {
    const rows = [
      { masterCode: "MW3030", height: 30, depth: 18, doorHeight: 15 },
      { masterCode: "MW3036", height: 36, depth: 18, doorHeight: 18 },
      { masterCode: "MW3042", height: 42, depth: 18, doorHeight: 24 },
    ] as const;
    for (const row of rows) {
      const sku = existingCabinetSku({
        uid: row.masterCode.toLowerCase(),
        cabinetId: 9390051,
        masterCode: row.masterCode,
        description: '30" Microwave Wall Cabinet',
        category: "Wall",
        subCategory: "Microwave Wall",
        placement: "wall",
        x: 0,
        y: 0,
        width: 30,
        height: row.height,
        depth: row.depth,
        rotation: 0,
        numberOfDoors: 2,
        numberOfDrawers: 0,
        openingType: "bottom",
        doorHeight: row.doorHeight,
        wallId: "back",
        wallOffset: 0,
      } as never);
      expect(sku.placementType, row.masterCode).toBe("wall");
      expect(isEnclosedWallMicrowaveCabinet(sku), row.masterCode).toBe(true);

      const root = addWall(sku);
      const mesh = faces(root);
      expect(mesh.drawers, row.masterCode).toHaveLength(0);
      expect(mesh.doors, row.masterCode).toHaveLength(2);
      expect(mesh.openings, row.masterCode).toHaveLength(1);
      expect(mesh.openings[0]!.userData.openingType, row.masterCode).toBe("bottom");
      expect(mesh.microwaveFaces.length, row.masterCode).toBeGreaterThan(0);
      expect(mesh.ovenDoors, row.masterCode).toHaveLength(0);
      expect(mesh.minYIn, row.masterCode).toBeCloseTo(54, 5);
      expect(mesh.maxYIn, row.masterCode).toBeCloseTo(54 + row.height, 5);
    }
  });

  it("gives MO3030 and MO3042 the wall microwave bay, and keeps MO3042 as a wall cabinet with two doors, not an appliance or oven face", () => {
    expect(isRangeOrOven("MO3042", '30" x 42" Microwave Oven Cabinet')).toBe(false);

    const rows = [
      {
        masterCode: "MO3030",
        description: '30" x 30" Microwave Wall Cabinet',
        height: 30,
        doorHeight: 15,
        cabinetId: 9360159,
      },
      {
        masterCode: "MO3042",
        description: '30" x 42" Microwave Oven Cabinet',
        height: 42,
        doorHeight: undefined as number | undefined,
        cabinetId: 9360161,
      },
    ] as const;

    for (const row of rows) {
      const sku = existingCabinetSku({
        uid: row.masterCode.toLowerCase(),
        cabinetId: row.cabinetId,
        masterCode: row.masterCode,
        description: row.description,
        category: "Wall",
        subCategory: "Microwave Wall",
        placement: "wall",
        x: 0,
        y: 0,
        width: 30,
        height: row.height,
        depth: 12,
        rotation: 0,
        customProfile: "tall_2door",
        numberOfDoors: 2,
        numberOfDrawers: 0,
        openingType: "bottom",
        doorHeight: row.doorHeight,
        wallId: "back",
        wallOffset: 0,
      } as never);
      expect(sku.placementType, row.masterCode).toBe("wall");
      expect(isEnclosedWallMicrowaveCabinet(sku), row.masterCode).toBe(true);

      const root = addWall(sku);
      const mesh = faces(root);
      expect(mesh.drawers, row.masterCode).toHaveLength(0);
      expect(mesh.doors, row.masterCode).toHaveLength(2);
      expect(mesh.openings, row.masterCode).toHaveLength(1);
      expect(mesh.openings[0]!.userData.openingType, row.masterCode).toBe("bottom");
      expect(mesh.microwaveFaces.length, row.masterCode).toBeGreaterThan(0);
      expect(mesh.ovenDoors, row.masterCode).toHaveLength(0);
      expect(mesh.minYIn, row.masterCode).toBeCloseTo(54, 5);
      expect(mesh.maxYIn, row.masterCode).toBeCloseTo(54 + row.height, 5);
    }
  });

  it("still treats hyphenated MW-30 as the over-range appliance", () => {
    const sku = existingCabinetSku({
      uid: "mw-30",
      cabinetId: 1,
      masterCode: "MW-30",
      description: '30" Over-Range Microwave',
      category: "Appliance",
      placement: "appliance",
      x: 0,
      y: 0,
      width: 30,
      height: 16,
      depth: 15,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } as never);
    expect(sku.placementType).toBe("appliance");
    expect(isEnclosedWallMicrowaveCabinet(sku)).toBe(false);

    // A wall-coded row with the hyphenated appliance SKU still infers appliance.
    const inferred = existingCabinetSku({
      uid: "mw-30-wallish",
      cabinetId: 1,
      masterCode: "MW-30",
      description: '30" Over-Range Microwave',
      placement: "wall",
      x: 0,
      y: 0,
      width: 30,
      height: 16,
      depth: 15,
      rotation: 0,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } as never);
    expect(inferred.placementType).toBe("appliance");
  });

  it("still draws a real oven cabinet on the oven-enclosure face", () => {
    const sku = existingCabinetSku({
      uid: "uoc-tall",
      cabinetId: 9390085,
      masterCode: "UOC3396",
      description: '33" x 96" Universal Oven Cabinet - 30" x 39.75" Oven Opening - 2 Doors 3 Drawers',
      category: "Tall",
      placement: "tall",
      x: 0,
      y: 0,
      width: 33,
      height: 96,
      depth: 24,
      rotation: 0,
      numberOfDoors: 2,
      numberOfDrawers: 3,
      openingType: "middle",
      ovenType: "double",
    } as never);
    expect(sku.placementType).toBe("tall");
    expect(isEnclosedWallMicrowaveCabinet(sku)).toBe(false);

    const root = new THREE.Group();
    addCabinet(root, sku, null, {}, 144, 120, "#8a9ba8", "#f8f8f6");
    const mesh = faces(root);
    expect(mesh.ovenDoors.length).toBeGreaterThan(0);
    expect(mesh.microwaveFaces).toHaveLength(0);
    expect(mesh.minYIn).toBeCloseTo(0, 5);
  });
});
