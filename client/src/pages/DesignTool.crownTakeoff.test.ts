import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const designToolSource = fs.readFileSync(path.resolve(__dirname, "DesignTool.tsx"), "utf8");

describe("DesignTool crown takeoff routing", () => {
  it("orders crown from the final exposed 3D perimeter and the 4-inch-miter takeoff", () => {
    expect(designToolSource).toContain('import { crownTakeoffFromExposedSegments } from "@/lib/crownTakeoff";');
    expect(designToolSource).toContain("threeDCrownPerimeterSegments(placed, room)");
    expect(designToolSource).toContain("trimPiecesNeeded(crownTakeoff.totalLinearInches)");
    expect(designToolSource).toContain('includes both 4&quot; miter cuts at each exposed crown corner');
  });

  it("orders light rail from the shared exposed under-cabinet perimeter takeoff", () => {
    expect(designToolSource).toContain("trimPiecesNeeded(lightRailLinearInches(placed, room))");
    expect(designToolSource).toContain("Light rail follows the actual exposed underside perimeter of upper cabinets");
  });
});
