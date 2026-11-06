import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, furnitureFootprint, furniturePlanFrame, makeFurniture, resolvedFurnitureDimensions } from "./design";
import { bathroomFixtureFreePlacement, rotateBathroomFurniture } from "./bathroomPlanning";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";

describe("Bathroom tub rotation and free placement", () => {
  it("rotates a tub once, preserving its center instead of swapping then rotating the swapped box", () => {
    const tub = makeFurniture("pelican-tub-pl-02146-67", 30, 12);
    const rotated = rotateBathroomFurniture(tub, { width: 120, depth: 96 });
    const before = furniturePlanFrame(tub)!;
    const after = furniturePlanFrame(rotated)!;
    expect(after.rotation).toBe(90);
    expect(after.width).toBe(before.width);
    expect(after.depth).toBe(before.depth);
    expect(after.boundWidth).toBeCloseTo(before.depth);
    expect(after.boundDepth).toBeCloseTo(before.width);
    expect(after.centerX).toBeCloseTo(before.centerX);
    expect(after.centerY).toBeCloseTo(before.centerY);
  });

  it("returns to the same coordinates after four centered turns away from room edges", () => {
    const tub = makeFurniture("pelican-tub-pl-02146-59", 40, 35);
    let current = tub;
    for (let i = 0; i < 4; i++) current = rotateBathroomFurniture(current, { width: 160, depth: 160 });
    expect(current.rotation).toBe(0);
    expect(current.x).toBeCloseTo(tub.x);
    expect(current.y).toBeCloseTo(tub.y);
  });

  it("finds an open spot for a 67-inch tub without resizing anything", () => {
    const room = { width: 120, depth: 96 };
    const placement = bathroomFixtureFreePlacement(makeFurniture("pelican-tub-pl-02146-67", 0, 0), [], room);
    expect(placement).not.toBeNull();
    const tub = makeFurniture("pelican-tub-pl-02146-67", placement!.x, placement!.y);
    const definition = FURNITURE_CATALOG.find((item) => item.id === tub.defId)!;
    const footprint = furnitureFootprint({ ...tub, rotation: placement!.rotation }, definition);
    expect(placement!.x + footprint.w).toBeLessThanOrEqual(room.width + 0.01);
    expect(placement!.y + footprint.d).toBeLessThanOrEqual(room.depth + 0.01);
    // The placed envelope is always the supplier's own size.
    expect(resolvedFurnitureDimensions(tub)).toEqual({ w: definition.w, d: definition.d });
    expect(JSON.parse(JSON.stringify(tub)).planningZoneSize).toBeUndefined();
  });

  it("returns null only when an envelope cannot fit the room at all", () => {
    expect(bathroomFixtureFreePlacement(makeFurniture("pelican-tub-pl-02146-67", 0, 0), [], { width: 10, depth: 10 })).toBeNull();
  });

  it("keeps sourced fixtures at their exact supplier dimensions", () => {
    const tub = makeFurniture("pelican-tub-pl-02146-67", 0, 0);
    const source = verifiedPelicanBathroomFixtureProfile('PL-02146 67"')!;
    expect(resolvedFurnitureDimensions(tub)).toEqual({ w: source.widthIn, d: source.depthIn });
    expect(source.tubShape).toBe("rectangular");
  });
});
