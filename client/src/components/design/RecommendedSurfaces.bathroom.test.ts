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
    // The sidebar is a list of destinations. Its order IS the popup's tab order,
    // so these roles must stay in the order the popup shows them.
    expect(BATHROOM_FIXTURE_RECOMMENDED_SECTIONS.map((section) => section.role)).toEqual([
      "bathroom-sink",
      "bathroom-faucet",
      "toilet-bidet",
      "bathtub",
      "shower-pan",
      "shower-surround",
      "shower-tile",
      "shower-system",
      "shower-door",
      "shower-niche",
    ]);
    expect(BATHROOM_RECOMMENDED_SECTIONS).toBe(BATHROOM_FIXTURE_RECOMMENDED_SECTIONS);
    expect(BATHROOM_FIXTURE_RECOMMENDED_SECTIONS.map((section) => section.label)).toEqual(expect.arrayContaining([
      "Vanity Sinks",
      "Toilets & Bidets",
      "Bathtubs",
      "Shower Pans (floors)",
      "Shower Panels & Surrounds",
      "Shower Tile",
      "Shower Heads & Faucets",
      "Glass Doors",
      "Niches & Soap Trays",
    ]));
    // The shower families appear once each: merging them into the existing
    // doors/walls/systems tabs, never duplicating them.
    const roles = BATHROOM_FIXTURE_RECOMMENDED_SECTIONS.map((section) => section.role);
    expect(new Set(roles).size).toBe(roles.length);
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
    // A category row is a destination, not an accordion: no expand state, no
    // inline card grid, and no second browse affordance.
    expect(compact).toContain("onOpenCategory(role)");
    expect(compact).not.toContain("Browse all");
    expect(compact).not.toContain("aria-expanded");
    // Compact rows: the name wraps rather than truncating, and there is no
    // chevron because the whole row is the link.
    expect(compact).toContain("break-words");
    expect(compact).not.toContain("truncate");
    expect(compact).not.toContain("ChevronRight");
    expect(compact).not.toContain("ChevronDown");
    // Placement now happens in the popup, which is the only place to pick.
    expect(full).toContain("onPlaceBathroomFixture");
    expect(full).toContain("initialBathroomRole?: RecommendedRole");
    expect(designer).toContain("initialBathroomRole={bathroomBrowseRole}");
    expect(designer).toContain('stepId === "tub" ? "bathtub"');
  });
});
