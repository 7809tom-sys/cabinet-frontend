import { describe, expect, it } from "vitest";
import { FURNITURE_CATALOG, furnitureFootprint, makeFurniture } from "./design";

describe("modern furniture props", () => {
  it("exposes a dedicated modern collection with usable planning footprints", () => {
    const modern = FURNITURE_CATALOG.filter((item) => item.collection === "modern");
    expect(modern.map((item) => item.id)).toEqual([
      "modern-sofa-84",
      "modern-lounge-chair",
      "modern-coffee-table",
      "modern-media-console",
      "modern-floor-lamp",
      "modern-planter",
    ]);
    expect(modern.every((item) => item.w > 0 && item.d > 0 && (item.height ?? 0) > 0)).toBe(true);
  });

  it("creates movable modern props through the same saved furniture placement shape", () => {
    const definition = FURNITURE_CATALOG.find((item) => item.id === "modern-sofa-84")!;
    const placed = makeFurniture(definition.id, 48, 36);
    expect(placed).toMatchObject({ defId: "modern-sofa-84", x: 48, y: 36, rotation: 0 });
    expect(placed.uid).toMatch(/^furn-/);
    expect(furnitureFootprint(placed, definition)).toEqual({ w: 84, d: 36 });
  });
});
