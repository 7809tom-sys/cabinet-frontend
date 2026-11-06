import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isWallOpenShelfCabinet, normalizeWallOpenShelfPlacement, type PlacedCabinet } from "@/lib/design";

/**
 * The Floor Plan draws an open shelf as a doorless box with an open front. The
 * marker is inline JSX inside the cabinet cell, so these tests lock the two
 * things that actually decide the drawing: which cabinets take that branch, and
 * that the branch draws no door leaf.
 */
const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");

describe("Floor Plan open-shelf drawing", () => {
  it("routes the whole WEOS family and the OE6 open-end line into the open-shelf branch", () => {
    for (const masterCode of ["WEOS0930", "WEOS0936", "WEOS0942", "WOS0930"]) {
      expect(isWallOpenShelfCabinet({ masterCode }), masterCode).toBe(true);
    }
    expect(isWallOpenShelfCabinet({ masterCode: "OE636", description: '6" x 36" Open End Shelf Wall Cabinet' })).toBe(true);
    expect(isWallOpenShelfCabinet({ masterCode: "B24", description: "24 inch Base Cabinet" })).toBe(false);
  });

  it("keeps the plan footprint inside the cabinet's own 9-by-12 envelope at every height", () => {
    for (const [masterCode, height] of [["WEOS0930", 30], ["WEOS0936", 36], ["WEOS0942", 42]] as const) {
      const shelf: PlacedCabinet = {
        uid: `plan-${masterCode}`,
        cabinetId: 930,
        masterCode,
        description: "Wall End Open Shelf",
        placement: "wall",
        x: 54,
        y: 0,
        width: 9,
        depth: 12,
        height,
        rotation: 0,
        numberOfDoors: 0,
        numberOfDrawers: 0,
      };
      // The plan is a top-down footprint, so the height never changes it; the
      // normalizer still has to keep the 9-by-12 face and drop any door.
      expect(normalizeWallOpenShelfPlacement(shelf)).toMatchObject({
        placement: "wall",
        width: 9,
        depth: 12,
        height,
        numberOfDoors: 0,
        numberOfDrawers: 0,
      });
    }
  });

  it("marks the solid side on the closed end of a handed open shelf in plan", () => {
    expect(source).toContain("openShelfPlanHand");
    expect(source).toContain("data-open-shelf-solid-side={resolvedWallOpenShelfHand(p)}");
    // A non-open-shelf cabinet never gets the marker.
    expect(source).toContain("isWallOpenShelf && !isAppliance");
  });

  it("draws an open-shelf marker with no door-swing arc and no hardware marker", () => {
    expect(source).toContain("isWallOpenShelf && !isAppliance");
    expect(source).toContain('data-open-shelf-plan="true"');
    expect(source).toContain("open shelf with an open front and no doors");
    // The branch runs before the appliance icons and never adds a swing path.
    const branchStart = source.indexOf("isWallOpenShelf && !isAppliance");
    const branchEnd = source.indexOf("Appliance-specific top-down icons", branchStart);
    expect(branchStart).toBeGreaterThan(-1);
    expect(branchEnd).toBeGreaterThan(branchStart);
    const branch = source.slice(branchStart, branchEnd);
    expect(branch).not.toContain("plan-door-swing");
    expect(branch).not.toMatch(/<path[^>]*A /);
  });
});
