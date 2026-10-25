import { describe, expect, it } from "vitest";
import { applyCabinetDoorHardwareToAll, isCabinetDoorHardwareEligible, isFullHeightCabinet, isTrashCanRolloutCabinet, requiresCenteredTopDoorPull, resolveCabinetHardwarePosition, supportsCenteredTopDoorPull, usesRaisedFloorWallDoorPull, type PlacedCabinet } from "./design";

function cabinet(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "cabinet",
    cabinetId: 1,
    masterCode: "B15",
    description: "15-inch base cabinet",
    placement: "base",
    x: 0,
    y: 0,
    width: 15,
    depth: 24,
    height: 34.5,
    rotation: 0,
    numberOfDoors: 1,
    numberOfDrawers: 1,
    ...overrides,
  } as PlacedCabinet;
}

describe("B15/B18 centered top-rail pull", () => {
  it("is offered only to B15 and B18 base cabinets and never spreads through the bulk action", () => {
    const b15 = cabinet({ uid: "b15", masterCode: "B15" });
    const b18 = cabinet({ uid: "b18", masterCode: "B18", width: 18 });
    const b24 = cabinet({ uid: "b24", masterCode: "B24", width: 24, numberOfDoors: 2 });
    const w18 = cabinet({ uid: "w18", masterCode: "W18", placement: "wall", width: 18 });
    expect(supportsCenteredTopDoorPull(b15)).toBe(true);
    expect(supportsCenteredTopDoorPull(b18)).toBe(true);
    expect(supportsCenteredTopDoorPull(b24)).toBe(false);
    expect(supportsCenteredTopDoorPull(w18)).toBe(false);
    expect(isCabinetDoorHardwareEligible(b15, "top-center")).toBe(true);
    expect(isCabinetDoorHardwareEligible(b24, "top-center")).toBe(false);
    expect(applyCabinetDoorHardwareToAll([b15, b18, b24, w18], "top-center").map((item) => item.hardwarePosition ?? null)).toEqual(["top-center", "top-center", null, null]);
  });

  it("forces TD and BT9PO pulls to the centered top rail", () => {
    for (const code of ["B12TD", "B15TD", "B18TD", "BT9PO"]) {
      const item = cabinet({ uid: code, masterCode: code, hardwarePosition: "left" });
      expect(requiresCenteredTopDoorPull(item)).toBe(true);
      expect(resolveCabinetHardwarePosition(item)).toBe("top-center");
      expect(supportsCenteredTopDoorPull(item)).toBe(true);
    }
  });

  it("keeps B15/B18 trashcan placement selectable while full-height cabinets default high", () => {
    const trash = cabinet({ uid: "trash", masterCode: "B18", description: "B18 trashcan rollout", hardwarePosition: "right" });
    const tall = cabinet({ uid: "tall", masterCode: "PANTRY1884", description: "Full Height Pantry Cabinet", placement: "tall", width: 18, height: 84 });
    expect(isTrashCanRolloutCabinet(trash)).toBe(true);
    expect(supportsCenteredTopDoorPull(trash)).toBe(true);
    expect(resolveCabinetHardwarePosition(trash)).toBe("right");
    expect(isFullHeightCabinet(tall)).toBe(true);
    expect(usesRaisedFloorWallDoorPull(tall)).toBe(true);
    expect(resolveCabinetHardwarePosition({ ...tall, hardwarePosition: "top-center" })).toBe("auto");
  });

  it("recognizes a B15/B18 cabinet with a selected rollout as trashcan mode", () => {
    expect(isTrashCanRolloutCabinet(cabinet({ masterCode: "B18", rolloutQty: 1 }))).toBe(true);
    expect(isTrashCanRolloutCabinet(cabinet({ masterCode: "B18", rolloutQty: 0 }))).toBe(false);
    expect(isTrashCanRolloutCabinet(cabinet({ masterCode: "B24", rolloutQty: 1 }))).toBe(false);
  });

  it("makes the upward vertical pull automatic for Island mode and 4½-inch floor-seated wall cabinets", () => {
    const elevatedUpper = cabinet({ uid: "upper", masterCode: "W1830", placement: "wall", mountBottom: 54 });
    const floorWall = cabinet({ uid: "floor", masterCode: "W1830", placement: "wall", mountBottom: 4.5, hardwarePosition: "left" });
    const islandWall = cabinet({ uid: "island", masterCode: "W2430", placement: "wall", mountBottom: 54, islandFace: "front", islandCounterHeightWallCabinet: true, hardwarePosition: "top-center" });
    const islandBase = cabinet({ uid: "island-base", masterCode: "B18", placement: "base", islandFace: "front", hardwarePosition: "top-center" });

    expect(usesRaisedFloorWallDoorPull(elevatedUpper)).toBe(false);
    expect(usesRaisedFloorWallDoorPull(floorWall)).toBe(true);
    expect(usesRaisedFloorWallDoorPull(islandWall)).toBe(true);
    expect(usesRaisedFloorWallDoorPull(islandBase)).toBe(false);
    expect(resolveCabinetHardwarePosition(floorWall)).toBe("left");
    expect(resolveCabinetHardwarePosition(islandWall)).toBe("auto");
    expect(supportsCenteredTopDoorPull(islandWall)).toBe(false);
  });
});
