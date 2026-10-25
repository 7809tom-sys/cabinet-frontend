import { describe, expect, it } from "vitest";
import {
  alternateWallPlacementRecommendation,
  type PlacedCabinet,
  type RoomData,
} from "./design";

const room = { width: 144, depth: 120, ceilingHeight: 96 } as RoomData;

function cabinet(partial: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "existing",
    cabinetId: 1,
    masterCode: "B-120",
    description: "Existing base run",
    category: "Base",
    subCategory: null,
    placement: "base",
    x: 0,
    y: 0,
    width: 120,
    depth: 24,
    height: 34.5,
    rotation: 90,
    ...partial,
  } as PlacedCabinet;
}

describe("alternate wall placement recommendation", () => {
  it("offers a different clear wall when the selected wall is full", () => {
    const recommendation = alternateWallPlacementRecommendation(
      "left",
      room,
      [cabinet({})],
      [],
      36,
      24,
      "base",
    );

    expect(recommendation).toMatchObject({ side: "right", availableLength: 120, spot: { x: 120, y: 0, rotation: 90 } });
  });

  it("returns no recommendation when no other wall has a fitting measured opening", () => {
    const fullRuns = [
      cabinet({ uid: "left", x: 0, y: 0, rotation: 90 }),
      cabinet({ uid: "right", x: 120, y: 0, rotation: 90 }),
      cabinet({ uid: "top", x: 0, y: 0, rotation: 0, width: 144 }),
      cabinet({ uid: "bottom", x: 0, y: 96, rotation: 0, width: 144 }),
    ];
    expect(alternateWallPlacementRecommendation("left", room, fullRuns, [], 36, 24, "base")).toBeNull();
  });
});
