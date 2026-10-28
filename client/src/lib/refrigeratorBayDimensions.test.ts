import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM, REFRIGERATOR_END_PANEL_THICKNESS_IN, formatEighthInches, refrigeratorBayRunMetrics, refrigeratorEndPanelThickness, type PlacedCabinet } from "@/lib/design";

const room = { ...DEFAULT_ROOM, width: 144, depth: 120 };

function fridge(width: number): PlacedCabinet {
  return { uid: `fridge-${width}`, cabinetId: 1, masterCode: `FRIDGE-${width}`, description: "Refrigerator", placement: "appliance", x: 30, y: 0, width, depth: 30, height: 70, rotation: 0 };
}

describe("refrigerator bay outside dimensions", () => {
  it("uses 3/4-inch end panels whatever the catalog width column says", () => {
    expect(REFRIGERATOR_END_PANEL_THICKNESS_IN).toBe(0.75);
    for (const width of ["1", "1.5", "3/4", "0.75", null, "24"]) expect(refrigeratorEndPanelThickness(width)).toBe(0.75);
  });

  for (const [fridgeWidth, outside] of [[36, 38.5], [33, 35.5], [30, 32.5]] as const) {
    it(`builds a ${fridgeWidth}-inch fridge bay ${outside} inches outside with 1/2-inch cap fillers`, () => {
      const bay = refrigeratorBayRunMetrics(fridge(fridgeWidth), room);
      // 1 inch of clearance split 1/2 and 1/2 between the fridge and the panels.
      expect(bay.openingWidth).toBe(fridgeWidth + 1);
      expect(bay.openingWidth + refrigeratorEndPanelThickness() * 2).toBe(outside);
      // A wall fridge cabinet of the same width leaves 1/2 inch each side for its cap filler.
      expect((bay.openingWidth - fridgeWidth) / 2).toBe(0.5);
    });
  }

  it("labels the panel and filler in eighths, not rounded to 1 inch", () => {
    expect(formatEighthInches(0.75)).toBe('¾"');
    expect(formatEighthInches(0.5)).toBe('½"');
  });
});
