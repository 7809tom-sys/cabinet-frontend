import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("DesignTool flooring accessory suggestions", () => {
  it("refreshes explicit flooring trim through a selection endpoint that preserves its live price", () => {
    expect(source).toContain("trpc.surfaces.designSelectionByIds.useQuery");
    expect(source).toContain("refreshVerifiedSurfaceSelections(current, verifiedSelectedSurfaceRecords)");
    expect(source).toContain('surface.subCategory === "Moldings & Trim"');
  });

  it("opens a separate suggestion dialog only after a newly selected floor and never auto-adds trim", () => {
    expect(source).toContain("setFlooringAccessoryPromptFloor(item)");
    expect(source).toContain("<FlooringAccessorySuggestionsDialog");
    expect(source).toContain("onAddAccessory={addFlooringAccessory}");
    expect(source).toContain("if (role === \"flooring\")");
    expect(source).toContain("if (already) return");
  });

  it("adds an accessory only on its explicit dialog action without changing the installed flooring material", () => {
    expect(source).toContain("const addFlooringAccessory = useCallback");
    expect(source).toContain("prev.some((surface) => surface.id === item.id) ? prev : [...prev, item]");
    expect(source).toContain("setFlooringAccessoryPromptFloor(null)");
  });
});
