import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer island countertop pricing", () => {
  it("measures the same visible island countertop fragments used by the 2D and 3D renderers", () => {
    expect(source).toContain("countertopArea(placed, island, island ? islandCountertopVisibleRects(island, placed) : null, room)");
  });

  it("passes measured countertop square footage into priced surface quantities and totals", () => {
	    expect(source).toContain("perimeterCountertopSqFt: countertopMeasurement?.perimeterSquareFeet ?? 0");
	    expect(source).toContain("islandCountertopSqFt: countertopMeasurement?.islandSquareFeet ?? 0");
	    expect(source).toContain("island, countertop, backsplashHeightMode");
	    expect(source).toContain("estimatedSubtotal={calculateCartSubtotal(surfaceCartLines)}");
  });

  it("passes the same price-locked countertop slab measurement into the material picker", () => {
    expect(source).toContain("countertopPriceLines={surfaceCartLines");
    expect(source).toContain("/countertop|quartz\\s+slab/i.test(line.category ?? \"\")");
    expect(source).toContain("qtyNote: line.qtyNote");
  });
});
