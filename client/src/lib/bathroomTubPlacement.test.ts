import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, furnitureFootprint, furniturePlanFrame, makeFurniture, resolvedFurnitureDimensions } from "./design";
import { bathroomFixtureStarterZonePlacement, makeBathroomStarterTemplate, resizeBathroomZone, rotateBathroomFurniture } from "./bathroomPlanning";
import { verifiedPelicanBathroomFixtureProfile } from "./pelicanBathroomFixtureProfiles";

describe("Bathroom tub rotation and resizable planning zones", () => {
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
  it("resizes only the tub planning zone and allows a 67-inch tub parallel to the wall", () => {
    const starter = makeBathroomStarterTemplate();
    const zone = starter.furniture.find((f) => f.defId === "bathroom-zone-tub-60")!;
    const result = resizeBathroomZone(zone, { widthIn: 72, depthIn: 36, x: 0, y: 60, rotation: 0 }, starter.room);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(resolvedFurnitureDimensions(result.item)).toEqual({ w: 72, d: 36 });
    expect(furnitureFootprint(result.item, FURNITURE_CATALOG.find((item) => item.id === zone.defId)!)).toEqual({ w: 72, d: 36 });
    const placement = bathroomFixtureStarterZonePlacement(makeFurniture("pelican-tub-pl-02146-67", 0, 0), [result.item]);
    expect(placement).toMatchObject({ rotation: 90, zoneUid: zone.uid });
    expect(placement!.x).toBeGreaterThanOrEqual(0);
    expect(placement!.y).toBeGreaterThanOrEqual(60);
    const restored = JSON.parse(JSON.stringify(result.item));
    expect(resolvedFurnitureDimensions(restored)).toEqual({ w: 72, d: 36 });
    expect(restored.pelicanCode).toBeUndefined();
  });
  it("rejects nonfinite, zero, oversized and out-of-room zone changes atomically", () => {
    const zone = makeFurniture("bathroom-zone-tub-60", 0, 60);
    const snapshot = JSON.stringify(zone);
    for (const patch of [{ widthIn: 0 }, { widthIn: NaN }, { depthIn: Infinity }, { widthIn: 121 }, { y: 80 }]) {
      expect(resizeBathroomZone(zone, { widthIn: 60, depthIn: 36, x: 0, y: 60, rotation: 0, ...patch }, { width: 120, depth: 96 }).ok).toBe(false);
    }
    expect(JSON.stringify(zone)).toBe(snapshot);
  });
  it("never allows a planning-zone override to resize an actual sourced tub", () => {
    const tub = { ...makeFurniture("pelican-tub-pl-02146-67", 0, 0), planningZoneSize: { version: 1 as const, widthIn: 10, depthIn: 10 } };
    expect(resizeBathroomZone(tub, { widthIn: 72, depthIn: 36, x: 0, y: 0, rotation: 0 }, { width: 120, depth: 96 }).ok).toBe(false);
    const source = verifiedPelicanBathroomFixtureProfile('PL-02146 67"')!;
    expect(resolvedFurnitureDimensions(tub)).toEqual({ w: source.widthIn, d: source.depthIn });
    expect(source.tubShape).toBe("rectangular");
  });
});
