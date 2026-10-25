import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("floating-shelf palette placement", () => {
  it("keeps a floating shelf on the selected room wall even when catalog filtering labels it as a base item", () => {
    expect(source).toContain("const isFloatingShelf = isFloatingShelfItem(c);");
    expect(source).toContain('const accPlacement = isFloatingShelf ? "wall"');
    expect(source).toContain("const requestedIslandFace = isFloatingShelf ? null");
    expect(source).toContain('freeSegmentsOnWall(activeWall, room, prev, openings, width, WALL_OPENING_CLEARANCE_IN, "wall", false, candidate)');
    expect(source).toContain("The shelf was not moved to the island or room center.");
  });
});
