import { describe, expect, it } from "vitest";
import type { DesignCabinet } from "@/lib/design";
import { catalogHeightOptions, filterCatalogByHeight, formatCatalogHeight, formatCatalogInchValue } from "./designToolCatalogHeights";

const cabinet = (masterCode: string, height: number, category = "Wall") => ({
  id: masterCode.length,
  masterCode,
  description: masterCode,
  category,
  height,
  width: 24,
  depth: category === "Base" ? 24 : 12,
  placement: category === "Base" ? "base" : "wall",
}) as DesignCabinet;

describe("compact designer catalog height selector", () => {
  it("lists only available heights with counts, tallest first", () => {
    expect(catalogHeightOptions([
      cabinet("W1242", 42),
      cabinet("W2442", 42),
      cabinet("W3030", 30),
      cabinet("W3024", 24),
    ], "wall")).toEqual([
      { height: 42, count: 2, label: '42"' },
      { height: 30, count: 1, label: '30"' },
      { height: 24, count: 1, label: '24"' },
    ]);
  });

  it("treats base-family boxes as the standard 34½-inch external height", () => {
    expect(catalogHeightOptions([
      cabinet("B-24", 24, "Base"),
      cabinet("BFH-18", 18, "Base"),
    ], "base")).toEqual([{ height: 34.5, count: 2, label: '34½"' }]);
  });

  it("keeps a source-listed 7-inch vanity knee drawer separate from a full-height vanity", () => {
    const sink = { ...cabinet("VS24", 34.5, "Vanity"), placement: "base" as const };
    const knee = { ...cabinet("VKD36", 7, "Vanity"), description: "Vanity Knee Drawer", placement: "base" as const };
    expect(catalogHeightOptions([sink, knee], "vanity")).toEqual([
      { height: 34.5, count: 1, label: '34½"' },
      { height: 7, count: 1, label: '7"' },
    ]);
    expect(filterCatalogByHeight([sink, knee], "vanity", 7)).toEqual([knee]);
  });

  it("filters to the selected height without cloning or changing supplier records", () => {
    const thirty = cabinet("W3030", 30);
    const fortyTwo = cabinet("W3042", 42);
    const filtered = filterCatalogByHeight([thirty, fortyTwo], "wall", 30);
    expect(filtered).toEqual([thirty]);
    expect(filtered[0]).toBe(thirty);
  });

  it("keeps corner base boxes at 34½ inches while retaining true corner-wall heights", () => {
    const base = cabinet("BBC-42", 42, "Base");
    const wall = cabinet("WDC2442", 42, "Wall");
    expect(catalogHeightOptions([base, wall], "corner", (item) => item === base)).toEqual([
      { height: 42, count: 1, label: '42"' },
      { height: 34.5, count: 1, label: '34½"' },
    ]);
  });

  it("formats whole, half, and uncommon fractional heights compactly", () => {
    expect(formatCatalogHeight(42)).toBe('42"');
    expect(formatCatalogHeight(34.5)).toBe('34½"');
    expect(formatCatalogHeight(17.25)).toBe('17.25"');
  });

  it("keeps every cabinet selection dimension in inches rather than converting values over twelve inches to feet", () => {
    expect(formatCatalogInchValue(9)).toBe("9");
    expect(formatCatalogInchValue(18)).toBe("18");
    expect(formatCatalogInchValue(30)).toBe("30");
    expect(formatCatalogInchValue(36)).toBe("36");
    expect(formatCatalogInchValue(42)).toBe("42");
    expect(formatCatalogInchValue(96)).toBe("96");
    expect(formatCatalogInchValue(34.5)).toBe("34½");
  });
});
