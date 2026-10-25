import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BATHROOM_FIXTURE_RECOMMENDED_SECTIONS,
  BATHROOM_RECOMMENDED_SECTIONS,
  BATHROOM_SURFACE_RECOMMENDED_SECTIONS,
  RECOMMENDED_SECTIONS,
} from "./RecommendedSurfaces";

describe("RecommendedSurfaces bathroom palette", () => {
  it("keeps source-backed bathroom fixtures out of the Surfaces group", () => {
    expect(BATHROOM_SURFACE_RECOMMENDED_SECTIONS.map((section) => section.role)).toEqual([
      "countertop",
      "flooring",
      "backsplash",
    ]);
    expect(BATHROOM_SURFACE_RECOMMENDED_SECTIONS.map((section) => section.label)).toEqual([
      "Countertops",
      "Flooring",
      "Wall Tile",
    ]);
  });

  it("exposes the source-backed bathroom fixture families in the Fixtures group", () => {
    expect(BATHROOM_FIXTURE_RECOMMENDED_SECTIONS.map((section) => section.role)).toEqual([
      "bathroom-sink",
      "bathroom-faucet",
      "toilet-bidet",
      "bathtub",
      "shower-door",
      "shower-surround",
      "shower-system",
      "bathroom-accessory",
    ]);
    expect(BATHROOM_RECOMMENDED_SECTIONS).toBe(BATHROOM_FIXTURE_RECOMMENDED_SECTIONS);
    expect(BATHROOM_FIXTURE_RECOMMENDED_SECTIONS.map((section) => section.label)).toEqual(expect.arrayContaining([
      "Vanity Sinks",
      "Toilets & Bidets",
      "Bathtubs",
      "Shower Walls",
      "Shower & Tub Doors",
      "Other Bathroom Accessories",
    ]));
  });

  it("keeps kitchen sink and faucet recommendation roles out of the bathroom palette", () => {
    const bathroomRoles = new Set(BATHROOM_RECOMMENDED_SECTIONS.map((section) => section.role));
    expect(bathroomRoles.has("sink")).toBe(false);
    expect(bathroomRoles.has("faucet")).toBe(false);
    expect(RECOMMENDED_SECTIONS.map((section) => section.role)).toContain("sink");
    expect(RECOMMENDED_SECTIONS.map((section) => section.role)).toContain("faucet");
  });

  it("opens the requested family rather than a default sink tab, and places repeats without toggling off their source identity", () => {
    const compact = readFileSync(new URL("./RecommendedSurfaces.tsx", import.meta.url), "utf8");
    const full = readFileSync(new URL("./SurfacesPickerDialog.tsx", import.meta.url), "utf8");
    const designer = readFileSync(new URL("../../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(compact).toContain("onBrowseAll(role)");
    expect(compact).toMatch(/if \(\(role === "toilet-bidet" \|\| role === "bathtub" \|\| tubFiller\) && onPlaceBathroomFixture\)/);
    expect(full).toContain("initialBathroomRole?: RecommendedRole");
    expect(designer).toContain("initialBathroomRole={bathroomBrowseRole}");
    expect(designer).toContain('stepId === "tub" ? "bathtub"');
  });
});
