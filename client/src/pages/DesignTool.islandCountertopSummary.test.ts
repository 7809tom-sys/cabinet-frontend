import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const designSource = readFileSync(new URL("../lib/design.ts", import.meta.url), "utf8");

describe("Designer island countertop and selection summary", () => {
  it("persists independent island product and material identity inside the saved IslandZone", () => {
    expect(designSource).toContain("countertopMaterialId?: string | null");
    expect(designSource).toContain("countertopProductId?: number | null");
    expect(source).toContain("countertopMaterialId: draft.countertopMaterialId ?? null");
    expect(source).toContain("countertopProductId: draft.countertopProductId ?? null");
	  expect(source).toContain("setIsland(d.island ?? null)");
	  expect(source).toContain("setSelectedSurfaces(restoredSurfaces)");
  });

	it("passes separate island material options and render inputs without replacing the perimeter material", () => {
	  expect(source).toContain('trpc.surfaces.recommended.useQuery({ role: "countertop", limit: 200 })');
    expect(source).toContain("countertopOptions={countertopProductChoices.map");
    expect(source).toContain("setCountertopSurfaceForScope(current, requestedCountertop, \"island\")");
    expect(source).toContain("islandCountertopMaterialId={countertop ? island?.countertopMaterialId ?? countertopMaterialId : null}");
    expect(source).toContain("countertopMaterialId={countertop ? island.countertopMaterialId ?? countertopMaterialId : null}");
	  expect(source).toContain('setSelectedSurfaces((current) => clearCountertopSurfaceScope(current, "island"))');
	  expect(source).toContain("setCountertop(true)");
  });

  it("shows all four current wall and island cabinet and countertop selections", () => {
    expect(source).toContain('data-testid="design-finish-selection-summary"');
    expect(source).toContain('data-testid="summary-wall-cabinet-color"');
    expect(source).toContain('data-testid="summary-island-cabinet-color"');
    expect(source).toContain('data-testid="summary-wall-countertop"');
    expect(source).toContain('data-testid="summary-island-countertop"');
  });
});
