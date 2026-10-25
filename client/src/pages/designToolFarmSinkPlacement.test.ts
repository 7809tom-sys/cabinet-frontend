import { describe, expect, it } from "vitest";
import type { PlacedCabinet, RoomData } from "@/lib/design";
import { resolveFarmSinkPalettePlacement } from "./designToolFarmSinkPlacement";

const room: RoomData = { width: 144, depth: 120 };
const farm = { masterCode: "FSB-36", description: '36" Farmhouse Sink Base' };

function base(partial: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "base", cabinetId: 1, masterCode: "B-24", description: "Base 24", placement: "base",
    x: 0, y: 0, width: 24, depth: 24, rotation: 0, ...partial,
  };
}

describe("DesignTool farm sink palette flow", () => {
  it("resolves FSB-36 to the active wall opening", () => {
    expect(resolveFarmSinkPalettePlacement(farm, "top", room, [], [], 36, 24))
      .toMatchObject({ applies: true, spot: { x: 0, y: 0, rotation: 0 }, message: null });
  });

  it("rejects FSB-36 with a no-space message instead of returning a floating spot", () => {
    const fullTopWall = [base({ x: 0, y: 0, width: 144, depth: 24 })];
    const result = resolveFarmSinkPalettePlacement(farm, "top", room, fullTopWall, [], 36, 24);
    expect(result).toMatchObject({ applies: true, spot: null });
    expect(result.message).toContain("no 36\" opening on the active wall");
  });
});
