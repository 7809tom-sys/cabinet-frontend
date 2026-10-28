import { describe, expect, it } from "vitest";
import {
  catalogFreeShippingIndexFromRows,
  isCatalogFreeShippingFlag,
  isCatalogFreeShippingIdentity,
} from "./freeShippingItem";

describe("catalog free shipping flag", () => {
  it("accepts only the stored on values", () => {
    expect(isCatalogFreeShippingFlag(true)).toBe(true);
    expect(isCatalogFreeShippingFlag(1)).toBe(true);
    expect(isCatalogFreeShippingFlag(false)).toBe(false);
    expect(isCatalogFreeShippingFlag(0)).toBe(false);
    expect(isCatalogFreeShippingFlag(null)).toBe(false);
    expect(isCatalogFreeShippingFlag(undefined)).toBe(false);
  });

  it("matches a flagged cabinet by id or master code and leaves other goods quoted", () => {
    const index = catalogFreeShippingIndexFromRows([
      { id: 10, masterCode: "B24", freeShipping: 1 },
      { id: 11, masterCode: "W3018", freeShipping: 0 },
    ]);

    expect(isCatalogFreeShippingIdentity({ cabinetId: 10, masterCode: "B24" }, index)).toBe(true);
    expect(isCatalogFreeShippingIdentity({ cabinetId: null, masterCode: "b24" }, index)).toBe(true);
    expect(isCatalogFreeShippingIdentity({ cabinetId: 11, masterCode: "W3018" }, index)).toBe(false);
    expect(isCatalogFreeShippingIdentity({ cabinetId: 10, productKind: "surface", masterCode: "B24" }, index)).toBe(false);
    expect(isCatalogFreeShippingIdentity({ cabinetId: 10, productKind: "hardware", masterCode: "B24" }, index)).toBe(false);
    expect(isCatalogFreeShippingIdentity({ masterCode: "NOT-A-CABINET" }, index)).toBe(false);
  });
});
