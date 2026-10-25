import { describe, expect, it } from "vitest";
import type { DesignCabinet } from "@/lib/design";
import { buildGlassCornerCatalogChoices } from "@/lib/glassCornerCatalog";

function cabinet(masterCode: string, id: number, height: number): DesignCabinet {
  return {
    id,
    masterCode,
    description: `${masterCode} catalog product`,
    category: "Wall",
    subCategory: masterCode.startsWith("WDC") ? "Corner Wall" : "Glass Door Wall",
    width: masterCode.startsWith("WDC") ? "24" : "15",
    height: String(height),
    depth: masterCode.startsWith("WDC") ? "24" : "12",
    placement: masterCode.startsWith("PG") ? "accessory" : "wall",
    numberOfDoors: 1,
    numberOfDrawers: 0,
    isCornerCabinet: false,
  };
}

describe("glass corner catalog choices", () => {
  it("restores WDC2442GD from real WDC2442 and PGWDC42 identities", () => {
    const bases = [cabinet("WDC2430", 301, 30), cabinet("WDC2436", 361, 36), cabinet("WDC2442", 421, 42)];
    const addOns = [cabinet("PGWDC30", 302, 30), cabinet("PGWDC36", 362, 36), cabinet("PGWDC42", 422, 42)];
    const choices = buildGlassCornerCatalogChoices(bases, addOns);

    expect(choices.map((choice) => choice.displayMasterCode)).toEqual(["WDC2430GD", "WDC2436GD", "WDC2442GD"]);
    expect(choices[2]).toMatchObject({ id: 421, masterCode: "WDC2442", glassDoorAddonCode: "PGWDC42", glassDoor: true });
  });

  it("refuses missing or ambiguous add-on identities instead of inventing a glass SKU", () => {
    const base = cabinet("WDC2442", 421, 42);
    expect(buildGlassCornerCatalogChoices([base], [])).toEqual([]);
    expect(buildGlassCornerCatalogChoices([base], [cabinet("PGWDC42", 422, 42), cabinet("PG-WDC-42", 423, 42)])).toEqual([]);
  });

  it("does not replace a separately cataloged included-glass WDC42PG cabinet with a synthetic door-only choice", () => {
    const opaque = cabinet("WDC2442", 421, 42);
    const includedGlass = {
      ...cabinet("WDC42PG", 425, 42),
      description: "Diagonal corner wall cabinet with plain glass included",
      glassDoor: true,
    };
    const choices = buildGlassCornerCatalogChoices([opaque, includedGlass], [cabinet("PGWDC42", 422, 42)]);
    expect(choices.map((choice) => choice.id)).toEqual([421]);
    expect(choices[0]?.displayMasterCode).toBe("WDC2442GD");
    expect(includedGlass.masterCode).toBe("WDC42PG");
  });
});
