import { describe, expect, it } from "vitest";
import {
  catalogColorOptions,
  filterCatalogStyles,
  styleMatchesConstruction,
  type CatalogStyleFacet,
} from "./catalogBrowsing";

const styles: CatalogStyleFacet[] = [
  {
    id: 1,
    styleCode: "FW",
    ourName: "Floral White",
    color: "White",
    boxConstruction: "1/2 in. cabinet-grade furniture board box",
    drawerConstruction: "Plywood rebate-joint drawer box",
    hardware: "Builder-grade undermount glides; six-way adjustable non-soft-close hinges",
    isBuilderGrade: true,
  },
  {
    id: 2,
    styleCode: "NW",
    ourName: "Navy Core",
    color: "Navy",
    boxConstruction: "1/2 in. plywood box",
    drawerConstruction: "Solid-wood dovetail drawer box",
    hardware: "Full-extension soft-close glides",
    isBuilderGrade: false,
  },
  {
    id: 3,
    styleCode: "SWO",
    ourName: "Slim White Oak",
    finish: "White Oak",
    boxConstruction: "1/2 in. plywood; matching exterior",
    drawerConstruction: "Solid-wood dovetail drawer box",
    hardware: "Undermount full-extension soft-close glides",
    isBuilderGrade: false,
  },
];

describe("catalog browsing facets", () => {
  it("derives a stable, source-backed color list", () => {
    expect(catalogColorOptions(styles)).toEqual(["Navy", "White", "White Oak"]);
  });

  it("uses the documented finish name instead of exposing a raw hex swatch", () => {
    expect(catalogColorOptions([
      { id: 4, styleCode: "OB", ourName: "Obsidian", color: "#1A1A1A", finish: "Obsidian Forge" },
    ])).toEqual(["Obsidian Forge"]);
  });

  it("combines color and construction constraints on style choices", () => {
    expect(filterCatalogStyles(styles, { color: "White", construction: "builder" }).map((style) => style.styleCode))
      .toEqual(["FW"]);
    expect(filterCatalogStyles(styles, { color: null, construction: "soft-close" }).map((style) => style.styleCode))
      .toEqual(["NW", "SWO"]);
  });

  it("does not mislabel a Builder Grade non-soft-close line as soft-close", () => {
    expect(styleMatchesConstruction(styles[0], "builder")).toBe(true);
    expect(styleMatchesConstruction(styles[0], "soft-close")).toBe(false);
    expect(styleMatchesConstruction(styles[1], "plywood")).toBe(true);
  });
});
