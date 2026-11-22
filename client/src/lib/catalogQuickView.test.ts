import { describe, expect, it } from "vitest";
import {
  cabinetConfigurationSummary,
  cabinetDimensionSummary,
  isCatalogAccessory,
  suggestedAccessoryOptions,
  type CatalogQuickViewItem,
} from "./catalogQuickView";

const wall: CatalogQuickViewItem = {
  id: 1,
  masterCode: "W2430",
  category: "Wall",
  subCategory: "Standard Wall",
  width: "24.00",
  height: "30.00",
  depth: "12.00",
  numberOfDoors: 2,
  numberOfDrawers: 0,
  numberOfAdjShelves: 2,
};

const base: CatalogQuickViewItem = {
  id: 2,
  masterCode: "3DB24",
  category: "Base",
  subCategory: "Drawer Base",
  width: "24.00",
  height: "34.50",
  depth: "24.00",
  numberOfDoors: 0,
  numberOfDrawers: 3,
};

const crown: CatalogQuickViewItem = {
  id: 3,
  masterCode: "CM8",
  category: "Molding",
  subCategory: "Crown Moulding",
  description: "8-foot Crown Moulding",
  width: "96.00",
};

const basePanel: CatalogQuickViewItem = {
  id: 4,
  masterCode: "BEP3",
  category: "Panels",
  subCategory: "Base Decorative End Panel",
  description: "Base decorative end panel",
  width: "3.00",
  height: "34.50",
};

const filler: CatalogQuickViewItem = {
  id: 5,
  masterCode: "F642",
  category: "Filler",
  subCategory: "Filler",
  description: "6-inch Cabinet Filler",
  width: "6.00",
  height: "42.00",
};

describe("catalog quick view helpers", () => {
  it("formats verified dimensions and cabinet configuration details", () => {
    expect(cabinetDimensionSummary(base)).toBe('W 24" · H 34.5" · D 24"');
    expect(cabinetConfigurationSummary(wall)).toEqual(["2 doors", "2 adjustable shelves"]);
    expect(cabinetConfigurationSummary(base)).toEqual(["3 drawers"]);
  });

  it("recognizes trim across accessory, panel, filler, and molding categories", () => {
    expect(isCatalogAccessory(crown)).toBe(true);
    expect(isCatalogAccessory({ ...crown, category: "Moulding", subCategory: "Crown Moulding", description: "8-foot Crown Moulding" })).toBe(true);
    expect(isCatalogAccessory({ ...crown, id: 31, category: "MOULDING", subCategory: "Crown & Moulding" })).toBe(true);
    expect(isCatalogAccessory(basePanel)).toBe(true);
    expect(isCatalogAccessory(filler)).toBe(true);
    expect(isCatalogAccessory(wall)).toBe(false);
  });

  it("suggests style-scoped accessory options by cabinet type without claiming fit", () => {
    const wallOptions = suggestedAccessoryOptions(wall, [wall, crown, basePanel, filler]);
    expect(wallOptions.map((item) => item.masterCode)).toEqual(["CM8", "F642", "BEP3"]);

    const baseOptions = suggestedAccessoryOptions(base, [base, crown, basePanel, filler]);
    expect(baseOptions.map((item) => item.masterCode)).toEqual(["BEP3", "F642", "CM8"]);
  });

  it("does not suggest roll-out trays on corner cabinets, but still does on a regular base", () => {
    const tray = {
      id: 6,
      masterCode: "RS18-TYPEA",
      category: "Accessory",
      subCategory: "Roll-Out Shelf",
      description: 'Roll-Out Shelf, Type A — 13-3/8" W (for 18" base)',
      width: "13.38",
    };
    const univ = {
      id: 7,
      masterCode: "UNIV-ROT18",
      category: "Accessory",
      subCategory: "Rollout Tray",
      description: "Universal rollout tray for 18-inch cabinet",
      width: "18.00",
    };
    const lazySusan = {
      id: 8,
      masterCode: "LSB33",
      category: "Base",
      subCategory: "Lazy Susan",
      description: "33in Lazy Susan Corner Base",
      width: "33.00",
      numberOfDoors: 1,
    };
    const regularBase = {
      ...base,
      id: 9,
      masterCode: "B18",
      subCategory: "Single Door Base",
      numberOfDoors: 1,
      numberOfDrawers: 1,
    };
    const catalog = [lazySusan, regularBase, crown, basePanel, filler, tray, univ];
    expect(suggestedAccessoryOptions(lazySusan, catalog).map((item) => item.masterCode)).not.toContain("RS18-TYPEA");
    expect(suggestedAccessoryOptions(lazySusan, catalog).map((item) => item.masterCode)).not.toContain("UNIV-ROT18");
    const regular = suggestedAccessoryOptions(regularBase, catalog).map((item) => item.masterCode);
    expect(regular).toContain("RS18-TYPEA");
    expect(regular).toContain("BEP3");
  });
});
