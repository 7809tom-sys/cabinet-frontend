import { describe, expect, it } from "vitest";
import { dim, glassDoorShelfCount, isGlassDoorCabinet, normalizePlacedWallCabinetSkuDimensions, refrigeratorEndPanelThickness, removeOverlappingPlacements, resolvedDesignCabinetDimensions, wallCabinetSkuDimensions, type DesignCabinet, type PlacedCabinet } from "./design";

function wallCabinet(masterCode: string, dimensions: Partial<Pick<DesignCabinet, "width" | "height" | "depth">> = {}): DesignCabinet {
  return {
    id: 1,
    masterCode,
    description: "Wall cabinet",
    category: "Wall",
    subCategory: null,
    width: "12",
    height: "24",
    depth: "12",
    placement: "wall",
    numberOfDoors: 2,
    numberOfDrawers: 0,
    isCornerCabinet: false,
    ...dimensions,
  };
}

describe("authoritative wall cabinet SKU dimensions", () => {
  it("parses supplier fractional dimensions before decimal prefixes", () => {
    // A refrigerator end panel often arrives as 3/4, not 0.75. Reading the
    // leading 3 would turn a 36-inch appliance enclosure into 42 inches wide.
    expect(dim("3/4", 1)).toBe(0.75);
    expect(dim("1 1/2", 1)).toBe(1.5);
    expect(dim('0.75"', 1)).toBe(0.75);
    expect(dim("3/4 x 96", 1)).toBe(0.75);
    expect(refrigeratorEndPanelThickness("3/4")).toBe(0.75);
    expect(36 + refrigeratorEndPanelThickness("3/4") * 2).toBe(37.5);
  });

  it.each([
    ["W-36-24", { width: 36, height: 24, depth: 12 }],
    ["HONEY CORE W-36-24", { width: 36, height: 24, depth: 12 }],
    ["WR3624", { width: 36, height: 24, depth: 24 }],
    ["W302424", { width: 30, height: 24, depth: 24 }],
    ["W3012GD", { width: 30, height: 12, depth: 12 }],
    ["W3624", { width: 36, height: 24, depth: 12 }],
  ])("parses %s", (masterCode, expected) => {
    expect(wallCabinetSkuDimensions(masterCode)).toEqual(expected);
  });

  it("overrides stale positive catalog columns before W-36-24 is placed or snapped", () => {
    expect(resolvedDesignCabinetDimensions(wallCabinet("W-36-24", { width: "12", height: "24", depth: "12" })))
      .toEqual({ width: 36, height: 24, depth: 12 });
  });

  it("uses the AEF printed dimensions instead of stale shared-master columns", () => {
    expect(resolvedDesignCabinetDimensions(wallCabinet("W3012", {
      width: "30",
      height: "12",
      depth: "12",
      constructionMethod: "Frameless; distributor geometry is printed in AltaEuro Collection Full Spec Book V8.2",
    }))).toEqual({ width: 30, height: 12.625, depth: 13.5 });
  });

  it("uses the AEF printed 34.75-inch overall base height without changing the shared master rule", () => {
    expect(resolvedDesignCabinetDimensions({
      ...wallCabinet("B18", { width: "18", height: "34.75", depth: "24" }),
      placement: "base",
      constructionMethod: "Frameless; distributor geometry is printed in AltaEuro Collection Full Spec Book V8.2",
    })).toEqual({ width: 18, height: 34.75, depth: 24 });
    expect(resolvedDesignCabinetDimensions({
      ...wallCabinet("B18", { width: "18", height: "34.5", depth: "24" }),
      placement: "base",
    })).toEqual({ width: 18, height: 34.5, depth: 24 });
  });

  it("leaves non-dimensional and non-wall catalog families on their stored dimensions", () => {
    expect(wallCabinetSkuDimensions("AW1242")).toBeNull();
    expect(resolvedDesignCabinetDimensions({ ...wallCabinet("B-36", { width: "36", height: "34.5", depth: "24" }), placement: "base" }))
      .toEqual({ width: 36, height: 34.5, depth: 24 });
  });

  it("repairs a stale saved W-36-24 footprint before restore collision cleanup", () => {
    const stale = {
      uid: "saved-w-36-24", cabinetId: 1, masterCode: "W-36-24", description: "Wall cabinet",
      placement: "wall", x: 0, y: 0, width: 12, height: 24, depth: 12, rotation: 0,
    } as PlacedCabinet;
    const restored = removeOverlappingPlacements([stale]).placed[0];
    expect(restored).toMatchObject({ width: 36, nominalWidth: 36, height: 24, nominalHeight: 24, depth: 12, nominalDepth: 12 });
  });

  it("preserves an intentional custom width while retaining the SKU as its nominal catalog size", () => {
    const custom = {
      uid: "custom-w-36-24", cabinetId: 1, masterCode: "W-36-24", description: "Custom wall cabinet",
      placement: "wall", x: 0, y: 0, width: 35.5, nominalWidth: 36, height: 24, nominalHeight: 24, depth: 12, nominalDepth: 12, rotation: 0,
    } as PlacedCabinet;
    expect(normalizePlacedWallCabinetSkuDimensions(custom)).toMatchObject({ width: 35.5, nominalWidth: 36, height: 24, depth: 12 });
  });
});

describe("authoritative glass-door cabinet classification", () => {
  it.each([
    ["W2442GD", "Wall cabinet"],
    ["W-24-42GD", "Legacy wall cabinet"],
    ["W2442", "24 inch Glass Door Wall Cabinet"],
  ])("recognizes %s / %s without relying on a saved upgrade flag", (masterCode, description) => {
    expect(isGlassDoorCabinet({ masterCode, description })).toBe(true);
  });

  it("does not misclassify an ordinary wall cabinet", () => {
    expect(isGlassDoorCabinet({ masterCode: "W2442", description: "24 inch Double Door Wall Cabinet" })).toBe(false);
  });

  it("keeps structured shelf counts primary and parses W2442GD's three shelves when fields are missing", () => {
    expect(glassDoorShelfCount({ description: '24" Double Door Glass Door Wall Cabinet with 3 Adjustable Shelves' })).toBe(3);
    expect(glassDoorShelfCount({ description: "Glass Door Wall Cabinet with 3 Adjustable Shelves", fixedShelfCount: 1, adjustableShelfCount: 1 })).toBe(2);
  });
});
