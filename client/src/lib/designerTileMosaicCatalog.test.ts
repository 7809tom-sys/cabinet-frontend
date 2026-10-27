import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { groupPelicanConfigurations } from "@shared/pelicanConfigurationGrouping";
import {
  concatCatalogPages,
  designerMaterialRenderReady,
  flooringSceneTextureUrl,
  isDesignerPaletteItemVisible,
  isSelectableDesignerFlooringPlank,
  isSelectableDesignerTileMosaic,
  mergePreferredPaletteProducts,
} from "./designerTileMosaicCatalog";

const options = {
  isBathroom: false,
  hasVerifiedFixtureProfile: () => false,
  matchesCountertopSwatch: () => true,
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((entry) => entry.some((value) => value.length > 0))
    .map((entry) => Object.fromEntries(header.map((key, column) => [key, entry[column] ?? ""])));
}

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
      { category: "Flooring", subCategory: "Planks & Flooring", name: "Photo-only floor", sellPrice: 40, materialImageUrl: null, imageUrl: "/photo.webp", showInDesigner: true, isActive: true },
      { category: "Flooring", subCategory: "Planks & Flooring", name: "Swatch floor", sellPrice: 40, materialImageUrl: "/floor.webp", showInDesigner: true, isActive: true },
      { category: "Flooring", subCategory: "Moldings & Trim", name: "Stair nose", sellPrice: 12, materialImageUrl: null, showInDesigner: true, isActive: true },
      { category: "Flooring", subCategory: "Underlayment", name: "Underlayment roll", sellPrice: 30, materialImageUrl: null, showInDesigner: true, isActive: true },
    ];

    const visible = rows.filter((row) => isDesignerPaletteItemVisible(row, options));
    expect(visible.map((row) => row.name)).toEqual([
      "Arctic Vail",
      "Moonstone Hex",
      "PL-O2519WBS",
      "Special Order PF-4825FM",
      "Photo-only floor",
      "Swatch floor",
    ]);
    expect(isSelectableDesignerTileMosaic(rows[1]!)).toBe(true);
    expect(isSelectableDesignerTileMosaic(rows[3]!)).toBe(true);
    expect(isSelectableDesignerFlooringPlank(rows[7]!)).toBe(true);
    expect(isSelectableDesignerFlooringPlank(rows[9]!)).toBe(false);
    expect(isSelectableDesignerFlooringPlank(rows[10]!)).toBe(false);
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

  it("adds swatch-less saved tile and flooring favorites without replacing Designer-resolved rows", () => {
    const merged = mergePreferredPaletteProducts(
      [{ id: 47, category: "Tile & Mosaic", name: "Arctic Vail" }],
      [
        { id: 47, category: "Tile & Mosaic", name: "Arctic Vail duplicate" },
        { id: 364, category: "Tile & Mosaic", name: "Moonstone Hex" },
        { id: 51, category: "Flooring", subCategory: "Planks & Flooring", name: "Astoria 20mil Vinyl Flooring", sellPrice: 74.25, showInDesigner: true, isActive: true },
        { id: 55, category: "Flooring", subCategory: "Moldings & Trim", name: "Astoria End Cap", sellPrice: 19, showInDesigner: true, isActive: true },
        { id: 9, category: "Sinks & Faucets", name: "Unverified sink" },
      ],
    );
    expect(merged.map((row) => row.name)).toEqual(["Arctic Vail", "Moonstone Hex", "Astoria 20mil Vinyl Flooring"]);
  });

  it("still shows bathroom fixtures that are not tile or flooring", () => {
    expect(isDesignerPaletteItemVisible(
      { category: "Toilets & Bidets", sellPrice: 200 },
      { ...options, isBathroom: true },
    )).toBe(true);
    expect(isDesignerPaletteItemVisible(
      { category: "Flooring", subCategory: "Moldings & Trim", name: "Quarter round", sellPrice: 12, showInDesigner: true, isActive: true },
      { ...options, isBathroom: true },
    )).toBe(false);
  });

  it("uses a backend swatch flag when present and otherwise infers readiness from materialImageUrl", () => {
    expect(designerMaterialRenderReady({ materialImageUrl: "/swatch.webp" })).toBe(true);
    expect(designerMaterialRenderReady({ materialImageUrl: null, imageUrl: "/catalog-photo.webp" })).toBe(false);
    expect(designerMaterialRenderReady({ designerRenderReady: false, materialImageUrl: "/swatch.webp" })).toBe(false);
    expect(designerMaterialRenderReady({ hasSwatch: true, materialImageUrl: "/swatch.webp" })).toBe(true);
    expect(designerMaterialRenderReady({ designerRenderReady: true, hasSwatch: false, materialImageUrl: null })).toBe(true);

    const curated = { 82: "/manus-storage/bahia-floor.webp" };
    expect(flooringSceneTextureUrl({
      id: 51,
      materialImageUrl: null,
      imageUrl: "/astoria-card.webp",
    }, curated)).toBeNull();
    expect(flooringSceneTextureUrl({
      id: 82,
      materialImageUrl: null,
      imageUrl: "/bahia-card.webp",
    }, curated)).toBe("/manus-storage/bahia-floor.webp");
    expect(flooringSceneTextureUrl({
      id: 54,
      designerRenderReady: false,
      materialImageUrl: "/not-a-swatch.webp",
      imageUrl: "/astoria-card.webp",
    })).toBeNull();
    expect(flooringSceneTextureUrl({
      id: 54,
      hasSwatch: true,
      materialImageUrl: "/astoria-swatch.webp",
      imageUrl: "/astoria-card.webp",
    })).toBe("/astoria-swatch.webp");
  });

  it("keeps every Designer-enabled priced active plank from the flooring gap sheet and leaves accessories out", () => {
    const sheet = parseCsv(readFileSync(new URL("./__fixtures__/flooring_gap.csv", import.meta.url), "utf8"));
    const rows = sheet.map((record) => ({
      id: Number(record.id),
      name: record.name,
      category: record.category,
      subCategory: record.sub_category,
      sellPrice: record.priced === "y" ? Number(record.sell_price) : 0,
      imageUrl: record.has_image === "y" ? `/photos/${record.slug}.webp` : null,
      materialImageUrl: record.has_material_swatch === "y" ? `/swatches/${record.slug}.webp` : null,
      showInDesigner: record.show_in_designer === "y",
      isActive: record.available === "y",
    }));
    const planks = rows.filter((row) => row.subCategory === "Planks & Flooring");
    const pricedActivePlanks = planks.filter((row) => row.sellPrice > 0 && row.isActive);
    const visible = rows.filter((row) => isSelectableDesignerFlooringPlank(row));

    expect(pricedActivePlanks).toHaveLength(89);
    expect(visible).toHaveLength(86);
    expect(visible.filter((row) => !row.materialImageUrl)).toHaveLength(82);
    expect(visible.filter((row) => !row.imageUrl)).not.toHaveLength(0);
    expect(visible.map((row) => row.name)).toEqual(expect.arrayContaining([
      "Astoria 20mil Vinyl Flooring",
      "Acorn",
      "Bahia 12mil Vinyl Flooring",
    ]));
    const visibleNames = visible.map((row) => row.name);
    for (const hidden of [
      "Madeira 20mil Vinyl Flooring",
      "Tigertail 12mil Vinyl Flooring",
      "Tigertail 20mil Vinyl Flooring",
      "Madeira Liteback Vinyl Flooring",
      "Sanibel 12mil  Vinyl Flooring",
    ]) {
      expect(visibleNames).not.toContain(hidden);
    }
    expect(rows.filter((row) => row.subCategory === "Moldings & Trim" && isSelectableDesignerFlooringPlank(row))).toHaveLength(0);
    expect(rows.filter((row) => row.subCategory === "Underlayment" && isSelectableDesignerFlooringPlank(row))).toHaveLength(0);
    expect(groupPelicanConfigurations(visible)).toHaveLength(visible.length);
  });

  it("appends a second catalog page without duplicating ids", () => {
    expect(concatCatalogPages([
      [{ id: 1, name: "A" }, { id: 2, name: "B" }],
      [{ id: 2, name: "B again" }, { id: 3, name: "C" }],
    ]).map((row) => row.name)).toEqual(["A", "B", "C"]);
  });
});
