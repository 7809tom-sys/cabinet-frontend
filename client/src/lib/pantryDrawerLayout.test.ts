import { describe, expect, it } from "vitest";
import { isTallPantryDrawerCabinet, pantryDrawerFrontLayout } from "./pantryDrawerLayout";

const pantry = { masterCode: "T3DB3084", placementType: "tall", numberOfDoors: 2, numberOfDrawers: 3 };

describe("source-backed pantry drawer front layout", () => {
  it("uses source two-shallow/one-deep rows when a saved pantry has no row JSON", () => {
    const layout = pantryDrawerFrontLayout(pantry, 79.5)!;
    expect(layout.rows.map(row => row.height)).toEqual([7.375, 7.375, 15]);
    expect(layout.drawerHeight).toBe(29.75);
    expect(layout.doorHeight + layout.drawerHeight).toBe(79.5);
  });
  it("uses two 15-inch source fronts for two-drawer pantry families", () => {
    for (const masterCode of ["T2DB1884", "VT2DB1884", "T2DBID3084"]) expect(pantryDrawerFrontLayout({ ...pantry, masterCode, numberOfDrawers: 2 }, 79.5)!.rows.map(row => row.height)).toEqual([15, 15]);
  });
  it("retains authored top-to-bottom heights and across-row counts", () => {
    const input = { ...pantry, drawerLayout: JSON.stringify([{ count: 2, height: 6 }, { count: 1, height: 18 }]) };
    const before = JSON.stringify(input);
    expect(pantryDrawerFrontLayout(input, 79.5)!.rows).toEqual([{ count: 2, height: 6 }, { count: 1, height: 18 }]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("fits authored heights to the door's available envelope without reversing proportions", () => {
    const layout = pantryDrawerFrontLayout({ ...pantry, doorHeight: 60 }, 79.5)!;
    expect(layout.drawerHeight).toBeCloseTo(19.5);
    expect(layout.rows[2]!.height / layout.rows[0]!.height).toBeCloseTo(15 / 7.375);
    expect(layout.doorHeight).toBe(60);
  });
  it("recognizes supplier graphics or an explicitly tall legacy pantry", () => {
    expect(isTallPantryDrawerCabinet({ ...pantry, masterCode: "LEGACY", graphicType: "tall_1door_3drawer" })).toBe(true);
    expect(isTallPantryDrawerCabinet({ ...pantry, masterCode: "LEGACY", description: "Pantry cabinet" })).toBe(true);
    expect(isTallPantryDrawerCabinet({ ...pantry, masterCode: "LEGACY", description: "Unspecified tall cabinet" })).toBe(false);
  });
  it("never changes regular bases, drawer-free pantries, or appliance openings", () => {
    for (const input of [
      { ...pantry, masterCode: "B30", placementType: "base" },
      { ...pantry, masterCode: "T3084", numberOfDrawers: 0 },
      { ...pantry, openingType: "middle" },
      { ...pantry, ovenType: "single" },
      { ...pantry, masterCode: "TOS3DB3084" },
      { ...pantry, masterCode: "TOD3084" },
    ]) expect(pantryDrawerFrontLayout(input, 79.5)).toBeNull();
  });
});
