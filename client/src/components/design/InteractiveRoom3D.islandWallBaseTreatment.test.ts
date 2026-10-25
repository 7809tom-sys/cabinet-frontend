import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { existingCabinetSku } from "./InteractiveRoom3D";

const source = fs.readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");
const elevationSource = fs.readFileSync(new URL("./ElevationView.tsx", import.meta.url), "utf8");

describe("InteractiveRoom3D island wall cabinet base treatment", () => {
  it("preserves the selected base-molding option from the saved placement into the 3D SKU", () => {
    const sku = existingCabinetSku({
      uid: "island-wall-1", cabinetId: 1, masterCode: "W2430", description: "24 inch wall cabinet",
      placement: "wall", x: 0, y: 0, width: 24, height: 30, depth: 12,
      islandFace: "front", islandCounterHeightWallCabinet: true, islandWallCabinetBaseTreatment: "base-molding",
    } as never);
    expect(sku.islandCounterHeightWallCabinet).toBe(true);
    expect(sku.islandWallCabinetBaseTreatment).toBe("base-molding");
  });

  it("constructs a full-depth furniture plinth only for the selected island wall-cabinet treatment", () => {
    expect(source).toContain("hasFurnitureBaseMolding");
    expect(source).toContain("islandWallCabinetBaseMolding: true");
    expect(source).toContain("islandCounterHeightWallCabinet");
    expect(source).toContain("isFloorStandingCabinet && !isCounterHeightIslandWallCabinet");
  });

  it("keeps an island wall cabinet pull vertical on its existing door rail when raised", () => {
	    expect(source).toContain("const raisedFloorWallDoorPull = !drawer && usesRaisedFloorWallDoorPull");
	    expect(source).toContain("const horizontalTopRailPull = requestedTopCenteredDoorPull && !raisedFloorWallDoorPull;");
	    expect(source).toContain('pullEdge: raisedFloorWallDoorPull ? "raised-door-rail"');
    expect(source).toContain("verticalPull: !drawer && !horizontalTopRailPull");
	    expect(elevationSource).toContain("const raisedWallDoorPull = Boolean(isDoor && raisedDoorPullOnRail);");
    expect(elevationSource).toContain('data-hardware-orientation={horizontalTopRailPull ? "horizontal" : isDoor ? "vertical" : "horizontal"}');
  });
});
