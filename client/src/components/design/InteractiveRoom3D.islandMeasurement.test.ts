import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(new URL("./InteractiveRoom3D.tsx", import.meta.url), "utf8");

describe("InteractiveRoom3D island measurement wiring", () => {
  it("uses island-face opening measurements for island-owned selected cabinets before room-wall measurement", () => {
    expect(source).toContain("selectedPlacedCabinet && island && selectedPlacedCabinet.islandFace");
    expect(source).toContain("islandFaceFitMeasure(selectedPlacedCabinet, island, placed)");
    expect(source.indexOf("islandFaceFitMeasure(selectedPlacedCabinet, island, placed)")).toBeLessThan(
      source.indexOf("wallCabinetFitMeasure(selectedPlacedCabinet, roomOverride, placed, openings, selectedWall)"),
    );
  });
});
