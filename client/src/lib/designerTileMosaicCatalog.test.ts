import { describe, expect, it } from "vitest";
import { groupPelicanConfigurations } from "@shared/pelicanConfigurationGrouping";
import {
  isDesignerPaletteItemVisible,
  isSelectableDesignerTileMosaic,
  mergePreferredPaletteProducts,
} from "./designerTileMosaicCatalog";

const options = {
  isBathroom: false,
  hasVerifiedFixtureProfile: () => false,
  matchesCountertopSwatch: () => true,
};

describe("Designer tile and mosaic catalog visibility", () => {
  it("keeps every priced Designer tile and mosaic, including rows without a material swatch or card photo", () => {
    const rows = [
      { category: "Tile & Mosaic", subCategory: "Mosaic", name: "Arctic Vail", sellPrice: 8, materialImageUrl: "/swatch.webp", showInDesigner: true, isActive: true },
      { category: "Tile & Mosaic", subCategory: "Mosaic", name: "Moonstone Hex", sellPrice: 34.38, materialImageUrl: null, showInDesigner: true, isActive: true },
      { category: "Tile & Mosaic", subCategory: "Tile", name: "PL-O2519WBS", sellPrice: 222.3, materialImageUrl: null, showInDesigner: true, isActive: true },
      { category: "Tile & Mosaic", subCategory: "Tile", name: "Special Order PF-4825FM", sellPrice: 1197, materialImageUrl: null, imageUrl: null, showInDesigner: true, isActive: true },
      { category: "Tile & Mosaic", name: "Hidden from Designer", sellPrice: 10, showInDesigner: false, isActive: true },
      { category: "Tile & Mosaic", name: "Inactive", sellPrice: 10, showInDesigner: true, isActive: false },
      { category: "Tile & Mosaic", name: "Unpriced", sellPrice: 0, showInDesigner: true, isActive: true },
      { category: "Flooring", name: "Photo-only floor", sellPrice: 40, materialImageUrl: null, showInDesigner: true, isActive: true },
      { category: "Flooring", name: "Swatch floor", sellPrice: 40, materialImageUrl: "/floor.webp", showInDesigner: true, isActive: true },
    ];

    const visible = rows.filter((row) => isDesignerPaletteItemVisible(row, options));
    expect(visible.map((row) => row.name)).toEqual([
      "Arctic Vail",
      "Moonstone Hex",
      "PL-O2519WBS",
      "Special Order PF-4825FM",
      "Swatch floor",
    ]);
    expect(isSelectableDesignerTileMosaic(rows[1]!)).toBe(true);
    expect(isSelectableDesignerTileMosaic(rows[3]!)).toBe(true);
  });

  it("does not collapse distinct mosaic and field-tile products onto one card", () => {
    const cards = groupPelicanConfigurations([
      { id: 47, name: "Arctic Vail", pelicanCode: "Arctic Vail", category: "Tile & Mosaic", subCategory: "Mosaic" },
      { id: 364, name: "Moonstone Hex", pelicanCode: "Moonstone Hex", category: "Tile & Mosaic", subCategory: "Mosaic" },
      { id: 144, name: "Carrara Subway", pelicanCode: "Carrara Subway", category: "Tile & Mosaic", subCategory: "Mosaic" },
      { id: 1003, name: "PL-O2519WBS", pelicanCode: "PL-O2519WBS", category: "Tile & Mosaic", subCategory: "Tile" },
      { id: 1245, name: "Special Order PF-4825FM", pelicanCode: "Special Order PF-4825FM", category: "Tile & Mosaic", subCategory: "Tile" },
    ]);
    expect(cards).toHaveLength(5);
  });

  it("adds swatch-less saved tile favorites without replacing Designer-resolved rows", () => {
    const merged = mergePreferredPaletteProducts(
      [{ id: 47, category: "Tile & Mosaic", name: "Arctic Vail" }],
      [
        { id: 47, category: "Tile & Mosaic", name: "Arctic Vail duplicate" },
        { id: 364, category: "Tile & Mosaic", name: "Moonstone Hex" },
        { id: 9, category: "Sinks & Faucets", name: "Unverified sink" },
      ],
    );
    expect(merged.map((row) => row.name)).toEqual(["Arctic Vail", "Moonstone Hex"]);
  });

  it("still shows bathroom fixtures that are not tile", () => {
    expect(isDesignerPaletteItemVisible(
      { category: "Toilets & Bidets", sellPrice: 200 },
      { ...options, isBathroom: true },
    )).toBe(true);
  });
});
